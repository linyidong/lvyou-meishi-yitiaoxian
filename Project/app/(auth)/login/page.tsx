import { redirect } from 'next/navigation';
import { LoginClient } from '@/components/auth/LoginClient';
import { ROUTES } from '@/config/routes';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRedirect } from '@/lib/utils';

/** U01 登录 / 注册（邮箱 + 密码，Supabase Auth） */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string; error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 已登录就不必再看登录页，直接去原本要去的页面
  if (user) redirect(sanitizeRedirect(searchParams.redirect, ROUTES.PROFILE));

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <LoginClient mode="user" initialRedirect={searchParams.redirect} initialError={searchParams.error} />
    </div>
  );
}
