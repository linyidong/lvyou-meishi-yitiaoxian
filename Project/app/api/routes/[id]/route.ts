import { NextResponse, type NextRequest } from 'next/server';
import { MESSAGES } from '@/config/messages';
import { createClient } from '@/lib/supabase/server';
import { parseTripSettings } from '@/lib/route-settings';

/**
 * U08 路线编辑页保存出行设置
 * PATCH /api/routes/[id] → 仅更新 routes 的出行设置六列
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: '请先登录' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const parsed = parseTripSettings(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 });
  }

  const { data: route } = await supabase
    .from('routes')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!route) {
    return NextResponse.json({ ok: false, message: '路线不存在' }, { status: 404 });
  }

  const { error } = await supabase
    .from('routes')
    .update(parsed.value)
    .eq('id', route.id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ ok: false, message: MESSAGES.NETWORK_ERROR }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
