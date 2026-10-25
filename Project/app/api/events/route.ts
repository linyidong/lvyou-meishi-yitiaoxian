import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EVENT_NAME } from '@/config/enums';
import type { EventName } from '@/types';

/**
 * 埋点写入（T-062）：改成同源 API，由服务端写库。
 *
 * 背景：原先前端直接 `createBrowserClient(NEXT_PUBLIC_SUPABASE_URL)` 写 events，
 * 在「应用跑在 Windows、手机通过局域网 IP 访问」的场景下，手机浏览器会把
 * 127.0.0.1:8000 指向手机自己 → 埋点静默失败。改为 POST /api/events 后，
 * 浏览器只访问同源地址，Supabase 连接始终由服务端发起。
 *
 * 行为：未登录直接 204（埋点不阻断、不报错）；写入失败同样 204。
 */
const ALLOWED = new Set<string>(Object.values(EVENT_NAME));

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { eventName?: unknown; metadata?: unknown };
    const eventName = typeof body.eventName === 'string' ? body.eventName : '';
    if (!ALLOWED.has(eventName)) {
      return new NextResponse(null, { status: 204 });
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return new NextResponse(null, { status: 204 });

    const metadata =
      body.metadata && typeof body.metadata === 'object' ? (body.metadata as Record<string, unknown>) : null;

    await supabase.from('events').insert({
      user_id: user.id,
      event_name: eventName as EventName,
      metadata,
    });
  } catch {
    // 埋点失败不影响主流程
  }
  return new NextResponse(null, { status: 204 });
}
