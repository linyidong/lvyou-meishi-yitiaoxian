import { NextResponse } from 'next/server';
import { MESSAGES } from '@/config/messages';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * 阶段 3 会员付费订单·状态轮询（A 半自动链路）
 * GET /api/member/orders/status → { ok, order, member }
 *
 * 收银台提交订单后弹窗进入「等待到账确认」态，前端按固定间隔轮询本接口；
 * 管理员在后台核对流水并核销后，前端即可感知并自动关闭弹窗、提示开通成功。
 *
 * 只读最近一条订单（limit 1）+ 本人会员状态，比拉整个订单列表轻得多，
 * 适合高频轮询。members 字段含惰性到期判定（member_until 为空视为永久）。
 */

/** 会员是否仍在有效期内（惰性判定，与 lib/member-quota.ts 口径一致） */
function isMemberActive(member: boolean | null, memberUntil: string | null): boolean {
  if (member !== true) return false;
  if (!memberUntil) return true;
  return new Date(memberUntil).getTime() > Date.now();
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: MESSAGES.LOGIN_FIRST }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const [orderRes, userRes] = await Promise.all([
      admin
        .from('member_orders')
        .select('id,plan,amount_cents,pay_channel,status,reject_reason,created_at,reviewed_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin.from('users').select('member,member_until').eq('id', user.id).maybeSingle(),
    ]);
    if (orderRes.error || userRes.error) {
      return NextResponse.json({ ok: false, message: MESSAGES.MEMBER_ORDER.errLoadFailed }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      order: orderRes.data ?? null,
      member: isMemberActive(userRes.data?.member ?? null, userRes.data?.member_until ?? null),
      memberUntil: userRes.data?.member_until ?? null,
    });
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.MEMBER_ORDER.errLoadFailed }, { status: 500 });
  }
}
