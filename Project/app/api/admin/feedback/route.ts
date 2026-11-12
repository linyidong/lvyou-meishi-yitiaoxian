import { NextResponse, type NextRequest } from 'next/server';
import { USER_ROLE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const STATUSES = ['new', 'read', 'done'];

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, message: MESSAGES.LOGIN_FIRST };
  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== USER_ROLE.ADMIN) {
    return { ok: false as const, status: 403, message: MESSAGES.FORBIDDEN };
  }
  return { ok: true as const };
}

/** 意见箱列表（管理员） */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status });
  }
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from('feedback')
    .select('id,user_id,page_key,feature_key,content,status,admin_note,created_at,updated_at')
    .eq('hidden_by_admin', false)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_FEEDBACK.loadFailed }, { status: 500 });
  }
  return NextResponse.json({ ok: true, items: rows ?? [] });
}

/** 更新状态 / 后台备注（管理员） */
export async function PATCH(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.status === 'string') {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (typeof body.adminNote === 'string') {
    patch.admin_note = body.adminNote.trim().slice(0, 500) || null;
  }
  // 后台清理：软删除，只从意见箱隐藏，不影响用户自己的「我最近提交」
  if (typeof body.hidden === 'boolean') {
    patch.hidden_by_admin = body.hidden;
  }
  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('feedback').update(patch).eq('id', id);
  if (error) {
    return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_FEEDBACK.loadFailed }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
