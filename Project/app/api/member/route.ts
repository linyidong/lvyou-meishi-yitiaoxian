import { NextResponse } from 'next/server';
import { BUSINESS } from '@/config/business';
import { MEMBER_ACTION, MEMBER_SOURCE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * U10 会员自助升级（模拟开通，仅当 BUSINESS.ENABLE_REAL_PAYMENT = false 时可用）
 * POST /api/member → 写 users.member 系列字段 + member_logs 留痕
 *
 * 阶段 3 开启真实付费（收款码人工核销）后，本接口不再直接置会员，改为引导走
 * POST /api/member/orders 提交订单，避免绕过人工核销静默成功。
 *
 * member_logs 只对管理员开放 select，写入统一走 Secret Key；
 * 因此这里用 admin 客户端在服务端完成写入，前端只传「我要升级」这一个意图。
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: MESSAGES.LOGIN_FIRST }, { status: 401 });
  }

  // 阶段 3：已启用付费开通，旧的模拟自助升级接口关闭
  if (BUSINESS.ENABLE_REAL_PAYMENT) {
    return NextResponse.json(
      { ok: false, message: MESSAGES.MEMBER_ORDER.errUseOrderFlow },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { error } = await admin
      .from('users')
      .update({
        member: true,
        member_since: now,
        member_source: MEMBER_SOURCE.SELF,
        // 模拟开通（ENABLE_REAL_PAYMENT=false）视为永久会员，清空到期时间
        member_until: null,
      })
      .eq('id', user.id);
    if (error) {
      return NextResponse.json({ ok: false, message: MESSAGES.MEMBER_OP_FAILED }, { status: 500 });
    }

    await admin.from('member_logs').insert({
      target_user: user.id,
      action: MEMBER_ACTION.GRANT,
      operator_id: user.id,
      source: MEMBER_SOURCE.SELF,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.MEMBER_OP_FAILED }, { status: 500 });
  }
}
