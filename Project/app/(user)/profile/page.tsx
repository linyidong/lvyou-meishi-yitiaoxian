import Link from 'next/link';
import { ChevronRight, LayoutDashboard } from 'lucide-react';
import { MemberCard, type PendingOrderInfo } from '@/components/profile/MemberCard';
import { ProfileMenu } from '@/components/profile/ProfileMenu';
import { ORDER_STATUS, USER_ROLE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { getAppSettings } from '@/lib/app-settings';
import { isMemberActive } from '@/lib/member-quota';
import { createClient } from '@/lib/supabase/server';
import type { MemberPlan, MemberSource } from '@/types';

const M = MESSAGES.PROFILE;

/**
 * 本页用到的 users 列（只读展示）。
 * member_until 依赖迁移 021，列不存在时由上面的降级查询补 null，故声明为可选。
 */
interface ProfileRow {
  id: string;
  email: string | null;
  username: string | null;
  role: string | null;
  member: boolean | null;
  member_since: string | null;
  member_source: string | null;
  member_until?: string | null;
  created_at: string;
}

/** YYYY-MM-DD */
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** U10 个人中心（第 6 步后）：账号信息 + 统计四宫格 + 会员卡 + 菜单 */
export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // T-051：「开放付费」开关传给会员卡，关闭时购买区显示暂停提示
  const { flags } = await getAppSettings();

  // middleware.ts 已拦截未登录，这里只做兜底
  if (!user) {
    return (
      <p className="text-sm text-muted-foreground">
        请先
        <Link href={ROUTES.LOGIN} className="text-primary underline">
          登录
        </Link>
        后查看个人中心。
      </p>
    );
  }

  // 会员有效期 member_until 依赖迁移 021：列不存在时降级为不含该列的查询，避免整页 500
  let profile: ProfileRow | null = null;
  const full = await supabase
    .from('users')
    .select('id,email,username,role,member,member_since,member_source,member_until,created_at')
    .eq('id', user.id)
    .maybeSingle();
  if (!full.error) {
    profile = full.data as ProfileRow;
  } else {
    const base = await supabase
      .from('users')
      .select('id,email,username,role,member,member_since,member_source,created_at')
      .eq('id', user.id)
      .maybeSingle();
    profile = base.data ? { ...(base.data as ProfileRow), member_until: null } : null;
  }

  // 最近一笔待核销订单（阶段 3）：查询失败（如迁移 021 未执行）时静默忽略
  let pendingOrder: PendingOrderInfo | null = null;
  try {
    const { data: order, error } = await supabase
      .from('member_orders')
      .select('plan,created_at')
      .eq('user_id', user.id)
      .eq('status', ORDER_STATUS.PENDING)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && order) {
      pendingOrder = { plan: order.plan as MemberPlan, createdAt: order.created_at };
    }
  } catch {
    pendingOrder = null;
  }

  const [routesRes, collectedRes, placesRes, routeCitiesRes] = await Promise.all([
    supabase.from('routes').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase
      .from('places')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_collected', true),
    supabase.from('places').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('routes').select('city_id').eq('user_id', user.id),
  ]);

  const cityCount = new Set(
    (routeCitiesRes.data ?? []).map((r) => r.city_id).filter((id): id is string => Boolean(id)),
  ).size;

  const isAdmin = profile?.role === USER_ROLE.ADMIN;
  // 管理员账号默认享有最高级会员（库侧由 015 触发器落库）；付费会员按 member_until 惰性判到期
  const isMember = isMemberActive(
    profile?.role ?? null,
    profile?.member ?? null,
    profile?.member_until ?? null,
  );
  const displayName = profile?.username ?? profile?.email?.split('@')[0] ?? '旅行者';
  const stats: { label: string; value: number; href?: string }[] = [
    { label: M.statRoutes, value: routesRes.count ?? 0, href: ROUTES.MY_ROUTES },
    { label: M.statCollected, value: collectedRes.count ?? 0, href: ROUTES.COLLECTED },
    { label: M.statPlaces, value: placesRes.count ?? 0 },
    { label: M.statCities, value: cityCount },
  ];

  return (
    <div className="space-y-5">
      {/* 账号信息 */}
      <section className="flex flex-col items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 sm:flex-row md:p-6">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
          {displayName.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-stone-900">{displayName}</h1>
          <p className="mt-0.5 text-sm text-stone-500">{profile?.email ?? user.email}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg bg-stone-100 px-2 py-1 text-stone-600">
              {isAdmin ? M.memberBadgeAdmin : isMember ? M.memberBadge : M.memberBadgeNone}
            </span>
            {isMember && profile?.member_since ? (
              <span className="rounded-lg bg-stone-100 px-2 py-1 text-stone-600">
                {M.memberSince(fmtDate(profile.member_since))}
              </span>
            ) : null}
            <span className="rounded-lg bg-stone-100 px-2 py-1 text-stone-600">
              {M.registeredAt(fmtDate(profile?.created_at ?? null))}
            </span>
          </div>
        </div>
      </section>

      {/* 统计四宫格 */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) =>
          s.href ? (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-2xl border border-stone-200 bg-white p-4 hover:border-primary/30"
            >
              <p className="text-xs text-stone-500">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-stone-900">{s.value}</p>
            </Link>
          ) : (
            <div key={s.label} className="rounded-2xl border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-500">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-stone-900">{s.value}</p>
            </div>
          ),
        )}
      </section>

      {/* 管理后台入口：仅管理员渲染（服务端按 role 判断，普通用户看不到也不会拿到入口） */}
      {isAdmin ? (
        <Link
          href={ROUTES.ADMIN_HOME}
          className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-primary-from to-primary-to p-5 text-white hover:brightness-110"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15">
            <LayoutDashboard className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{MESSAGES.ADMIN_ENTRY_TITLE}</span>
            <span className="mt-0.5 block text-xs text-white/80">{MESSAGES.ADMIN_ENTRY_DESC}</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0" />
        </Link>
      ) : null}

      {/* 会员卡 */}
      <MemberCard
        member={isMember}
        isAdmin={isAdmin}
        memberSince={profile?.member_since ?? null}
        memberSource={(profile?.member_source as MemberSource | null) ?? null}
        memberUntil={profile?.member_until ?? null}
        pendingOrder={pendingOrder}
        billingEnabled={flags.billingEnabled}
      />

      {/* 菜单 */}
      <ProfileMenu />
    </div>
  );
}
