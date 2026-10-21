import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  ChevronRight,
  Crown,
  DatabaseZap,
  MapPinned,
  Route,
  Upload,
  Users,
  Wifi,
} from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { EVENT_NAME, PLACE_TYPE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { AdminEmptyState, AdminErrorState } from '@/components/admin/AdminState';
import { AdminShell } from '@/components/layout/AdminShell';
import { getAmapUsage } from '@/lib/amap-usage';
import { webKeyLabel } from '@/lib/amap-key-pool';
import { createClient } from '@/lib/supabase/server';

const M = MESSAGES.ADMIN_OVERVIEW;

/** 快捷入口（图标底色照抄原型） */
const QUICK_LINKS = [
  { href: ROUTES.ADMIN_USERS, label: M.quickUsers, box: 'bg-sky-50 text-sky-600', Icon: Users },
  { href: ROUTES.ADMIN_USERS, label: M.quickMembers, box: 'bg-amber-50 text-amber-600', Icon: Crown },
  { href: ROUTES.ADMIN_ONLINE, label: M.quickOnline, box: 'bg-emerald-50 text-emerald-600', Icon: Wifi },
  { href: ROUTES.ADMIN_PLACES, label: M.quickPlaces, box: 'bg-teal-50 text-teal-600', Icon: MapPinned },
  { href: ROUTES.ADMIN_ROUTES, label: M.quickRoutes, box: 'bg-primary/5 text-primary', Icon: Route },
  { href: ROUTES.ADMIN_IMPORTS, label: M.quickImports, box: 'bg-amber-50 text-amber-600', Icon: Upload },
];

/** HH:mm:ss */
function fmtClock(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** M/D */
function fmtDay(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** A02 管理员概览：全站统计 + 近 7 天埋点指标（只读） */
export default async function AdminHomePage() {
  const supabase = createClient();
  const now = new Date();
  const onlineSince = new Date(
    now.getTime() - BUSINESS.ONLINE_THRESHOLD_MINUTES * 60 * 1000,
  ).toISOString();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    usersRes,
    membersRes,
    onlineRes,
    todayUsersRes,
    placesRes,
    spotsRes,
    foodsRes,
    routesRes,
    importsRes,
    successImportsRes,
    addPlaceRes,
    genRouteRes,
    upgradeRes,
    routeEventsRes,
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('member', true),
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen_at', onlineSince),
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString()),
    supabase.from('places').select('*', { count: 'exact', head: true }),
    supabase
      .from('places')
      .select('*', { count: 'exact', head: true })
      .eq('type', PLACE_TYPE.ATTRACTION),
    supabase.from('places').select('*', { count: 'exact', head: true }).eq('type', PLACE_TYPE.FOOD),
    supabase.from('routes').select('*', { count: 'exact', head: true }),
    supabase.from('imports').select('*', { count: 'exact', head: true }),
    supabase.from('imports').select('*', { count: 'exact', head: true }).eq('status', 'success'),
    supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', EVENT_NAME.ADD_PLACE)
      .gte('created_at', weekStart.toISOString()),
    supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', EVENT_NAME.GENERATE_ROUTE)
      .gte('created_at', weekStart.toISOString()),
    supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', EVENT_NAME.CLICK_UPGRADE)
      .gte('created_at', weekStart.toISOString()),
    supabase
      .from('events')
      .select('created_at')
      .eq('event_name', EVENT_NAME.GENERATE_ROUTE)
      .gte('created_at', weekStart.toISOString()),
  ]);

  const results = [
    usersRes,
    membersRes,
    onlineRes,
    todayUsersRes,
    placesRes,
    spotsRes,
    foodsRes,
    routesRes,
    importsRes,
    successImportsRes,
    addPlaceRes,
    genRouteRes,
    upgradeRes,
    routeEventsRes,
  ];
  const hasError = results.some((r) => r.error);

  // 本月高德用量（service_role 查询，进程内缓存 60 秒；查询失败静默降级为空用量）
  const usage = await getAmapUsage();

  const totalUsers = usersRes.count ?? 0;
  const memberUsers = membersRes.count ?? 0;
  const onlineUsers = onlineRes.count ?? 0;
  const todayUsers = todayUsersRes.count ?? 0;
  const totalPlaces = placesRes.count ?? 0;
  const spotPlaces = spotsRes.count ?? 0;
  const foodPlaces = foodsRes.count ?? 0;
  const totalRoutes = routesRes.count ?? 0;
  const totalImports = importsRes.count ?? 0;
  const successImports = successImportsRes.count ?? 0;
  const addPlaceCount = addPlaceRes.count ?? 0;
  const genRouteCount = genRouteRes.count ?? 0;
  const upgradeCount = upgradeRes.count ?? 0;

  const memberRate = totalUsers > 0 ? Math.round((memberUsers / totalUsers) * 100) : 0;
  const importRate = totalImports > 0 ? Math.round((successImports / totalImports) * 100) : 0;
  const isEmpty = totalUsers === 0 && totalPlaces === 0 && totalRoutes === 0 && totalImports === 0;

  // 近 7 天每日生成路线数（按本地日期分桶）
  const dailyCounts = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(todayStart);
    day.setDate(day.getDate() - (6 - i));
    return { day, count: 0 };
  });
  for (const e of routeEventsRes.data ?? []) {
    const d = new Date(e.created_at);
    d.setHours(0, 0, 0, 0);
    const slot = dailyCounts.find((x) => x.day.getTime() === d.getTime());
    if (slot) slot.count += 1;
  }
  const maxDaily = Math.max(1, ...dailyCounts.map((x) => x.count));

  return (
    <AdminShell
      currentPath={ROUTES.ADMIN_HOME}
      title={MESSAGES.ADMIN_SHELL.navOverview}
      overview
      updatedAt={fmtClock(now)}
      refreshBanner={MESSAGES.ADMIN_HEADER.refreshed}
    >
      {hasError ? (
        <AdminErrorState title={M.errorTitle} desc={M.errorDesc} icon={<DatabaseZap className="mx-auto h-12 w-12 text-red-400" />} />
      ) : isEmpty ? (
        <AdminEmptyState icon={BarChart3} title={M.emptyTitle} desc={M.emptyDesc} />
      ) : (
        <>
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {M.constraintLead}
              <Link href={ROUTES.ADMIN_USERS} className="font-medium underline underline-offset-2">
                {M.constraintLink}
              </Link>
              {M.constraintTail}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <Link
              href={ROUTES.ADMIN_ONLINE}
              className="col-span-2 rounded-2xl bg-slate-900 p-5 text-white transition hover:ring-4 hover:ring-slate-300 lg:col-span-1"
            >
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>{M.statOnline}</span>
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  {M.live}
                </span>
              </div>
              <p className="mt-3 text-4xl font-bold">{onlineUsers}</p>
              <p className="mt-1 text-xs text-slate-400">
                {M.statOnlineHint(BUSINESS.ONLINE_THRESHOLD_MINUTES)}
              </p>
            </Link>

            <Link
              href={ROUTES.ADMIN_USERS}
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-400"
            >
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>{M.statUsers}</span>
                <Users className="h-5 w-5 text-sky-600" />
              </div>
              <p className="mt-3 text-3xl font-bold text-slate-900">{totalUsers}</p>
              <p className="mt-1 text-xs text-slate-500">
                {M.statUsersHint(todayUsers, memberUsers)}
              </p>
            </Link>

            <Link
              href={ROUTES.ADMIN_USERS}
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-400"
            >
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>{M.statMembers}</span>
                <Crown className="h-5 w-5 text-amber-500" />
              </div>
              <p className="mt-3 text-3xl font-bold text-slate-900">{memberUsers}</p>
              <p className="mt-1 text-xs text-slate-500">{M.statMembersHint(memberRate)}</p>
            </Link>

            <Link
              href={ROUTES.ADMIN_PLACES}
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-400"
            >
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>{M.statPlaces}</span>
                <MapPinned className="h-5 w-5 text-teal-600" />
              </div>
              <p className="mt-3 text-3xl font-bold text-slate-900">{totalPlaces}</p>
              <p className="mt-1 text-xs text-slate-500">
                {M.statPlacesHint(spotPlaces, foodPlaces)}
              </p>
            </Link>

            <Link
              href={ROUTES.ADMIN_ROUTES}
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-400"
            >
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>{M.statRoutes}</span>
                <Route className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-3 text-3xl font-bold text-slate-900">{totalRoutes}</p>
              <p className="mt-1 text-xs text-slate-500">{M.statRoutesHint(totalRoutes)}</p>
            </Link>

            <Link
              href={ROUTES.ADMIN_IMPORTS}
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-400"
            >
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>{M.statImports}</span>
                <Upload className="h-5 w-5 text-amber-600" />
              </div>
              <p className="mt-3 text-3xl font-bold text-slate-900">{totalImports}</p>
              <p className="mt-1 text-xs text-slate-500">{M.statImportsHint(importRate)}</p>
            </Link>
          </div>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">{M.usageTitle}</h2>
              <span className="text-xs text-slate-400">{M.usagePercent(usage.percent)}</span>
            </div>

            {usage.monthTotal === 0 ? (
              <p className="mt-3 text-sm text-slate-500">{M.usageEmpty}</p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-1">
                  <p className="text-2xl font-bold text-slate-900">
                    {M.usageMonth(usage.monthTotal, usage.quotaTotal)}
                  </p>
                  <p className="text-sm text-slate-500">{M.usageToday(usage.todayTotal)}</p>
                </div>

                {usage.critical ? (
                  <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {M.usageCritical(usage.percent)}
                  </p>
                ) : usage.warn ? (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {M.usageWarn(usage.percent)}
                  </p>
                ) : null}

                <p className="mb-2 mt-4 text-xs text-slate-500">{M.usageServiceTitle}</p>
                <ul className="space-y-1.5">
                  {usage.services.map((s) => (
                    <li key={s.service} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs text-slate-600">
                        {M.usageServiceRow(s.service, s.calls)}
                      </span>
                      {s.failures > 0 ? (
                        <span className="text-xs text-red-500">
                          {M.usageServiceFailures(s.failures)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>

                {/* 多账号 Key 池：按 Key 槽位分别展示用量，已耗尽的 Key 会被轮询跳过 */}
                <p className="mb-2 mt-4 text-xs text-slate-500">{M.usageKeyTitle(usage.keyCount)}</p>
                <ul className="space-y-1.5">
                  {usage.keys.map((k) => (
                    <li key={k.slot} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs text-slate-600">
                        {M.usageKeyRow(webKeyLabel(k.slot), k.calls, k.percent)}
                      </span>
                      {k.critical ? (
                        <span className="text-xs text-red-500">{M.usageKeyExhausted}</span>
                      ) : k.percent >= BUSINESS.AMAP_QUOTA_WARN_PERCENT ? (
                        <span className="text-xs text-amber-600">{M.usageKeyWarn}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">{M.metricsTitle}</h2>
                <span className="text-xs text-slate-400">{M.metricsRange}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { label: M.metricAddPlace, count: addPlaceCount, event: EVENT_NAME.ADD_PLACE },
                  { label: M.metricGenRoute, count: genRouteCount, event: EVENT_NAME.GENERATE_ROUTE },
                  {
                    label: M.metricUpgradeClick,
                    count: upgradeCount,
                    event: EVENT_NAME.CLICK_UPGRADE,
                  },
                ].map((m) => (
                  <div key={m.event} className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">{m.label}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{m.count}</p>
                    <p className="text-[11px] text-slate-400">{M.metricEvent(m.event)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <p className="mb-2 text-xs text-slate-500">{M.metricBars}</p>
                <div className="flex h-36 items-end gap-2">
                  {dailyCounts.map((d) => (
                    <div
                      key={d.day.toISOString()}
                      title={`${fmtDay(d.day)} · ${d.count}`}
                      className="flex-1 rounded-t bg-slate-300"
                      style={{ height: `${Math.max(4, (d.count / maxDaily) * 100)}%` }}
                    />
                  ))}
                </div>
                <div className="mt-1 flex gap-2 text-[11px] text-slate-400">
                  {dailyCounts.map((d) => (
                    <span key={d.day.toISOString()} className="flex-1 text-center">
                      {fmtDay(d.day)}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* 桌面（≥ lg）展示快捷入口；移动端（< lg）由底部工具栏承担同一批路由，避免重复 */}
            <section className="hidden rounded-2xl border border-slate-200 bg-white p-5 lg:block">
              <h2 className="font-semibold text-slate-900">{M.quickTitle}</h2>
              <div className="mt-4 space-y-2">
                {QUICK_LINKS.map((l) => {
                  const Icon = l.Icon;
                  return (
                    <Link
                      key={l.label}
                      href={l.href}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50"
                    >
                      <span className={`grid h-9 w-9 place-items-center rounded-lg ${l.box}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 text-sm">{l.label}</span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>
        </>
      )}
    </AdminShell>
  );
}
