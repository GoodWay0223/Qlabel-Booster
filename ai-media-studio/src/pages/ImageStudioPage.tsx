import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Textarea,
  Select,
  InputNumber,
  MessagePlugin,
  Loading,
  Tag,
} from 'tdesign-react';
import { ImageIcon, DownloadIcon, RefreshIcon } from 'tdesign-icons-react';
import { useProviders } from '../hooks/useProviders';
import { GenerationRecord } from '../types/provider';

const SIZE_OPTIONS = [
  { value: '1024x1024', label: '1024×1024 (方形)' },
  { value: '1024x1792', label: '1024×1792 (竖屏)' },
  { value: '1792x1024', label: '1792×1024 (横屏)' },
  { value: '512x512', label: '512×512 (小图)' },
];

const QUALITY_OPTIONS = [
  { value: 'standard', label: '标准' },
  { value: 'hd', label: '高清 (HD)' },
];

const STYLE_OPTIONS = [
  { value: 'vivid', label: '生动 (vivid)' },
  { value: 'natural', label: '自然 (natural)' },
];

export function ImageStudioPage() {
  const { providers } = useProviders();
  const imageProviders = useMemo(
    () => providers.filter(p => p.capabilities.includes('image')),
    [providers]
  );

  const [providerId, setProviderId] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1024x1024');
  const [n, setN] = useState(1);
  const [quality, setQuality] = useState('standard');
  const [style, setStyle] = useState('vivid');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [history, setHistory] = useState<GenerationRecord[]>([]);

  // 初始化默认 Provider
  useEffect(() => {
    if (!providerId && imageProviders.length > 0) {
      const def = imageProviders.find(p => p.isDefault) || imageProviders[0];
      setProviderId(def.id);
      setModel(def.imageModels[0] || '');
    }
  }, [imageProviders, providerId]);

  // 切换 provider 时切换模型
  useEffect(() => {
    const p = imageProviders.find(p => p.id === providerId);
    if (p && !p.imageModels.includes(model)) {
      setModel(p.imageModels[0] || '');
    }
  }, [providerId, imageProviders, model]);

  const fetchHistory = async () => {
    try {
      const resp = await fetch('/api/media/history?type=image&limit=20');
      const data = await resp.json();
      setHistory(data.items || []);
    } catch {}
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const currentProvider = imageProviders.find(p => p.id === providerId);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      MessagePlugin.warning('请输入描述');
      return;
    }
    if (!providerId) {
      MessagePlugin.warning('请先选择一个支持文生图的 Provider');
      return;
    }
    setLoading(true);
    setResults([]);
    try {
      const resp = await fetch('/api/media/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, model, prompt, size, n, quality, style }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || '生成失败');
      setResults(data.urls || []);
      MessagePlugin.success('图像生成成功');
      fetchHistory();
    } catch (e: any) {
      MessagePlugin.error(e?.message || '生成失败');
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = (url: string, idx: number) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `image-${Date.now()}-${idx}.png`;
    a.target = '_blank';
    a.click();
  };

  if (imageProviders.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto py-16 text-center">
          <ImageIcon size="48px" style={{ color: 'var(--td-text-color-placeholder)' }} />
          <h2 className="text-xl font-semibold mt-4 mb-2" style={{ color: 'var(--td-text-color-primary)' }}>
            还未配置文生图 Provider
          </h2>
          <p className="mb-6" style={{ color: 'var(--td-text-color-secondary)' }}>
            请先到「中转站」页面添加一个支持图像生成能力的 API
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
            文生图工作台
          </h1>
          <p style={{ color: 'var(--td-text-color-secondary)' }}>
            通过中转站 API 生成图像，支持 DALL·E 3、SD、Flux 等 OpenAI 兼容模型
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
                {imageProviders.map(p => (
                  <Select.Option key={p.id} value={p.id} label={p.name} />
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--td-text-color-primary)' }}>
                模型
              </label>
              <Select value={model} onChange={(v) => setModel(v as string)} placeholder="请选择模型">
                {currentProvider?.imageModels.map(m => (
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
                placeholder="例如：A futuristic city skyline at sunset, cyberpunk style, ultra detailed"
                autosize={{ minRows: 5, maxRows: 12 }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--td-text-color-primary)' }}>
                  尺寸
                </label>
                <Select value={size} onChange={(v) => setSize(v as string)} options={SIZE_OPTIONS} />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--td-text-color-primary)' }}>
                  数量
                </label>
                <InputNumber value={n} min={1} max={4} onChange={(v) => setN(v as number)} />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--td-text-color-primary)' }}>
                  质量
                </label>
                <Select value={quality} onChange={(v) => setQuality(v as string)} options={QUALITY_OPTIONS} />
              </div>
              <div>
                <label className="block text-sm mb-1.5" style={{ color: 'var(--td-text-color-primary)' }}>
                  风格
                </label>
                <Select value={style} onChange={(v) => setStyle(v as string)} options={STYLE_OPTIONS} />
              </div>
            </div>

            <Button theme="primary" block size="large" loading={loading} onClick={handleGenerate}>
              生成图像
            </Button>
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
                    正在生成中，请稍候...
                  </div>
                </div>
              ) : results.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {results.map((url, idx) => (
                    <div key={idx} className="relative rounded-lg overflow-hidden group">
                      <img src={url} alt={`result-${idx}`} className="w-full h-auto block" />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button shape="circle" size="small" icon={<DownloadIcon />} onClick={() => downloadImage(url, idx)} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[400px]" style={{ color: 'var(--td-text-color-placeholder)' }}>
                  <ImageIcon size="48px" />
                  <div className="mt-3">输入提示词，点击「生成图像」开始创作</div>
                </div>
              )}
            </div>

            {/* 历史 */}
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
                <div className="grid grid-cols-4 gap-2">
                  {history.slice(0, 8).map(h => (
                    <div
                      key={h.id}
                      className="relative rounded-lg overflow-hidden cursor-pointer"
                      style={{ backgroundColor: 'var(--td-bg-color-component)' }}
                      onClick={() => h.resultUrls[0] && setResults(h.resultUrls)}
                      title={h.prompt}
                    >
                      {h.resultUrls[0] ? (
                        <img src={h.resultUrls[0]} alt={h.prompt} className="w-full aspect-square object-cover" />
                      ) : (
                        <div className="aspect-square flex items-center justify-center text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
                          无图
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 truncate">
                        {h.model}
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
