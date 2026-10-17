import Link from 'next/link';
import { BUSINESS } from '@/config/business';
import { PLACE_TYPE } from '@/config/enums';
import { ROUTES } from '@/config/routes';
import { PageHeader } from '@/components/common/PageHeader';
import { AdminShell } from '@/components/layout/AdminShell';
import { createClient } from '@/lib/supabase/server';

const QUICK_LINKS = [
  { href: ROUTES.ADMIN_USERS, label: 'A03 用户列表' },
  { href: ROUTES.ADMIN_ONLINE, label: 'A04 在线用户' },
  { href: ROUTES.ADMIN_PLACES, label: 'A05 地点列表' },
  { href: ROUTES.ADMIN_ROUTES, label: 'A06 路线列表' },
  { href: ROUTES.ADMIN_IMPORTS, label: 'A07 导入记录' },
];

/** HH:mm:ss */
function fmtClock(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** A02 管理员概览：服务端统计（只读） */
export default async function AdminHomePage() {
  const supabase = createClient();
  const onlineSince = new Date(
    Date.now() - BUSINESS.ONLINE_THRESHOLD_MINUTES * 60 * 1000,
  ).toISOString();

  const [usersRes, membersRes, onlineRes, placesRes, spotsRes, foodsRes, routesRes, importsRes] =
    await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('member', true),
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('last_seen_at', onlineSince),
      supabase.from('places').select('*', { count: 'exact', head: true }),
      supabase
        .from('places')
        .select('*', { count: 'exact', head: true })
        .eq('type', PLACE_TYPE.ATTRACTION),
      supabase.from('places').select('*', { count: 'exact', head: true }).eq('type', PLACE_TYPE.FOOD),
      supabase.from('routes').select('*', { count: 'exact', head: true }),
      supabase.from('imports').select('*', { count: 'exact', head: true }),
    ]);

  const totalUsers = usersRes.count ?? 0;
  const memberUsers = membersRes.count ?? 0;
  const onlineUsers = onlineRes.count ?? 0;
  const totalPlaces = placesRes.count ?? 0;
  const spotPlaces = spotsRes.count ?? 0;
  const foodPlaces = foodsRes.count ?? 0;
  const totalRoutes = routesRes.count ?? 0;
  const totalImports = importsRes.count ?? 0;

  const memberRate = totalUsers > 0 ? Math.round((memberUsers / totalUsers) * 100) : 0;

  const stats: { label: string; value: number; hint: string }[] = [
    { label: '当前在线', value: onlineUsers, hint: `最近 ${BUSINESS.ONLINE_THRESHOLD_MINUTES} 分钟有心跳` },
    { label: '总用户数', value: totalUsers, hint: `其中会员 ${memberUsers} 人` },
    { label: '会员用户', value: memberUsers, hint: `占比 ${memberRate}%` },
    { label: '总地点数', value: totalPlaces, hint: `景点 ${spotPlaces} · 美食 ${foodPlaces}` },
    { label: '总路线数', value: totalRoutes, hint: `已保存 ${totalRoutes} 条` },
    { label: '导入记录', value: totalImports, hint: `单次最多读取 ${BUSINESS.ADMIN_LIST_LIMIT} 条` },
  ];

  return (
    <AdminShell currentPath={ROUTES.ADMIN_HOME}>
      <PageHeader
        title="A02 管理员概览"
        description={`后台为只读模式，除用户列表的「开通 / 取消会员」外不提供编辑、删除或踢出操作 · 数据更新于 ${fmtClock(new Date())}。`}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-background p-5">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-3xl font-bold">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
          </div>
        ))}
      </section>

      <section className="mt-5 rounded-2xl border border-border bg-background p-5">
        <h2 className="text-sm font-semibold">快捷入口</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-xl border border-border px-4 py-3 text-sm hover:border-primary hover:bg-muted"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
