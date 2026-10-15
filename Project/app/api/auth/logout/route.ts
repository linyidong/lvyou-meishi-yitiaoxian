import { NextResponse } from 'next/server';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { createClient } from '@/lib/supabase/server';

/** U01 / A01 退出登录：清除 Supabase 会话 cookie。POST /api/auth/logout */
export async function POST() {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true, message: MESSAGES.AUTH_LOGOUT_OK, redirect: ROUTES.HOME });
}
