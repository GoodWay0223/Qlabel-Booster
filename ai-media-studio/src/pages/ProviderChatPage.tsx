import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Textarea,
  Select,
  MessagePlugin,
  Tag,
} from 'tdesign-react';
import { SendIcon, DeleteIcon, ChatIcon } from 'tdesign-icons-react';
import { useProviders } from '../hooks/useProviders';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  isStreaming?: boolean;
}

const DEFAULT_SYSTEM = '你是一个有用的 AI 助手，请用清晰、简洁的方式回答用户的问题。';

export function ProviderChatPage() {
  const { providers } = useProviders();
  const chatProviders = useMemo(
    () => providers.filter(p => p.capabilities.includes('chat')),
    [providers]
  );

  const [providerId, setProviderId] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SYSTEM);
  const [showSystem, setShowSystem] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!providerId && chatProviders.length > 0) {
      const def = chatProviders.find(p => p.isDefault) || chatProviders[0];
      setProviderId(def.id);
      setModel(def.chatModels[0] || '');
    }
  }, [chatProviders, providerId]);

  useEffect(() => {
    const p = chatProviders.find(p => p.id === providerId);
    if (p && !p.chatModels.includes(model)) {
      setModel(p.chatModels[0] || '');
    }
  }, [providerId, chatProviders, model]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const currentProvider = chatProviders.find(p => p.id === providerId);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    if (!providerId) {
      MessagePlugin.warning('请先选择一个 Provider');
      return;
    }

    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
      role: 'user',
      content: input,
    };
    const assistantMsg: ChatMessage = {
      id: `${Date.now()}-a`,
      role: 'assistant',
      content: '',
      model,
      isStreaming: true,
    };
    const newMessages = [...messages, userMsg, assistantMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const resp = await fetch('/api/media/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          model,
          systemPrompt,
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.body) throw new Error('无响应流');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let acc = '';

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
            if (data.type === 'text') {
              acc += data.content;
              setMessages(prev => prev.map(m =>
                m.id === assistantMsg.id ? { ...m, content: acc } : m
              ));
            } else if (data.type === 'error') {
              throw new Error(data.message || '聊天失败');
            }
          } catch (e: any) {
            if (e?.message) throw e;
          }
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id ? { ...m, isStreaming: false } : m
      ));
    } catch (e: any) {
      MessagePlugin.error(e?.message || '聊天失败');
      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id ? { ...m, content: `❌ ${e?.message || '聊天失败'}`, isStreaming: false } : m
      ));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  if (chatProviders.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto py-16 text-center">
          <ChatIcon size="48px" style={{ color: 'var(--td-text-color-placeholder)' }} />
          <h2 className="text-xl font-semibold mt-4 mb-2" style={{ color: 'var(--td-text-color-primary)' }}>
            还未配置聊天 Provider
          </h2>
          <p className="mb-6" style={{ color: 'var(--td-text-color-secondary)' }}>
            请先到「中转站」页面添加一个支持 LLM 聊天的 API
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 顶栏：Provider/Model 选择 */}
      <div
        className="flex items-center gap-3 px-6 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--td-component-border)', backgroundColor: 'var(--td-bg-color-container)' }}
      >
        <span className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>Provider</span>
        <Select size="small" value={providerId} onChange={(v) => setProviderId(v as string)} style={{ width: 180 }}>
          {chatProviders.map(p => (
            <Select.Option key={p.id} value={p.id} label={p.name} />
          ))}
        </Select>
        <span className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>Model</span>
        <Select size="small" value={model} onChange={(v) => setModel(v as string)} style={{ width: 200 }}>
          {currentProvider?.chatModels.map(m => (
            <Select.Option key={m} value={m} label={m} />
          ))}
        </Select>
        <Button size="small" variant="text" onClick={() => setShowSystem(s => !s)}>
          {showSystem ? '隐藏 System Prompt' : '编辑 System Prompt'}
        </Button>
        <div className="flex-1" />
        <Button size="small" variant="text" icon={<DeleteIcon />} onClick={handleClear} disabled={messages.length === 0}>
          清空对话
        </Button>
      </div>

      {showSystem && (
        <div
          className="px-6 py-3 border-b flex-shrink-0"
          style={{ borderColor: 'var(--td-component-border)', backgroundColor: 'var(--td-bg-color-component)' }}
        >
          <Textarea
            value={systemPrompt}
            onChange={(v) => setSystemPrompt(v as string)}
            placeholder="System prompt..."
            autosize={{ minRows: 2, maxRows: 4 }}
          />
        </div>
      )}

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="py-16 text-center">
              <ChatIcon size="48px" style={{ color: 'var(--td-text-color-placeholder)' }} />
              <div className="mt-4 text-base" style={{ color: 'var(--td-text-color-primary)' }}>
                中转站聊天工作台
              </div>
              <div className="mt-2 text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
                直接通过中转站 API 进行 OpenAI 兼容的对话，不经过 Agent SDK
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[80%] rounded-2xl px-4 py-3"
                  style={{
                    backgroundColor: msg.role === 'user'
                      ? 'var(--td-brand-color)'
                      : 'var(--td-bg-color-container)',
                    color: msg.role === 'user' ? '#fff' : 'var(--td-text-color-primary)',
                    border: msg.role === 'assistant' ? '1px solid var(--td-component-border)' : 'none',
                  }}
                >
                  {msg.role === 'assistant' && msg.model && (
                    <div className="mb-1.5">
                      <Tag size="small" variant="outline">{msg.model}</Tag>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {msg.content || (msg.isStreaming ? '...' : '')}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 输入框 */}
      <div
        className="px-6 py-4 border-t flex-shrink-0"
        style={{ borderColor: 'var(--td-component-border)', backgroundColor: 'var(--td-bg-color-page)' }}
      >
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(v) => setInput(v as string)}
            placeholder="输入消息... (Cmd/Ctrl + Enter 发送)"
            autosize={{ minRows: 1, maxRows: 6 }}
            onKeydown={(_v, ctx) => {
              const e = ctx.e as KeyboardEvent;
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                sendMessage();
              }
            }}
          />
          <Button
            theme="primary"
            icon={<SendIcon />}
            loading={loading}
            disabled={!input.trim()}
            onClick={sendMessage}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}
