import { NextResponse } from 'next/server';
import { ORDER_STATUS, USER_ROLE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * A08 管理端「待核销订单数量」
 * GET /api/admin/member/orders/pending-count → { ok, pending }
 *
 * 供管理端侧栏 / 移动端底栏的红色角标使用：只做一次 count 查询（head: true，不取行数据），
 * 比拉整个订单列表轻得多。服务端二次校验 role=admin；member_orders 没有管理端读策略，
 * 因此固定走 service_role。
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
      .from('member_orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', ORDER_STATUS.PENDING);
    if (error) throw error;

    return NextResponse.json({ ok: true, pending: count ?? 0 });
  } catch {
    // 角标只是提醒，查询失败按 0 处理，不把整个管理端页面拖下水
    return NextResponse.json({ ok: true, pending: 0 });
  }
}
