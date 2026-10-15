import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRedirect } from '@/lib/utils';

/**
 * U01 注册（邮箱 + 密码），走 Supabase Auth。
 * POST /api/auth/register
 * body: { email, password, redirect? }
 *
 * 若项目开启了「邮箱确认」，signUp 不会返回会话，此时提示用户去邮箱点确认链接；
 * 若未开启确认，signUp 直接返回会话，视为注册即登录。
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();

  let body: { email?: unknown; password?: unknown; redirect?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email) {
    return NextResponse.json({ ok: false, message: MESSAGES.AUTH_EMAIL_REQUIRED }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ ok: false, message: MESSAGES.AUTH_PASSWORD_REQUIRED }, { status: 400 });
  }
  if (password.length < BUSINESS.MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ ok: false, message: MESSAGES.AUTH_PASSWORD_TOO_SHORT }, { status: 400 });
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    const message = /already|registered|exists/i.test(error.message)
      ? MESSAGES.AUTH_EMAIL_EXISTS
      : error.message;
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  // 无会话 = 需要邮箱确认（或该邮箱已存在，Supabase 出于防枚举会返回伪用户）
  if (!data.session) {
    return NextResponse.json({ ok: true, needConfirm: true, message: MESSAGES.AUTH_REGISTER_NEED_CONFIRM });
  }

  return NextResponse.json({
    ok: true,
    needConfirm: false,
    message: MESSAGES.AUTH_REGISTER_OK,
    redirect: sanitizeRedirect(body.redirect, ROUTES.PROFILE),
  });
}
