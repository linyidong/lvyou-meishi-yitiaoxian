import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { HeartbeatProvider } from '@/components/layout/HeartbeatProvider';
import { USER_ROLE } from '@/config/enums';
import { createClient } from '@/lib/supabase/server';

/**
 * 用户端外壳。
 * 这里读一次当前登录用户，只为顶部导航显示「用户名 / 登录入口」，
 * 并在服务端判定管理员身份（头像菜单的「管理后台」入口只对管理员渲染）。
 * 页面级权限仍由 middleware.ts 统一拦截（本文件不做重定向）。
 */
export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName: string | null = null;
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('username,email,role')
      .eq('id', user.id)
      .maybeSingle();
    displayName = profile?.username ?? profile?.email ?? user.email ?? null;
    isAdmin = profile?.role === USER_ROLE.ADMIN;
  }

  return (
    <HeartbeatProvider>
      <div className="flex min-h-screen flex-col">
        <Header displayName={displayName} isAdmin={isAdmin} />
        <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 lg:px-6">{children}</main>
        <Footer />
      </div>
    </HeartbeatProvider>
  );
}
