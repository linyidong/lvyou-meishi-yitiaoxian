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

  // U01 登录页不在 (user) 外壳内（无顶栏 / 底部导航），这里自带与原型一致的外层与主容器
  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-12">
        <LoginClient mode="user" initialRedirect={searchParams.redirect} initialError={searchParams.error} />
      </main>
    </div>
  );
}
