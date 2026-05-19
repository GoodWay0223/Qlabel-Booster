import { useState, useCallback } from 'react';
import {
  Form,
  Input,
  Button,
  Tag,
  Tooltip,
  Popconfirm,
  Switch,
  MessagePlugin,
  Loading,
  Dialog,
  Divider,
} from 'tdesign-react';
import {
  AddIcon,
  EditIcon,
  DeleteIcon,
  CheckIcon,
  CloseIcon,
  CheckCircleFilledIcon,
  RefreshIcon,
} from 'tdesign-icons-react';
import { useProviders } from '../hooks/useProviders';
import { Provider, ProviderCapability, ProviderInput } from '../types/provider';

const CAPABILITY_OPTIONS: { value: ProviderCapability; label: string; desc: string; color: string }[] = [
  { value: 'chat', label: 'LLM 聊天', desc: '/v1/chat/completions', color: '#0052d9' },
  { value: 'image', label: '文生图', desc: '/v1/images/generations', color: '#a25eb5' },
  { value: 'video', label: '文生视频', desc: '/v1/videos/generations', color: '#e34d59' },
];

const PRESETS = [
  {
    name: 'OpenAI 官方',
    baseUrl: 'https://api.openai.com/v1',
    capabilities: ['chat', 'image'] as ProviderCapability[],
    chatModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    imageModels: ['dall-e-3', 'gpt-image-1'],
    videoModels: ['sora-1.0'],
  },
  {
    name: 'OneAPI / NewAPI',
    baseUrl: 'https://your-oneapi-host/v1',
    capabilities: ['chat', 'image', 'video'] as ProviderCapability[],
    chatModels: ['gpt-4o-mini', 'claude-3-5-sonnet', 'gemini-2.0-flash', 'deepseek-chat'],
    imageModels: ['dall-e-3', 'flux-pro'],
    videoModels: ['cogvideox', 'kling-v1'],
  },
  {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    capabilities: ['chat'] as ProviderCapability[],
    chatModels: ['deepseek-chat', 'deepseek-reasoner'],
    imageModels: [],
    videoModels: [],
  },
  {
    name: '通义千问 / 阿里百炼',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    capabilities: ['chat', 'image'] as ProviderCapability[],
    chatModels: ['qwen-plus', 'qwen-max', 'qwen-turbo'],
    imageModels: ['wanx-v1'],
    videoModels: [],
  },
  {
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    capabilities: ['chat', 'image', 'video'] as ProviderCapability[],
    chatModels: ['glm-4-plus', 'glm-4-flash'],
    imageModels: ['cogview-3-plus'],
    videoModels: ['cogvideox'],
  },
];

const emptyForm: ProviderInput = {
  name: '',
  baseUrl: '',
  apiKey: '',
  capabilities: ['chat'],
  chatModels: [],
  imageModels: [],
  videoModels: [],
  isDefault: false,
};

