import { ENV } from '@/config/env';
import { getAppSettings, type LlmProvider } from '@/lib/app-settings';

/**
 * T-057 大模型调用统一入口（OpenAI 兼容 /chat/completions，仅用 fetch，不引 SDK）：
 * - chatJson 先用 primary（45 秒超时），失败（网络 / 非 2xx / 超时 / 返回非合法 JSON）时，
 *   若 fallback 已启用且配置完整，自动重试一次备用模型；
 * - 成功返回 { data, provider: 'primary' | 'fallback' }；全失败抛错（错误信息含两次失败原因）；
 * - 切备用时 console.warn 记录告警（只记原因，绝不输出 Key）。
 */

/** 单次请求超时（毫秒） */
const TIMEOUT_MS = 45_000;

export type LlmProviderKind = 'primary' | 'fallback';

export interface ChatJsonResult<T> {
  data: T;
  provider: LlmProviderKind;
}

/** apiKey 为空时回落环境变量（与 LlmProvider 注释口径一致） */
function resolveKey(p: LlmProvider): string {
  return (p.apiKey || ENV.DEEPSEEK_API_KEY || '').trim();
}

/** provider 是否配置完整且启用（baseUrl + model 齐全才算可用） */
function isUsable(p: LlmProvider | null): p is LlmProvider {
  return !!p && p.enabled && !!p.baseUrl.trim() && !!p.model.trim();
}

/** 从 unknown 错误取可读原因 */
function errReason(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError' || /abort/i.test(err.message)) return '请求超时（45 秒）';
    return err.message;
  }
  return String(err);
}

/** 单次调用：POST {baseUrl}/chat/completions，返回解析后的 JSON 对象；失败抛可读原因 */
async function callOnce<T>(p: LlmProvider, system: string, user: string): Promise<T> {
  const key = resolveKey(p);
  if (!key) throw new Error(`${p.label || '模型'} 缺少 API Key`);
  const url = `${p.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: p.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
      signal: ac.signal,
      cache: 'no-store',
    });
  } catch (err) {
    throw new Error(errReason(err));
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  let content = '';
  try {
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    content = data.choices?.[0]?.message?.content ?? '';
  } catch {
    throw new Error('响应体不是合法 JSON');
  }
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error('模型返回内容不是合法 JSON');
  }
}

/**
 * JSON 模式对话（提取类请求统一入口）：主模型失败自动兜底备用一次；
 * 全失败抛错，错误信息带上两次失败原因，便于排查。
 */
export async function chatJson<T>({ system, user }: { system: string; user: string }): Promise<ChatJsonResult<T>> {
  const { primary, fallback } = (await getAppSettings()).ai;

  const primaryEnabled = primary.enabled;
  let primaryErr = '';
  if (isUsable(primary)) {
    try {
      const data = await callOnce<T>(primary, system, user);
      return { data, provider: 'primary' };
    } catch (err) {
      primaryErr = errReason(err);
    }
  } else {
    primaryErr = primaryEnabled ? '主模型配置不完整（Base URL / 模型名）' : '主模型已停用';
  }

  if (isUsable(fallback)) {
    console.warn(`[llm] primary 失败，已切备用：${primaryErr}`);
    try {
      const data = await callOnce<T>(fallback, system, user);
      return { data, provider: 'fallback' };
    } catch (err) {
      throw new Error(`主模型失败（${primaryErr}）；备用模型也失败（${errReason(err)}）`);
    }
  }
  throw new Error(`主模型失败（${primaryErr}）；备用模型未启用或配置不完整`);
}
