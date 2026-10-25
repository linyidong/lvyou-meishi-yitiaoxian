import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings, LlmProvider } from '@/lib/app-settings';

/**
 * T-057 lib/llm.ts chatJson 单测：主模型成功 / 失败切备用 / 双失败报错带两次原因 /
 * 备用未启用时明确失败。getAppSettings 与 ENV 均 mock，fetch 用 vi.fn 伪造。
 */

vi.mock('@/config/env', () => ({ ENV: { DEEPSEEK_API_KEY: 'env-test-key' } }));

const h = vi.hoisted(() => ({
  settings: null as AppSettings | null,
}));

vi.mock('@/lib/app-settings', () => ({
  getAppSettings: async () => h.settings,
}));

import { chatJson } from '@/lib/llm';

function provider(over: Partial<LlmProvider>): LlmProvider {
  return { label: 'P', baseUrl: 'https://p.example.com', model: 'm', apiKey: 'sk-p', enabled: true, ...over };
}

function makeSettings(primary: LlmProvider, fallback: LlmProvider | null): void {
  h.settings = {
    ai: { primary, fallback, ocrAction: 'GeneralBasicOCR', ocrRegion: 'ap-guangzhou' },
    flags: { billingEnabled: true, ocrEnabled: true, importEnabled: true },
    quotas: {
      freePlacesPerDay: 1,
      memberPlacesPerDay: 1,
      memberMonthlyRoutes: 1,
      freeAiExtractPerDay: 1,
      memberAiExtractPerDay: 1,
      ocrDailyLimit: 1,
    },
    ocrMonthlyQuota: 1,
  };
}

/** 伪造 OpenAI 兼容响应 */
function jsonResponse(content: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => (content === undefined ? content : { choices: [{ message: { content: JSON.stringify(content) } }] }),
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('chatJson 主模型', () => {
  it('主模型成功：一次调用、返回 provider=primary、Authorization 用 provider Key', async () => {
    makeSettings(provider({}), null);
    fetchMock.mockResolvedValue(jsonResponse({ city: '成都' }));
    const r = await chatJson<{ city: string }>({ system: 's', user: 'u' });
    expect(r.provider).toBe('primary');
    expect(r.data.city).toBe('成都');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://p.example.com/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-p');
  });

  it('provider.apiKey 为空时回落环境变量 Key', async () => {
    makeSettings(provider({ apiKey: '' }), null);
    fetchMock.mockResolvedValue(jsonResponse({}));
    await chatJson({ system: 's', user: 'u' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer env-test-key');
  });
});

describe('chatJson 自动兜底', () => {
  it('主模型 HTTP 500 → 自动重试备用一次，provider=fallback 且有切换告警', async () => {
    makeSettings(provider({}), provider({ label: 'F', baseUrl: 'https://f.example.com', model: 'fm', apiKey: 'sk-f' }));
    fetchMock
      .mockResolvedValueOnce(jsonResponse(undefined, false, 500))
      .mockResolvedValueOnce(jsonResponse({ city: '杭州' }));
    const r = await chatJson<{ city: string }>({ system: 's', user: 'u' });
    expect(r.provider).toBe('fallback');
    expect(r.data.city).toBe('杭州');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://f.example.com/chat/completions');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[llm] primary 失败，已切备用'));
  });

  it('主模型返回非 JSON → 兜底成功', async () => {
    makeSettings(provider({}), provider({ baseUrl: 'https://f.example.com' }));
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '不是JSON' } }] }) } as unknown as Response)
      .mockResolvedValueOnce(jsonResponse({ city: 'X' }));
    const r = await chatJson<{ city: string }>({ system: 's', user: 'u' });
    expect(r.provider).toBe('fallback');
  });

  it('主模型网络错误 + 备用也失败 → 抛错含两次原因', async () => {
    makeSettings(provider({}), provider({ baseUrl: 'https://f.example.com' }));
    fetchMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse(undefined, false, 401));
    let msg = '';
    await chatJson({ system: 's', user: 'u' }).catch((e) => {
      msg = (e as Error).message;
    });
    expect(msg).toMatch(/主模型失败.*备用模型也失败/);
    expect(msg).toContain('fetch failed');
    expect(msg).toContain('HTTP 401');
  });

  it('备用未启用 / 未配置 → 主失败后明确报错（不静默）', async () => {
    makeSettings(provider({}), provider({ baseUrl: 'https://f.example.com', enabled: false }));
    fetchMock.mockResolvedValue(jsonResponse(undefined, false, 503));
    await expect(chatJson({ system: 's', user: 'u' })).rejects.toThrow('备用模型未启用或配置不完整');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('主模型超时（AbortError）→ 原因记为请求超时', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    makeSettings(provider({}), provider({ baseUrl: 'https://f.example.com' }));
    fetchMock.mockRejectedValueOnce(abort).mockResolvedValueOnce(jsonResponse({ ok: 1 }));
    const r = await chatJson<{ ok: number }>({ system: 's', user: 'u' });
    expect(r.provider).toBe('fallback');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('请求超时（45 秒）'));
  });
});
