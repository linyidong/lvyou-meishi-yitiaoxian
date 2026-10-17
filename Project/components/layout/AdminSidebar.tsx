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

type NavItem = { href: string; label: string; icon: LucideIcon };

const SIDEBAR_ITEMS: NavItem[] = [
  { href: ROUTES.ADMIN_HOME, label: MESSAGES.ADMIN_SHELL.navOverview, icon: LayoutDashboard },
  { href: ROUTES.ADMIN_USERS, label: MESSAGES.ADMIN_SHELL.navUsers, icon: Users },
  { href: ROUTES.ADMIN_ONLINE, label: MESSAGES.ADMIN_SHELL.navOnline, icon: Wifi },
  { href: ROUTES.ADMIN_PLACES, label: MESSAGES.ADMIN_SHELL.navPlaces, icon: MapPinned },
  { href: ROUTES.ADMIN_ROUTES, label: MESSAGES.ADMIN_SHELL.navRoutes, icon: Route },
  { href: ROUTES.ADMIN_IMPORTS, label: MESSAGES.ADMIN_SHELL.navImports, icon: Upload },
];

/**
 * A02-A07 管理端侧边栏（对齐原型：深色固定侧栏 w-60）。
 * 底部保留「返回用户端」入口，管理员可在用户端 / 管理端来回切换。
 */
export function AdminSidebar({
  currentPath,
  open,
  onClose,
}: {
  currentPath: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace(ROUTES.HOME);
      router.refresh();
    }
  }

  return (
    <aside
      id="sidebar"
      className={cn(
        'fixed top-0 left-0 z-40 h-screen w-60 shrink-0 flex-col bg-slate-900 text-slate-300 lg:sticky lg:flex',
        open ? 'flex' : 'hidden lg:flex',
      )}
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
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = currentPath === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
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
