import { NextResponse, type NextRequest } from 'next/server';
import { ENV } from '@/config/env';
import { USER_ROLE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { getAppSettings } from '@/lib/app-settings';
import { createClient } from '@/lib/supabase/server';

/**
 * T-057 管理端「测试连接」：POST /api/admin/settings/test-llm { which: 'primary' | 'fallback' }
 * 服务端按已保存的配置向对应模型发一条 8 token 的 ping（OpenAI 兼容 /chat/completions），
 * 返回 { ok, ms, provider, error? }；仅 role=admin 可访问；Key 不出服务端、不写日志。
 */

/** ping 超时（毫秒）：比正式调用（45s）短，保证后台按钮反馈及时 */
const PING_TIMEOUT_MS = 20_000;

/** 管理员身份校验（与 /api/admin/settings 同一口径） */
async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: MESSAGES.LOGIN_FIRST }, { status: 401 });
  }
  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== USER_ROLE.ADMIN) {
    return NextResponse.json({ ok: false, message: MESSAGES.FORBIDDEN }, { status: 403 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }
  const which = (raw as { which?: unknown })?.which;
  if (which !== 'primary' && which !== 'fallback') {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const settings = await getAppSettings();
  const p = which === 'primary' ? settings.ai.primary : settings.ai.fallback;
  if (!p || !p.baseUrl.trim() || !p.model.trim()) {
    return NextResponse.json({
      ok: false,
      ms: 0,
      provider: which,
      error: which === 'primary' ? '主模型未配置' : MESSAGES.ADMIN_SETTINGS.errFallbackMissing,
    });
  }
  const key = (p.apiKey || ENV.DEEPSEEK_API_KEY || '').trim();
  if (!key) {
    return NextResponse.json({ ok: false, ms: 0, provider: which, error: MESSAGES.ADMIN_SETTINGS.errMissingKey });
  }

  const url = `${p.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PING_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: p.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 8,
      }),
      signal: ac.signal,
      cache: 'no-store',
    });
    const ms = Date.now() - startedAt;
    if (!res.ok) {
      return NextResponse.json({ ok: false, ms, provider: which, error: `HTTP ${res.status}` });
    }
    // 读掉响应体，确认链路可用（不记录内容，避免任何潜在敏感信息进日志）
    await res.json().catch(() => undefined);
    return NextResponse.json({ ok: true, ms, provider: which });
  } catch (err) {
    const ms = Date.now() - startedAt;
    const e = err as Error;
    const error = e.name === 'AbortError' ? `请求超时（${PING_TIMEOUT_MS / 1000} 秒）` : e.message;
    return NextResponse.json({ ok: false, ms, provider: which, error });
  } finally {
    clearTimeout(timer);
  }
}
