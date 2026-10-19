'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Eye,
  LayoutDashboard,
  LogOut,
  MapPinned,
  ReceiptText,
  Route,
  Upload,
  Users,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

export type NavItem = { href: string; label: string; icon: LucideIcon };

/**
 * 管理端导航单一数据源（A02-A07）：桌面深色侧栏（本文件）与移动端底部工具栏（AdminShell）共用。
 * 文案一律取自 MESSAGES.ADMIN_SHELL.nav*，禁止在组件内写死中文。
 */
export const ADMIN_NAV: NavItem[] = [
  { href: ROUTES.ADMIN_HOME, label: MESSAGES.ADMIN_SHELL.navOverview, icon: LayoutDashboard },
  { href: ROUTES.ADMIN_USERS, label: MESSAGES.ADMIN_SHELL.navUsers, icon: Users },
  { href: ROUTES.ADMIN_ONLINE, label: MESSAGES.ADMIN_SHELL.navOnline, icon: Wifi },
  { href: ROUTES.ADMIN_PLACES, label: MESSAGES.ADMIN_SHELL.navPlaces, icon: MapPinned },
  { href: ROUTES.ADMIN_ROUTES, label: MESSAGES.ADMIN_SHELL.navRoutes, icon: Route },
  { href: ROUTES.ADMIN_IMPORTS, label: MESSAGES.ADMIN_SHELL.navImports, icon: Upload },
  { href: ROUTES.ADMIN_ORDERS, label: MESSAGES.ADMIN_SHELL.navOrders, icon: ReceiptText },
];

/**
 * A02-A07 管理端侧边栏（对齐原型：深色固定侧栏 w-60），仅桌面（≥ lg）显示。
 * 底部保留「返回用户端」入口；移动端（< lg）由 AdminShell 底部工具栏导航，
 * 退出后台 / 返回用户端入口同时保留在 AdminShell 顶栏（lg:hidden）。
 */
export function AdminSidebar({ currentPath }: { currentPath: string }) {
  const router = useRouter();

  /** 退出后台后回管理端登录页（不回首页） */
  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace(ROUTES.ADMIN_LOGIN);
      router.refresh();
    }
  }

  return (
    <aside
      id="sidebar"
      className="fixed top-0 left-0 z-40 hidden h-screen w-60 shrink-0 flex-col bg-slate-900 text-slate-300 lg:sticky lg:flex"
    >
      <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-5">
        <Image src={PRODUCT.LOGO_PATH} alt={PRODUCT.NAME} width={36} height={36} className="h-8 w-8" />
        <div>
          <p className="text-sm leading-tight font-semibold text-white">
            {MESSAGES.ADMIN_SHELL.brandName}
          </p>
          <p className="text-[11px] text-slate-500">{MESSAGES.ADMIN_SHELL.brandSub}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3 text-sm">
        {ADMIN_NAV.map((item) => {
          const Icon = item.icon;
          const active = currentPath === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex h-10 items-center gap-3 rounded-lg px-3',
                active ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white',
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3 text-xs">
        <div className="flex items-center gap-2 rounded-lg bg-slate-800/60 px-3 py-2">
          <Eye className="h-4 w-4" />
          {MESSAGES.ADMIN_SHELL.readOnlyNote}
        </div>
        <button
          type="button"
          onClick={logout}
          className="mt-2 flex h-9 w-full items-center gap-2 rounded-lg px-3 hover:bg-slate-800"
        >
          <LogOut className="h-4 w-4" />
          {MESSAGES.ADMIN_SHELL.logout}
        </button>
        {/* 返回用户端：管理员在后台与前台之间切换，无需手动输入网址 */}
        <Link
          href={ROUTES.HOME}
          className="mt-1 flex h-9 w-full items-center gap-2 rounded-lg px-3 hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {MESSAGES.ADMIN_BACK_TO_SITE}
        </Link>
      </div>
    </aside>
  );
}
