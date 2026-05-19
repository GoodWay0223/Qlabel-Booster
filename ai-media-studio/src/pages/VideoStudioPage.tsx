import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Textarea,
  Select,
  InputNumber,
  MessagePlugin,
  Loading,
  Tag,
} from 'tdesign-react';
import { VideoIcon, DownloadIcon, RefreshIcon } from 'tdesign-icons-react';
import { useProviders } from '../hooks/useProviders';
import { GenerationRecord } from '../types/provider';

const SIZE_OPTIONS = [
  { value: '1280x720', label: '1280×720 (16:9)' },
  { value: '1920x1080', label: '1920×1080 (16:9 FHD)' },
  { value: '720x1280', label: '720×1280 (9:16 竖屏)' },
  { value: '1024x1024', label: '1024×1024 (方形)' },
];

export function VideoStudioPage() {
  const { providers } = useProviders();
  const videoProviders = useMemo(
    () => providers.filter(p => p.capabilities.includes('video')),
    [providers]
  );

  const [providerId, setProviderId] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1280x720');
  const [duration, setDuration] = useState(5);
  const [fps, setFps] = useState(24);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [results, setResults] = useState<string[]>([]);
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!providerId && videoProviders.length > 0) {
      const def = videoProviders.find(p => p.isDefault) || videoProviders[0];
      setProviderId(def.id);
      setModel(def.videoModels[0] || '');
    }
  }, [videoProviders, providerId]);

  useEffect(() => {
    const p = videoProviders.find(p => p.id === providerId);
    if (p && !p.videoModels.includes(model)) {
      setModel(p.videoModels[0] || '');
    }
  }, [providerId, videoProviders, model]);

  const fetchHistory = async () => {
    try {
      const resp = await fetch('/api/media/history?type=video&limit=20');
      const data = await resp.json();
      setHistory(data.items || []);
    } catch {}
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const currentProvider = videoProviders.find(p => p.id === providerId);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      MessagePlugin.warning('请输入描述');
      return;
    }
    if (!providerId) {
      MessagePlugin.warning('请先选择一个支持文生视频的 Provider');
      return;
    }
    setLoading(true);
    setProgress('提交任务...');
    setResults([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch('/api/media/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, model, prompt, size, duration, fps }),
        signal: controller.signal,
      });

      if (!resp.body) throw new Error('无响应流');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'progress') {
              setProgress(`任务状态：${data.status}`);
            } else if (data.type === 'done') {
              setResults(data.urls || []);
              setProgress('生成完成');
              MessagePlugin.success('视频生成成功');
              fetchHistory();
            } else if (data.type === 'error') {
              throw new Error(data.message || '生成失败');
            }
          } catch (e: any) {
            if (e?.message) throw e;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        MessagePlugin.error(e?.message || '生成失败');
        setProgress('生成失败');
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const downloadVideo = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-${Date.now()}.mp4`;
    a.target = '_blank';
    a.click();
  };

  if (videoProviders.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto py-16 text-center">
          <VideoIcon size="48px" style={{ color: 'var(--td-text-color-placeholder)' }} />
          <h2 className="text-xl font-semibold mt-4 mb-2" style={{ color: 'var(--td-text-color-primary)' }}>
            还未配置文生视频 Provider
          </h2>
          <p className="mb-6" style={{ color: 'var(--td-text-color-secondary)' }}>
            请先到「中转站」页面添加一个支持视频生成能力的 API
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--td-text-color-primary)' }}>
            文生视频工作台
          </h1>
          <p style={{ color: 'var(--td-text-color-secondary)' }}>
            通过中转站 API 生成视频，兼容 Sora、Kling、CogVideoX 等模型
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 表单 */}
          <div className="lg:col-span-1 space-y-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--td-text-color-primary)' }}>
                Provider
              </label>
              <Select value={providerId} onChange={(v) => setProviderId(v as string)}>
                {videoProviders.map(p => (
                  <Select.Option key={p.id} value={p.id} label={p.name} />
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--td-text-color-primary)' }}>
                模型
              </label>
              <Select value={model} onChange={(v) => setModel(v as string)} placeholder="请选择模型">
                {currentProvider?.videoModels.map(m => (
                  <Select.Option key={m} value={m} label={m} />
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--td-text-color-primary)' }}>
                提示词 (Prompt)
              </label>
              <Textarea
                value={prompt}
                onChange={(v) => setPrompt(v as string)}
                placeholder="例如：A panda riding a skateboard down a city street, cinematic"
                autosize={{ minRows: 5, maxRows: 12 }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm mb-1.5" style={{ color: 'var(--td-text-color-primary)' }}>
                  分辨率
                </label>
                <Select value={size} onChange={(v) => setSize(v as string)} options={SIZE_OPTIONS} />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--td-text-color-primary)' }}>
                  时长 (秒)
                </label>
                <InputNumber value={duration} min={1} max={60} onChange={(v) => setDuration(v as number)} />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--td-text-color-primary)' }}>
                  帧率 (FPS)
                </label>
                <InputNumber value={fps} min={8} max={60} onChange={(v) => setFps(v as number)} />
              </div>
            </div>

            <Button theme="primary" block size="large" loading={loading} onClick={handleGenerate}>
              生成视频
            </Button>
            {loading && progress && (
              <div className="text-xs text-center" style={{ color: 'var(--td-text-color-secondary)' }}>
                {progress}
              </div>
            )}
          </div>

          {/* 结果区 */}
          <div className="lg:col-span-2 space-y-4">
            <div
              className="rounded-xl p-4 min-h-[400px]"
              style={{ backgroundColor: 'var(--td-bg-color-container)' }}
            >
              {loading ? (
                <div className="flex flex-col items-center justify-center min-h-[400px]">
                  <Loading size="large" />
                  <div className="mt-4 text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
                    {progress || '正在生成视频，可能需要数分钟...'}
                  </div>
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-3">
                  {results.map((url, idx) => (
                    <div key={idx} className="relative">
                      <video src={url} controls className="w-full rounded-lg" />
                      <Button
                        size="small"
                        className="absolute top-2 right-2"
                        icon={<DownloadIcon />}
                        onClick={() => downloadVideo(url)}
                      >
                        下载
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[400px]" style={{ color: 'var(--td-text-color-placeholder)' }}>
                  <VideoIcon size="48px" />
                  <div className="mt-3">输入提示词，点击「生成视频」开始创作</div>
                </div>
              )}
            </div>

            {history.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                    最近生成
                  </h3>
                  <Button variant="text" size="small" icon={<RefreshIcon />} onClick={fetchHistory}>
                    刷新
                  </Button>
                </div>
                <div className="space-y-2">
                  {history.slice(0, 5).map(h => (
                    <div
                      key={h.id}
                      className="p-3 rounded-lg cursor-pointer flex items-center gap-3"
                      style={{ backgroundColor: 'var(--td-bg-color-component)' }}
                      onClick={() => h.resultUrls[0] && setResults(h.resultUrls)}
                    >
                      <Tag size="small" theme={h.status === 'completed' ? 'success' : h.status === 'failed' ? 'danger' : 'warning'}>
                        {h.status}
                      </Tag>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate" style={{ color: 'var(--td-text-color-primary)' }}>
                          {h.prompt}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
                          {h.model} · {new Date(h.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
