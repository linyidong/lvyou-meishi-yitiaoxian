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

/**
 * T-067 删除路线（硬删除）
 * DELETE /api/routes/[id] → 仅本人路线可删；route_places / route_shares 由外键 ON DELETE CASCADE 级联
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: '请先登录' }, { status: 401 });
  }

  // 先按 id + user_id 查存在：不存在或非本人都统一 404，不泄露他人数据
  const { data: route } = await supabase
    .from('routes')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!route) {
    return NextResponse.json({ ok: false, message: '路线不存在' }, { status: 404 });
  }

  // 用户态 client 删除（RLS routes_delete_own 已存在），不用 service_role
  const { error } = await supabase.from('routes').delete().eq('id', route.id).eq('user_id', user.id);
  if (error) {
    return NextResponse.json({ ok: false, message: MESSAGES.NETWORK_ERROR }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
