'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { ROUTES } from '@/config/routes';
import { UserMenu } from '@/components/layout/UserMenu';
import { cn } from '@/lib/utils';

/** 顺序与原型 U02 顶部导航一致：首页 / 新建路线 / 我的路线 / 我的收藏 / 个人中心 */
const NAV_ITEMS = [
  { href: ROUTES.HOME, label: MESSAGES.NAV_HOME },
  { href: ROUTES.ROUTE_NEW, label: MESSAGES.NAV_NEW_ROUTE },
  { href: ROUTES.MY_ROUTES, label: MESSAGES.NAV_MY_ROUTES },
  { href: ROUTES.COLLECTED, label: MESSAGES.NAV_COLLECTED },
  { href: ROUTES.PROFILE, label: MESSAGES.NAV_PROFILE },
];

/** 当前项高亮：/route/new 与 /route/xxx 都算「新建路线」 */
function isActive(pathname: string, href: string) {
  if (href === ROUTES.HOME) return pathname === ROUTES.HOME;
  if (href === ROUTES.ROUTE_NEW) return pathname.startsWith('/route');
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** 用户端顶部导航；未登录时右侧显示「登录 / 注册」入口 */
export function Header({ displayName, isAdmin = false }: { displayName?: string | null; isAdmin?: boolean }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white">
      <div className="mx-auto flex h-14 w-full max-w-[1536px] items-center gap-6 px-4 md:h-16 md:px-6">
        <Link href={ROUTES.HOME} className="flex shrink-0 items-center gap-2">
          <Image src={PRODUCT.LOGO_PATH} alt={PRODUCT.NAME} width={36} height={36} className="h-9 w-9" />
          <span className="font-bold text-stone-900">{PRODUCT.NAME}</span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-lg px-3 py-2',
                  active
                    ? 'bg-primary/5 font-semibold text-primary'
                    : 'text-stone-600 hover:bg-stone-100',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {displayName ? (
            <UserMenu displayName={displayName} isAdmin={isAdmin} />
          ) : (
            <>
              <span className="hidden text-xs text-stone-400 sm:inline">{MESSAGES.NAV_GUEST}</span>
              <Link
                href={ROUTES.LOGIN}
                className="flex h-9 items-center rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-4 text-sm font-semibold text-white hover:brightness-110"
              >
                {MESSAGES.NAV_LOGIN_REGISTER}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
