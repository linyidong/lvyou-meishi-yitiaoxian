'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, CheckCircle2, Menu, RefreshCw } from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { AdminSidebar } from '@/components/layout/AdminSidebar';

/**
 * A02-A07 管理端外壳（对齐原型：深色固定侧栏 + 白色置顶工具栏 + 内容区 p-4 md:p-6）。
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
  const [sideOpen, setSideOpen] = useState(false);
  // 概览页自动刷新默认开启（与 A02 原型勾选态一致，管理员可手动关闭）
  const [auto, setAuto] = useState(true);
  const [banner, setBanner] = useState(false);

  function refreshNow() {
    router.refresh();
    if (refreshBanner) {
      setBanner(true);
      setTimeout(() => setBanner(false), 2500);
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
      <AdminSidebar currentPath={currentPath} open={sideOpen} onClose={() => setSideOpen(false)} />
      {sideOpen ? (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
          onClick={() => setSideOpen(false)}
        />
      ) : null}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
          <button
            type="button"
            aria-label={MESSAGES.ADMIN_HEADER.menuAria}
            onClick={() => setSideOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>

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
          </div>
        </header>

        <main className="p-4 md:p-6">
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
    </div>
  );
}
