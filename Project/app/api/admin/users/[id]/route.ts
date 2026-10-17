import { NextResponse, type NextRequest } from 'next/server';
import { USER_ROLE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * A03 管理端删除用户账号
 * DELETE /api/admin/users/[id] → 删除 auth.users 记录（账号无法再登录）
 *
 * 删除 auth.users 会级联清掉 public.users 及其名下的地点、路线、导入与埋点记录。
 * 限制：仅管理员可调用；且只能删 role=user 的普通用户，不能删管理员，也不能删自己。
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: '请先登录' }, { status: 401 });
  }

  // 服务端二次校验管理员身份（/api 不在 middleware 守卫范围内）
  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== USER_ROLE.ADMIN) {
    return NextResponse.json({ ok: false, message: MESSAGES.FORBIDDEN }, { status: 403 });
  }

  const targetId = params.id;
  if (!targetId) {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }
  if (targetId === user.id) {
    return NextResponse.json({ ok: false, message: MESSAGES.USER_DELETE_FORBIDDEN }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: target } = await admin
      .from('users')
      .select('id, role')
      .eq('id', targetId)
      .maybeSingle();
    if (!target) {
      return NextResponse.json({ ok: false, message: '用户不存在' }, { status: 404 });
    }
    // 管理员账号不允许删除（含自己），避免把后台锁死
    if (target.role !== USER_ROLE.USER) {
      return NextResponse.json({ ok: false, message: MESSAGES.USER_DELETE_FORBIDDEN }, { status: 400 });
    }

    const { error } = await admin.auth.admin.deleteUser(targetId);
    if (error) {
      return NextResponse.json({ ok: false, message: MESSAGES.USER_DELETE_FAILED }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: MESSAGES.USER_DELETED });
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.USER_DELETE_FAILED }, { status: 500 });
  }
}
