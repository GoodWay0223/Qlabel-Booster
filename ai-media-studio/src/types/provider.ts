/**
 * 中转站 Provider 相关类型
 */

export type ProviderCapability = 'chat' | 'image' | 'video';

export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;          // 已脱敏 (****)
  apiKeyMasked: string;
  capabilities: ProviderCapability[];
  chatModels: string[];
  imageModels: string[];
  videoModels: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderInput {
  id?: string;
  name: string;
  baseUrl: string;
  apiKey: string;          // 创建时为明文，更新时若无变更可传脱敏值
  capabilities: ProviderCapability[];
  chatModels: string[];
  imageModels: string[];
  videoModels: string[];
  isDefault?: boolean;
}

export interface GenerationRecord {
  id: string;
  type: 'image' | 'video';
  providerId: string | null;
  model: string;
  prompt: string;
  params: Record<string, unknown> | null;
  resultUrls: string[];
  status: 'pending' | 'completed' | 'failed';
  error: string | null;
  createdAt: string;
}
