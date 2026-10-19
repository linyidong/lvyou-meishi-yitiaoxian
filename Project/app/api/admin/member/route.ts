import { NextResponse, type NextRequest } from 'next/server';
import { MEMBER_ACTION, MEMBER_SOURCE, USER_ROLE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * A03 管理端会员操作（开通 / 取消）
 * POST /api/admin/member → 写目标用户 users.member 系列字段 + member_logs 留痕
 *
 * 服务端二次校验 role=admin；member_logs 无 insert 策略，写入必须用 Secret Key。
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: '请先登录' }, { status: 401 });
  }

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== USER_ROLE.ADMIN) {
    return NextResponse.json({ ok: false, message: MESSAGES.FORBIDDEN }, { status: 403 });
  }

  let body: { userId?: unknown; grant?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const userId = typeof body.userId === 'string' ? body.userId : '';
  if (!userId || typeof body.grant !== 'boolean') {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: target } = await admin
      .from('users')
      .select('id,role')
      .eq('id', userId)
      .maybeSingle();
    if (!target) {
      return NextResponse.json({ ok: false, message: '用户不存在' }, { status: 404 });
    }
    // 管理员默认最高级会员（015 触发器），不允许通过本接口开通或取消
    if (target.role === USER_ROLE.ADMIN) {
      return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_MEMBER_FIXED }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await admin
      .from('users')
      .update({
        member: body.grant,
        member_since: body.grant ? now : null,
        // 取消会员后回到普通用户，来源一并清空
        member_source: body.grant ? MEMBER_SOURCE.ADMIN : null,
        // 管理员开通一律为永久会员（清空到期时间，避免继承此前的付费到期时间）
        member_until: null,
      })
      .eq('id', userId);
    if (error) {
      return NextResponse.json({ ok: false, message: MESSAGES.MEMBER_OP_FAILED }, { status: 500 });
    }

    await admin.from('member_logs').insert({
      target_user: userId,
      action: body.grant ? MEMBER_ACTION.GRANT : MEMBER_ACTION.REVOKE,
      operator_id: user.id,
      source: MEMBER_SOURCE.ADMIN,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.MEMBER_OP_FAILED }, { status: 500 });
  }
}
