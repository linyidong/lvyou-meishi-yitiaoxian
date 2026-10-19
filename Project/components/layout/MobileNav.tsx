'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, Home, MapPinPlus, Route, User } from 'lucide-react';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

/** 原型底部导航（仅移动端）：首页 / 新建 / 我的路线 / 我的收藏 / 我的 */
const MOBILE_ITEMS = [
  { href: ROUTES.HOME, label: MESSAGES.NAV_HOME, icon: Home },
  { href: ROUTES.ROUTE_NEW, label: MESSAGES.NAV_NEW_SHORT, icon: MapPinPlus },
  { href: ROUTES.MY_ROUTES, label: MESSAGES.NAV_MY_ROUTES, icon: Route },
  { href: ROUTES.COLLECTED, label: MESSAGES.NAV_COLLECTED, icon: Heart },
  { href: ROUTES.PROFILE, label: MESSAGES.NAV_PROFILE_SHORT, icon: User },
];

/** 当前项高亮：与 Header 保持同一套规则 */
function isActive(pathname: string, href: string) {
  if (href === ROUTES.HOME) return pathname === ROUTES.HOME;
  if (href === ROUTES.ROUTE_NEW) return pathname.startsWith('/route');
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** 移动端底部导航；游客（未登录）时全部置灰不可点，与顶部工具栏保持一致 */
export function MobileNav({ guest = false }: { guest?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t border-stone-200 bg-white md:hidden">
      {MOBILE_ITEMS.map((item) => {
        if (guest) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              className="flex cursor-not-allowed flex-col items-center justify-center gap-0.5 text-[11px] text-stone-300"
            >
              <item.icon className="h-[22px] w-[22px]" />
              {item.label}
            </span>
          );
        }
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 text-[11px]',
              active ? 'text-primary' : 'text-stone-500',
            )}
          >
            <item.icon className="h-[22px] w-[22px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
