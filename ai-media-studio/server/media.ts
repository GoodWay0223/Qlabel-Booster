/**
 * 中转站 API 调用层
 *
 * 假设所有中转站都遵循 OpenAI 兼容协议：
 *   - Chat Completions:    POST {baseUrl}/chat/completions
 *   - Image Generation:    POST {baseUrl}/images/generations
 *   - Video Generation:    POST {baseUrl}/videos/generations  (各家协议略有差异，本实现以 OpenAI Sora 风格为准)
 *
 * 不同中转站对视频生成接口实现不一致，本文件做了一层兼容：
 * 优先尝试 /videos/generations，若返回任务 id 则轮询；否则直接返回 url。
 */

import { Provider } from './providers.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface ImageGenOptions {
  model: string;
  prompt: string;
  size?: string;       // e.g. "1024x1024"
  n?: number;
  quality?: string;    // standard / hd
  style?: string;      // vivid / natural
  responseFormat?: 'url' | 'b64_json';
}

export interface VideoGenOptions {
  model: string;
  prompt: string;
  size?: string;       // e.g. "1280x720"
  duration?: number;   // seconds
  fps?: number;
}

/** 在 baseUrl 末尾智能拼接路径 */
function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const p = path.replace(/^\/+/, '');
  return `${base}/${p}`;
}

/** 调用 OpenAI 兼容的 chat completions（非流式） */
export async function chatCompletion(provider: Provider, options: ChatOptions): Promise<{
  content: string;
  raw: any;
}> {
  const url = joinUrl(provider.baseUrl, 'chat/completions');
  const body = {
    model: options.model,
    messages: options.messages,
    stream: false,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Chat completion failed: ${resp.status} ${text.slice(0, 500)}`);
  }
  const data: any = await resp.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  return { content, raw: data };
}

/** 调用 OpenAI 兼容的 chat completions（SSE 流式），按 token 回调 */
export async function chatCompletionStream(
  provider: Provider,
  options: ChatOptions,
  onDelta: (delta: string) => void
): Promise<{ content: string }> {
  const url = joinUrl(provider.baseUrl, 'chat/completions');
  const body = {
    model: options.model,
    messages: options.messages,
    stream: true,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok || !resp.body) {
    const text = await resp.text();
    throw new Error(`Chat stream failed: ${resp.status} ${text.slice(0, 500)}`);
  }

  let full = '';
  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') {
        return { content: full };
      }
      try {
        const json = JSON.parse(payload);
        const delta: string = json?.choices?.[0]?.delta?.content || '';
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {
        // ignore non-JSON lines
      }
    }
  }
  return { content: full };
}

/** 文生图 */
export async function generateImage(provider: Provider, options: ImageGenOptions): Promise<{
  urls: string[];
  raw: any;
}> {
  const url = joinUrl(provider.baseUrl, 'images/generations');
  const body: Record<string, unknown> = {
    model: options.model,
    prompt: options.prompt,
    n: options.n ?? 1,
    size: options.size ?? '1024x1024',
    response_format: options.responseFormat ?? 'url',
  };
  if (options.quality) body.quality = options.quality;
  if (options.style) body.style = options.style;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Image generation failed: ${resp.status} ${text.slice(0, 800)}`);
  }
  const data: any = await resp.json();
  const items = data?.data ?? [];
  const urls: string[] = items.map((it: any) => {
    if (it.url) return it.url;
    if (it.b64_json) return `data:image/png;base64,${it.b64_json}`;
    return '';
  }).filter(Boolean);
  return { urls, raw: data };
}

/** 文生视频
 *
 * 兼容多种实现：
 * 1) 直接返回 { data: [{ url }] } —— 类似 image
 * 2) 返回 { id: "task_xxx", status: "queued" } —— 任务式，需要轮询
 *    轮询端点：GET {baseUrl}/videos/generations/{id}
 */
export async function generateVideo(
  provider: Provider,
  options: VideoGenOptions,
  onProgress?: (status: string) => void
): Promise<{ urls: string[]; raw: any }> {
  const url = joinUrl(provider.baseUrl, 'videos/generations');
  const body: Record<string, unknown> = {
    model: options.model,
    prompt: options.prompt,
  };
  if (options.size) body.size = options.size;
  if (options.duration) body.duration = options.duration;
  if (options.fps) body.fps = options.fps;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Video generation failed: ${resp.status} ${text.slice(0, 800)}`);
  }
  const data: any = await resp.json();

  // case 1: 直接返回结果
  const items = data?.data;
  if (Array.isArray(items) && items.length > 0 && items[0]?.url) {
    return { urls: items.map((it: any) => it.url), raw: data };
  }

  // case 2: 返回任务 id，需要轮询
  const taskId = data?.id || data?.task_id;
  if (taskId) {
    onProgress?.('queued');
    const pollUrl = joinUrl(provider.baseUrl, `videos/generations/${taskId}`);
    const startTime = Date.now();
    const timeout = 10 * 60 * 1000; // 10 分钟
    while (Date.now() - startTime < timeout) {
      await new Promise(r => setTimeout(r, 5000));
      const pollResp = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${provider.apiKey}` },
      });
      if (!pollResp.ok) continue;
      const pollData: any = await pollResp.json();
      const status = pollData?.status || 'processing';
      onProgress?.(status);
      if (status === 'succeeded' || status === 'completed' || status === 'success') {
        const urls: string[] =
          pollData?.data?.map?.((it: any) => it.url).filter(Boolean) ||
          (pollData?.video_url ? [pollData.video_url] : []) ||
          (pollData?.url ? [pollData.url] : []);
        return { urls, raw: pollData };
      }
      if (status === 'failed' || status === 'error') {
        throw new Error(pollData?.error?.message || pollData?.message || '视频生成任务失败');
      }
    }
    throw new Error('视频生成任务超时');
  }

  // 兜底：直接返回原始数据
  return { urls: [], raw: data };
}
