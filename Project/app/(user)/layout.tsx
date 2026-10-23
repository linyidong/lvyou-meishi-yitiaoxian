import { Header } from '@/components/layout/Header';
import { HeartbeatProvider } from '@/components/layout/HeartbeatProvider';
import { MobileNav } from '@/components/layout/MobileNav';
import { MemberStatusSync } from '@/components/member/MemberStatusSync';
import { getQuotaProfile } from '@/lib/member-quota';
import { createClient } from '@/lib/supabase/server';

/**
 * 用户端外壳（对齐原型：白色顶栏 + 浅灰底 + 移动端底部导航，无页脚）。
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
  let isMember = false;
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('username,email')
      .eq('id', user.id)
      .maybeSingle();
    displayName = profile?.username ?? profile?.email ?? user.email ?? null;
    // 档位统一由 lib/member-quota.ts 判定（含管理员最高级会员、付费会员 member_until 到期回落），
    // 也顺带兼容迁移 021 未执行时 member_until 列不存在的降级查询。
    const { tier } = await getQuotaProfile(user.id);
    isAdmin = tier === 'admin';
    isMember = tier !== 'free';
  }

  return (
    <HeartbeatProvider>
      {/* T-028 会员状态实时同步：仅登录用户挂载（未登录不产生轮询请求） */}
      {user ? <MemberStatusSync /> : null}
      <div className="flex min-h-screen flex-col bg-stone-50 text-stone-800">
        <Header displayName={displayName} isAdmin={isAdmin} isMember={isMember} />
        <main className="mx-auto w-full max-w-[1536px] flex-1 px-4 py-6 pb-24 md:px-6 md:py-10 md:pb-10">
          {children}
        </main>
        <MobileNav guest={!displayName} />
      </div>
    </HeartbeatProvider>
  );
}
