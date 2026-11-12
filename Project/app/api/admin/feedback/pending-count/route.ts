import { NextResponse } from 'next/server';
import { USER_ROLE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * T-103 管理端「未读功能建议数量」
 * GET /api/admin/feedback/pending-count → { ok, pending }
 * 只统计 hidden_by_admin=false 且 status='new' 的建议，供后台侧栏红色角标使用。
 */
export async function GET() {
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
  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from('feedback')
      .select('id', { count: 'exact', head: true })
      .eq('hidden_by_admin', false)
      .eq('status', 'new');
    if (error) throw error;
    return NextResponse.json({ ok: true, pending: count ?? 0 });
  } catch {
    return NextResponse.json({ ok: true, pending: 0 });
  }
}
