import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRedirect } from '@/lib/utils';

/**
 * U01 注册（邮箱 + 密码），走 Supabase Auth。
 * POST /api/auth/register
 * body: { email, password, redirect? }
 *
 * 本项目的 Supabase 是自建版，默认没有 SMTP，signUp 会因「发不出确认邮件」而失败。
 * 因此这里改用 Secret Key 直接建号（email_confirm = true，跳过邮件确认），
 * 再用普通客户端登录一次，把会话写进 Cookie，实现「注册即登录」。
 * 建号后补写 public.users（若 010 触发器已存在则为空操作），保证用户档案一定落库。
 * ⚠️ 上线接入 SMTP 后，应改回「邮箱确认 + 真实发信」的流程。
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

  // 1) 用 Secret Key 建号并直接确认邮箱（绕过自建版缺失的 SMTP）
  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    // 不把 GoTrue 的英文原文回显给前端（D4），按场景映射成中文友好文案
    const raw = createError.message;
    let message: string;
    if (/already|registered|exists/i.test(raw)) {
      message = MESSAGES.AUTH_EMAIL_EXISTS;
    } else if (/sending|smtp|confirmation email|rate limit/i.test(raw)) {
      message = MESSAGES.AUTH_REGISTER_MAIL_FAILED;
    } else {
      message = MESSAGES.AUTH_REGISTER_FAILED;
    }
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  // 2) 补写用户档案：触发器在时为空操作，触发器缺失时也能保证档案落库
  if (created.user) {
    await admin
      .from('users')
      .upsert({ id: created.user.id, email }, { onConflict: 'id', ignoreDuplicates: true });
  }

  // 3) 登录一次，把会话写进 Cookie（注册即登录）
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return NextResponse.json({ ok: false, message: MESSAGES.AUTH_REGISTER_FAILED }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    needConfirm: false,
    message: MESSAGES.AUTH_REGISTER_OK,
    // T-047：注册即登录成功后默认跳首页（与登录口径一致）
    redirect: sanitizeRedirect(body.redirect, ROUTES.HOME),
  });
}
