import { useCallback, useEffect, useState } from 'react';
import { Provider, ProviderInput } from '../types/provider';

export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/providers');
      const data = await resp.json();
      setProviders(data.providers || []);
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const saveProvider = useCallback(async (input: ProviderInput) => {
    const resp = await fetch('/api/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || '保存失败');
    await fetchProviders();
    return data.provider as Provider;
  }, [fetchProviders]);

  const deleteProvider = useCallback(async (id: string) => {
    const resp = await fetch(`/api/providers/${id}`, { method: 'DELETE' });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || '删除失败');
    await fetchProviders();
  }, [fetchProviders]);

  const setDefaultProvider = useCallback(async (id: string) => {
    const resp = await fetch(`/api/providers/${id}/default`, { method: 'POST' });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || '设置失败');
    await fetchProviders();
  }, [fetchProviders]);

  const testProvider = useCallback(async (params: { providerId?: string; baseUrl?: string; apiKey?: string }) => {
    const resp = await fetch('/api/providers/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return resp.json() as Promise<{ ok: boolean; status?: number; message?: string; models?: string[] }>;
  }, []);

  return {
    providers,
    loading,
    error,
    fetchProviders,
    saveProvider,
    deleteProvider,
    setDefaultProvider,
    testProvider,
  };
}
