import { NextResponse } from 'next/server';
import { USER_ROLE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { createClient } from '@/lib/supabase/server';

/**
 * T-028 会员状态实时同步（轻量只读，供用户端 MemberStatusSync 轮询）
 * GET /api/member/status → { ok: true, member, memberUntil, role }
 *
 * 只返回本人 users 行的三个字段（RLS 下 authenticated 本就可读自己），
 * 未登录一律 401；响应显式 no-store，避免 Next fetch 缓存读到旧身份。
 * 管理员开通 / 取消会员（app/api/admin/member）后，本接口下一次轮询即可反映新状态，
 * 客户端据此 router.refresh() 让服务端按新身份重渲染（顶部徽标 / 会员卡 / 配额提示）。
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: MESSAGES.LOGIN_FIRST }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('users')
    .select('member,member_until,role')
    .eq('id', user.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { ok: false, message: MESSAGES.MEMBER_ORDER.errLoadFailed },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      member: data?.member ?? false,
      memberUntil: data?.member_until ?? null,
      role: data?.role ?? USER_ROLE.USER,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
