import { NextResponse, type NextRequest } from 'next/server';
import { USER_ROLE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRedirect } from '@/lib/utils';

/**
 * U01 / A01 登录（邮箱 + 密码），走 Supabase Auth。
 * POST /api/auth/login
 * body: { email, password, admin?, redirect? }
 *
 * admin=true 时（管理端登录）额外校验 users.role=admin，非管理员会立即登出并返回提示，
 * 避免普通用户拿到管理端会话后由 middleware 兜底才被拒（体验更直接）。
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();

  let body: { email?: unknown; password?: unknown; admin?: unknown; redirect?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const isAdminLogin = body.admin === true;

  if (!email) {
    return NextResponse.json({ ok: false, message: MESSAGES.AUTH_EMAIL_REQUIRED }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ ok: false, message: MESSAGES.AUTH_PASSWORD_REQUIRED }, { status: 400 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    // 邮箱未确认与密码错误在 Supabase 里都算登录失败，若统一提示「密码不正确」会误导用户，
    // 这里按 error.code 区分，让用户知道该去点确认邮件还是该重新输密码。
    if (error?.code === 'email_not_confirmed') {
      return NextResponse.json({ ok: false, message: MESSAGES.AUTH_EMAIL_NOT_CONFIRMED }, { status: 403 });
    }
    return NextResponse.json({ ok: false, message: MESSAGES.AUTH_LOGIN_FAILED }, { status: 401 });
  }

  if (isAdminLogin) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();
    if (profile?.role !== USER_ROLE.ADMIN) {
      await supabase.auth.signOut();
      return NextResponse.json({ ok: false, message: MESSAGES.AUTH_ADMIN_ONLY }, { status: 403 });
    }
  }

  const fallback = isAdminLogin ? ROUTES.ADMIN_HOME : ROUTES.PROFILE;
  return NextResponse.json({ ok: true, redirect: sanitizeRedirect(body.redirect, fallback) });
}