export function ProvidersPage() {
  const { providers, loading, fetchProviders, saveProvider, deleteProvider, setDefaultProvider, testProvider } = useProviders();
  const [editing, setEditing] = useState<Provider | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProviderInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string; models?: string[] } | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setTestResult(null);
    setShowForm(true);
  };

  const openEdit = (p: Provider) => {
    setEditing(p);
    setForm({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      apiKey: p.apiKeyMasked,
      capabilities: p.capabilities,
      chatModels: p.chatModels,
      imageModels: p.imageModels,
      videoModels: p.videoModels,
      isDefault: p.isDefault,
    });
    setTestResult(null);
    setShowForm(true);
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setForm(prev => ({
      ...prev,
      name: prev.name || preset.name,
      baseUrl: preset.baseUrl,
      capabilities: preset.capabilities,
      chatModels: preset.chatModels,
      imageModels: preset.imageModels,
      videoModels: preset.videoModels,
    }));
  };

  const toggleCapability = (cap: ProviderCapability) => {
    setForm(prev => {
      const has = prev.capabilities.includes(cap);
      return {
        ...prev,
        capabilities: has ? prev.capabilities.filter(c => c !== cap) : [...prev.capabilities, cap],
      };
    });
  };

  const updateModelList = (key: 'chatModels' | 'imageModels' | 'videoModels', text: string) => {
    const list = text.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
    setForm(prev => ({ ...prev, [key]: list }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.baseUrl.trim()) {
      MessagePlugin.warning('请填写名称和 Base URL');
      return;
    }
    if (!form.apiKey.trim()) {
      MessagePlugin.warning('请填写 API Key');
      return;
    }
    setSaving(true);
    try {
      await saveProvider(form);
      MessagePlugin.success(editing ? 'Provider 已更新' : 'Provider 已创建');
      setShowForm(false);
    } catch (e: any) {
      MessagePlugin.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProvider(id);
      MessagePlugin.success('已删除');
    } catch (e: any) {
      MessagePlugin.error(e?.message);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultProvider(id);
      MessagePlugin.success('已设为默认');
    } catch (e: any) {
      MessagePlugin.error(e?.message);
    }
  };

  const handleTest = useCallback(async () => {
    if (!form.baseUrl) {
      MessagePlugin.warning('请先填写 Base URL');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const params = editing && form.apiKey.includes('****')
        ? { providerId: editing.id }
        : { baseUrl: form.baseUrl, apiKey: form.apiKey };
      const result = await testProvider(params);
      setTestResult(result);
      if (result.ok) {
        MessagePlugin.success(`连通成功，发现 ${result.models?.length || 0} 个模型`);
      } else {
        MessagePlugin.warning(result.message || '连通失败');
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: e?.message });
    } finally {
      setTesting(false);
    }
  }, [form, editing, testProvider]);

  const importModelsFromTest = () => {
    if (!testResult?.models?.length) return;
    setForm(prev => ({
      ...prev,
      chatModels: prev.capabilities.includes('chat') ? testResult.models! : prev.chatModels,
    }));
    MessagePlugin.success('已导入模型清单到 Chat 列表，请按需调整');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--td-text-color-primary)' }}>
              中转站 API
            </h1>
            <p style={{ color: 'var(--td-text-color-secondary)' }}>
              接入任意 OpenAI 兼容的中转站，统一支持 LLM 聊天、文生图、文生视频
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="text" icon={<RefreshIcon />} onClick={fetchProviders} loading={loading}>
              刷新
            </Button>
            <Button theme="primary" icon={<AddIcon />} onClick={openCreate}>
              新增 Provider
            </Button>
          </div>
        </div>

        {/* 列表 */}
        {loading && providers.length === 0 ? (
          <div className="flex justify-center py-12"><Loading /></div>
        ) : providers.length === 0 ? (
          <div
            className="p-10 rounded-xl text-center"
            style={{ backgroundColor: 'var(--td-bg-color-component)' }}
          >
            <div className="text-base mb-2" style={{ color: 'var(--td-text-color-primary)' }}>
              还没有配置任何中转站
            </div>
            <div className="text-sm mb-5" style={{ color: 'var(--td-text-color-secondary)' }}>
              添加你的第一个 Provider，立刻开始使用文生图、文生视频和 LLM 聊天
            </div>
            <Button theme="primary" icon={<AddIcon />} onClick={openCreate}>
              新增 Provider
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map(p => (
              <div
                key={p.id}
                className="p-4 rounded-xl border"
                style={{
                  backgroundColor: 'var(--td-bg-color-container)',
                  borderColor: p.isDefault ? 'var(--td-brand-color)' : 'var(--td-component-border)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                        {p.name}
                      </span>
                      {p.isDefault && (
                        <Tag theme="primary" variant="light" size="small">默认</Tag>
                      )}
                    </div>
                    <div className="text-xs font-mono mb-2" style={{ color: 'var(--td-text-color-secondary)' }}>
                      {p.baseUrl}
                    </div>
                    <div className="text-xs font-mono mb-3" style={{ color: 'var(--td-text-color-placeholder)' }}>
                      {p.apiKeyMasked}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {p.capabilities.map(c => {
                        const opt = CAPABILITY_OPTIONS.find(o => o.value === c);
                        return (
                          <Tag key={c} size="small" style={{ backgroundColor: opt?.color, color: '#fff', borderColor: opt?.color }}>
                            {opt?.label || c}
                          </Tag>
                        );
                      })}
                    </div>
                    <div className="text-xs space-y-1" style={{ color: 'var(--td-text-color-secondary)' }}>
                      {p.chatModels.length > 0 && <div>聊天模型：{p.chatModels.join('、')}</div>}
                      {p.imageModels.length > 0 && <div>图像模型：{p.imageModels.join('、')}</div>}
                      {p.videoModels.length > 0 && <div>视频模型：{p.videoModels.join('、')}</div>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {!p.isDefault && (
                      <Button size="small" variant="outline" onClick={() => handleSetDefault(p.id)}>
                        设为默认
                      </Button>
                    )}
                    <div className="flex gap-1">
                      <Tooltip content="编辑">
                        <Button variant="text" shape="circle" size="small" icon={<EditIcon />} onClick={() => openEdit(p)} />
                      </Tooltip>
                      <Popconfirm content="确定删除此 Provider 吗？" onConfirm={() => handleDelete(p.id)}>
                        <Tooltip content="删除">
                          <Button variant="text" shape="circle" size="small" icon={<DeleteIcon />} />
                        </Tooltip>
                      </Popconfirm>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 编辑/创建对话框 */}
      <Dialog
        visible={showForm}
        onClose={() => setShowForm(false)}
        header={editing ? '编辑 Provider' : '新增 Provider'}
        width={680}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>取消</Button>
            <Button variant="outline" loading={testing} onClick={handleTest}>
              测试连通性
            </Button>
            <Button theme="primary" loading={saving} onClick={handleSave}>
              {editing ? '保存' : '创建'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* 预设 */}
          <div>
            <div className="text-sm mb-2" style={{ color: 'var(--td-text-color-secondary)' }}>
              快速填充常见服务
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => (
                <Button key={p.name} size="small" variant="outline" onClick={() => applyPreset(p)}>
                  {p.name}
                </Button>
              ))}
            </div>
          </div>

          <Divider />

          <Form labelAlign="top">
            <Form.FormItem label="名称" requiredMark>
              <Input
                value={form.name}
                onChange={(v) => setForm(prev => ({ ...prev, name: v as string }))}
                placeholder="例如：我的 OneAPI"
              />
            </Form.FormItem>

            <Form.FormItem label="Base URL" requiredMark>
              <Input
                value={form.baseUrl}
                onChange={(v) => setForm(prev => ({ ...prev, baseUrl: v as string }))}
                placeholder="https://api.example.com/v1"
              />
            </Form.FormItem>

            <Form.FormItem label="API Key" requiredMark>
              <Input
                type="password"
                value={form.apiKey}
                onChange={(v) => setForm(prev => ({ ...prev, apiKey: v as string }))}
                placeholder="sk-..."
              />
              {editing && (
                <div className="text-xs mt-1" style={{ color: 'var(--td-text-color-placeholder)' }}>
                  保留脱敏值（含 ****）则不更新密钥
                </div>
              )}
            </Form.FormItem>

            <Form.FormItem label="支持能力">
              <div className="flex flex-wrap gap-2">
                {CAPABILITY_OPTIONS.map(opt => {
                  const active = form.capabilities.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleCapability(opt.value)}
                      className="px-3 py-2 rounded-lg text-sm flex flex-col items-start transition-all border-2"
                      style={{
                        borderColor: active ? opt.color : 'var(--td-component-border)',
                        backgroundColor: active ? opt.color : 'transparent',
                        color: active ? '#fff' : 'var(--td-text-color-secondary)',
                      }}
                    >
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-xs opacity-80">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </Form.FormItem>

            {form.capabilities.includes('chat') && (
              <Form.FormItem label="聊天模型 (chat models)">
                <Input
                  value={form.chatModels.join(', ')}
                  onChange={(v) => updateModelList('chatModels', v as string)}
                  placeholder="逗号或换行分隔，如 gpt-4o-mini, claude-3-5-sonnet"
                />
              </Form.FormItem>
            )}

            {form.capabilities.includes('image') && (
              <Form.FormItem label="图像模型 (image models)">
                <Input
                  value={form.imageModels.join(', ')}
                  onChange={(v) => updateModelList('imageModels', v as string)}
                  placeholder="如 dall-e-3, flux-pro, sd3"
                />
              </Form.FormItem>
            )}

            {form.capabilities.includes('video') && (
              <Form.FormItem label="视频模型 (video models)">
                <Input
                  value={form.videoModels.join(', ')}
                  onChange={(v) => updateModelList('videoModels', v as string)}
                  placeholder="如 sora-1.0, kling-v1, cogvideox"
                />
              </Form.FormItem>
            )}

            <Form.FormItem label="设为默认 Provider">
              <Switch
                value={form.isDefault}
                onChange={(v) => setForm(prev => ({ ...prev, isDefault: v }))}
              />
            </Form.FormItem>
          </Form>

          {/* 测试结果 */}
          {testResult && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{
                backgroundColor: testResult.ok ? 'var(--td-success-color-light)' : 'var(--td-error-color-light)',
                color: 'var(--td-text-color-primary)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {testResult.ok ? (
                  <CheckCircleFilledIcon style={{ color: 'var(--td-success-color)' }} />
                ) : (
                  <CloseIcon style={{ color: 'var(--td-error-color)' }} />
                )}
                <span className="font-medium">
                  {testResult.ok ? '连通成功' : '连通失败'}
                </span>
              </div>
              {testResult.message && (
                <div className="text-xs font-mono break-all">{testResult.message}</div>
              )}
              {testResult.models && testResult.models.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs mb-1">检测到 {testResult.models.length} 个模型：</div>
                  <div className="text-xs font-mono break-all max-h-32 overflow-y-auto">
                    {testResult.models.slice(0, 30).join(', ')}
                    {testResult.models.length > 30 ? '...' : ''}
                  </div>
                  <Button size="small" variant="outline" className="mt-2" icon={<CheckIcon />} onClick={importModelsFromTest}>
                    导入到模型列表
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
