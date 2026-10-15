import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { HeartbeatProvider } from '@/components/layout/HeartbeatProvider';
import { createClient } from '@/lib/supabase/server';

/**
 * 用户端外壳。
 * 这里读一次当前登录用户，只为顶部导航显示「用户名 / 登录入口」，
 * 页面级权限仍由 middleware.ts 统一拦截（本文件不做重定向）。
 */
export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('username,email')
      .eq('id', user.id)
      .maybeSingle();
    displayName = profile?.username ?? profile?.email ?? user.email ?? null;
  }

  return (
    <HeartbeatProvider>
      <div className="flex min-h-screen flex-col">
        <Header displayName={displayName} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        <Footer />
      </div>
    </HeartbeatProvider>
  );
}
