/**
 * 中转站 API 提供商管理
 *
 * 用于管理用户接入的各种「中转站」/「OpenAI 兼容」API 服务，
 * 例如 OpenAI 官方、One-API、New-API、各种聚合平台等。
 *
 * 每个 Provider 包含：
 *   - baseUrl：API 基础地址（OpenAI 兼容格式，如 https://api.openai.com/v1）
 *   - apiKey：API 密钥
 *   - capabilities：该 Provider 支持的能力（chat / image / video）
 *   - models：用户配置的可用模型清单
 */

import db from './db.js';

// 自检并初始化中转站 Provider 表
db.exec(`
  CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    capabilities TEXT NOT NULL DEFAULT '["chat"]',
    chat_models TEXT NOT NULL DEFAULT '[]',
    image_models TEXT NOT NULL DEFAULT '[]',
    video_models TEXT NOT NULL DEFAULT '[]',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('image', 'video')),
    provider_id TEXT,
    model TEXT NOT NULL,
    prompt TEXT NOT NULL,
    params TEXT,
    result_urls TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    error TEXT,
    created_at TEXT NOT NULL
  );
`);

export type Capability = 'chat' | 'image' | 'video';

export interface DbProvider {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  capabilities: string; // JSON array
  chat_models: string; // JSON array
  image_models: string;
  video_models: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface ProviderInput {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  capabilities: Capability[];
  chatModels: string[];
  imageModels: string[];
  videoModels: string[];
  isDefault?: boolean;
}

export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  capabilities: Capability[];
  chatModels: string[];
  imageModels: string[];
  videoModels: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

function rowToProvider(row: DbProvider): Provider {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    apiKey: row.api_key,
    capabilities: safeParse(row.capabilities, ['chat']),
    chatModels: safeParse(row.chat_models, []),
    imageModels: safeParse(row.image_models, []),
    videoModels: safeParse(row.video_models, []),
    isDefault: !!row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

export function getAllProviders(): Provider[] {
  const rows = db.prepare('SELECT * FROM providers ORDER BY created_at ASC').all() as DbProvider[];
  return rows.map(rowToProvider);
}

export function getProvider(id: string): Provider | undefined {
  const row = db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as DbProvider | undefined;
  return row ? rowToProvider(row) : undefined;
}

export function getDefaultProvider(): Provider | undefined {
  const row = db.prepare('SELECT * FROM providers WHERE is_default = 1 LIMIT 1').get() as DbProvider | undefined;
  if (row) return rowToProvider(row);
  // fallback：第一个
  const first = db.prepare('SELECT * FROM providers ORDER BY created_at ASC LIMIT 1').get() as DbProvider | undefined;
  return first ? rowToProvider(first) : undefined;
}

export function upsertProvider(input: ProviderInput): Provider {
  const now = new Date().toISOString();
  const existing = getProvider(input.id);

  if (input.isDefault) {
    db.prepare('UPDATE providers SET is_default = 0').run();
  }

  if (existing) {
    db.prepare(`
      UPDATE providers SET
        name = ?, base_url = ?, api_key = ?,
        capabilities = ?, chat_models = ?, image_models = ?, video_models = ?,
        is_default = ?, updated_at = ?
      WHERE id = ?
    `).run(
      input.name,
      input.baseUrl,
      input.apiKey,
      JSON.stringify(input.capabilities),
      JSON.stringify(input.chatModels),
      JSON.stringify(input.imageModels),
      JSON.stringify(input.videoModels),
      input.isDefault ? 1 : 0,
      now,
      input.id
    );
  } else {
    db.prepare(`
      INSERT INTO providers (id, name, base_url, api_key, capabilities, chat_models, image_models, video_models, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.name,
      input.baseUrl,
      input.apiKey,
      JSON.stringify(input.capabilities),
      JSON.stringify(input.chatModels),
      JSON.stringify(input.imageModels),
      JSON.stringify(input.videoModels),
      input.isDefault ? 1 : 0,
      now,
      now
    );
  }

  return getProvider(input.id)!;
}

export function deleteProvider(id: string): boolean {
  const r = db.prepare('DELETE FROM providers WHERE id = ?').run(id);
  return r.changes > 0;
}

export function setDefaultProvider(id: string): boolean {
  const exists = getProvider(id);
  if (!exists) return false;
  db.prepare('UPDATE providers SET is_default = 0').run();
  db.prepare('UPDATE providers SET is_default = 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  return true;
}

// ============= Generation history =============

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

export function addGeneration(rec: Omit<GenerationRecord, 'createdAt'> & { createdAt?: string }): GenerationRecord {
  const createdAt = rec.createdAt || new Date().toISOString();
  db.prepare(`
    INSERT INTO generations (id, type, provider_id, model, prompt, params, result_urls, status, error, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    rec.id,
    rec.type,
    rec.providerId,
    rec.model,
    rec.prompt,
    rec.params ? JSON.stringify(rec.params) : null,
    JSON.stringify(rec.resultUrls),
    rec.status,
    rec.error,
    createdAt
  );
  return { ...rec, createdAt };
}

export function listGenerations(type?: 'image' | 'video', limit = 50): GenerationRecord[] {
  const rows = type
    ? db.prepare('SELECT * FROM generations WHERE type = ? ORDER BY created_at DESC LIMIT ?').all(type, limit) as any[]
    : db.prepare('SELECT * FROM generations ORDER BY created_at DESC LIMIT ?').all(limit) as any[];

  return rows.map(r => ({
    id: r.id,
    type: r.type,
    providerId: r.provider_id,
    model: r.model,
    prompt: r.prompt,
    params: safeParse(r.params, null as any),
    resultUrls: safeParse(r.result_urls, [] as string[]),
    status: r.status,
    error: r.error,
    createdAt: r.created_at,
  }));
}
