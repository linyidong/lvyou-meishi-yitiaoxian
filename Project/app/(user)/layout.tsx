import { Header } from '@/components/layout/Header';
import { HeartbeatProvider } from '@/components/layout/HeartbeatProvider';
import { MobileNav } from '@/components/layout/MobileNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { MemberStatusSync } from '@/components/member/MemberStatusSync';
import { getQuotaProfile } from '@/lib/member-quota';
import { createClient } from '@/lib/supabase/server';

/**
 * 用户端外壳（对齐原型：白色顶栏 + 浅灰底 + 移动端底部导航）。
 * 原型无页脚；T-092 起底部增加合规页脚 SiteFooter（仅版权与 ICP 备案号，不是导航区）。
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
  let showMemberBubble = false;
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('username,email,member_since,member_source')
      .eq('id', user.id)
      .maybeSingle();
    displayName = profile?.username ?? profile?.email ?? user.email ?? user.phone ?? null;
    // 档位统一由 lib/member-quota.ts 判定（含管理员最高级会员、付费会员 member_until 到期回落），
    // 也顺带兼容迁移 021 未执行时 member_until 列不存在的降级查询。
    const { tier } = await getQuotaProfile(user.id);
    isAdmin = tier === 'admin';
    isMember = tier !== 'free';
    // T-085：付费开通后 2 天内在「个人中心」旁显示金色气泡（管理员/免费/过期不显示）
    if (!isAdmin && profile?.member_source === 'paid' && profile?.member_since) {
      const age = Date.now() - new Date(profile.member_since).getTime();
      showMemberBubble = age >= 0 && age < 2 * 24 * 60 * 60 * 1000;
    }
  }

  return (
    <HeartbeatProvider>
      {/* T-028 会员状态实时同步：仅登录用户挂载（未登录不产生轮询请求） */}
      {user ? <MemberStatusSync /> : null}
      <div className="flex min-h-screen flex-col bg-stone-50 text-stone-800">
        <Header
          displayName={displayName}
          isAdmin={isAdmin}
          isMember={isMember}
          showMemberBubble={showMemberBubble}
        />
        <main className="mx-auto w-full max-w-[1536px] flex-1 px-4 py-6 pb-24 md:px-6 md:py-10 md:pb-10">
          {children}
        </main>
        {/* T-092 合规页脚：展示 ICP 备案号（备案号未配置时只显示版权行） */}
        <SiteFooter />
        {/* 移动端底部导航是 fixed，留出等高高避免遮住页脚 */}
        <div className="h-[calc(4rem+env(safe-area-inset-bottom))] md:hidden" aria-hidden />
        <MobileNav guest={!displayName} />
      </div>
    </HeartbeatProvider>
  );
}
