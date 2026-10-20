'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { ADMIN_NAV, AdminSidebar } from '@/components/layout/AdminSidebar';

/**
 * A02-A07 管理端外壳：桌面（≥ lg）为深色固定侧栏 + 白色置顶工具栏 + 内容区；
 * 移动端（< lg）改为固定底部工具栏导航，顶栏保留「返回用户端 / 退出后台」入口。
 * 各 admin 页面自行包一层本组件；页面内不要再渲染顶栏 / 底栏。
 */
export function AdminShell({
  currentPath,
  title,
  overview = false,
  badge,
  refresh = false,
  showAdminName = false,
  updatedAt,
  refreshBanner,
  children,
}: {
  currentPath: string;
  /** 概览页（A02）大标题；其余页为面包屑末项 */
  title: string;
  /** 概览页：大标题 + 数据更新于 + 自动刷新 + 刷新 + 管理员名 */
  overview?: boolean;
  /** 顶栏徽章（A03 只读 · 会员操作除外 / A04-A07 只读） */
  badge?: string;
  /** 顶栏是否显示刷新按钮（A04） */
  refresh?: boolean;
  /** 顶栏是否显示管理员名（A02 / A03） */
  showAdminName?: boolean;
  /** 概览页数据更新时刻 HH:mm:ss */
  updatedAt?: string;
  /** 手动刷新后短暂展示的成功横幅文案（A02 / A04） */
  refreshBanner?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  // 概览页自动刷新默认开启（与 A02 原型勾选态一致，管理员可手动关闭）
  const [auto, setAuto] = useState(true);
  const [banner, setBanner] = useState(false);
  // 「会员订单」待核销红色角标：管理端所有页面都轮询同一个轻量 count 接口
  const [pendingOrders, setPendingOrders] = useState(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch('/api/admin/member/orders/pending-count', { cache: 'no-store' });
        const data = (await res.json()) as { ok?: boolean; pending?: number };
        if (alive && data.ok) setPendingOrders(data.pending ?? 0);
      } catch {
        // 角标失败静默，不影响页面主体
      }
    }
    load();
    const timer = window.setInterval(load, BUSINESS.ADMIN_PENDING_BADGE_REFRESH_SECONDS * 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  function refreshNow() {
    router.refresh();
    if (refreshBanner) {
      setBanner(true);
      setTimeout(() => setBanner(false), 2500);
    }
  }

  // 移动端（< lg）无侧栏，退出后台入口保留在顶栏；退出后回管理端登录页（不回首页）
  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace(ROUTES.ADMIN_LOGIN);
      router.refresh();
    }
  }

  // 概览页「每 N 秒自动刷新」（默认值取自 B 组配置，可手动勾选切换）
  useEffect(() => {
    if (!overview || !auto) return;
    const timer = window.setInterval(() => router.refresh(), BUSINESS.ADMIN_ONLINE_REFRESH_SECONDS * 1000);
    return () => window.clearInterval(timer);
  }, [overview, auto, router]);

  return (
    // 页面宽度跟随窗口，最大 1536px（max-w-screen-2xl）
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <div className="mx-auto flex min-h-screen w-full max-w-screen-2xl">
      <AdminSidebar currentPath={currentPath} pendingOrders={pendingOrders} />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
          {overview ? (
            <>
              <h1 className="font-semibold text-slate-900">{title}</h1>
              <span className="hidden text-xs text-slate-400 sm:inline">
                {MESSAGES.ADMIN_HEADER.updatedAt}{' '}
                {updatedAt ?? MESSAGES.ADMIN_HEADER.updatedAtPlaceholder}
              </span>
            </>
          ) : (
            <>
              <nav className="flex items-center gap-1 text-sm text-slate-500">
                <Link href={ROUTES.ADMIN_HOME} className="hover:text-slate-900">
                  {MESSAGES.ADMIN_SHELL.navOverview}
                </Link>
                <ChevronRight className="h-4 w-4" />
                <span className="font-semibold text-slate-900">{title}</span>
              </nav>
              {badge ? (
                <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                  {badge}
                </span>
              ) : null}
            </>
          )}

          <div className="ml-auto flex items-center gap-2">
            {overview ? (
              <>
                <label className="mr-2 hidden items-center gap-2 text-xs text-slate-600 sm:flex">
                  <input
                    type="checkbox"
                    checked={auto}
                    onChange={(e) => setAuto(e.target.checked)}
                    className="accent-slate-900"
                  />
                  {MESSAGES.ADMIN_HEADER.autoRefresh(BUSINESS.ADMIN_ONLINE_REFRESH_SECONDS)}
                </label>
                <button
                  type="button"
                  onClick={refreshNow}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm hover:bg-slate-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="hidden sm:inline">{MESSAGES.ADMIN_HEADER.refresh}</span>
                </button>
              </>
            ) : (
              refresh && (
                <button
                  type="button"
                  onClick={refreshNow}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  {MESSAGES.ADMIN_HEADER.refresh}
                </button>
              )
            )}

            {(overview || showAdminName) && (
              <span className="hidden items-center gap-2 text-sm text-slate-600 md:flex">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-xs text-white">
                  {MESSAGES.ADMIN_SHELL.operatorInitial}
                </span>
                {MESSAGES.ADMIN_SHELL.browsingAs}
              </span>
            )}

            {/* 移动端（< lg）：侧栏不可用，将「返回用户端 / 退出后台」保留在顶栏 */}
            <Link
              href={ROUTES.HOME}
              aria-label={MESSAGES.ADMIN_BACK_TO_SITE}
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 lg:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <button
              type="button"
              aria-label={MESSAGES.ADMIN_SHELL.logout}
              onClick={logout}
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 lg:hidden"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* 移动端底部留白：避免内容被固定底栏遮住（底栏约 53px + 安全区） */}
        <main className="p-4 pb-20 md:p-6 md:pb-20 lg:pb-6">
          {banner && refreshBanner ? (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {refreshBanner}
            </div>
          ) : null}
          {children}
        </main>
      </div>
      </div>

      {/* 移动端底部工具栏（< lg）：6 项导航等分，高亮当前页；桌面隐藏 */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="flex">
          {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
            const active = currentPath === href;
            const pending = href === ROUTES.ADMIN_ORDERS ? pendingOrders : 0;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 py-2',
                  active ? 'text-slate-900' : 'text-slate-500',
                )}
              >
                <span className="relative">
                  <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
                  {pending > 0 ? (
                    <span
                      aria-label={MESSAGES.ADMIN_SHELL.pendingOrdersAria(pending)}
                      className="absolute -top-1.5 -right-2.5 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-red-500 px-1 text-[9px] leading-none font-bold text-white"
                    >
                      {pending > BUSINESS.ADMIN_PENDING_BADGE_MAX
                        ? `${BUSINESS.ADMIN_PENDING_BADGE_MAX}+`
                        : pending}
                    </span>
                  ) : null}
                </span>
                <span className="text-[10px] leading-tight">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
