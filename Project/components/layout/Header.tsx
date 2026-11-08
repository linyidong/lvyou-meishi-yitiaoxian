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
  { href: ROUTES.CITY, label: MESSAGES.NAV_NEW_ROUTE },
  { href: ROUTES.MY_ROUTES, label: MESSAGES.NAV_MY_ROUTES },
  { href: ROUTES.COLLECTED, label: MESSAGES.NAV_COLLECTED },
  { href: ROUTES.PROFILE, label: MESSAGES.NAV_PROFILE },
];

/** 当前项高亮：选城市 / 路线编辑 / 游客试用都算「新建路线」 */
function isActive(pathname: string, href: string) {
  if (href === ROUTES.HOME) return pathname === ROUTES.HOME;
  if (href === ROUTES.CITY) {
    return (
      pathname === ROUTES.CITY ||
      pathname.startsWith('/route') ||
      pathname.startsWith('/try')
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** 用户端顶部导航；未登录时右侧显示「登录 / 注册」入口 */
export function Header({
  displayName,
  isAdmin = false,
  isMember = false,
  showMemberBubble = false,
}: {
  displayName?: string | null;
  isAdmin?: boolean;
  isMember?: boolean;
  /** T-085：付费开通后 2 天内在「个人中心」旁显示金色气泡 */
  showMemberBubble?: boolean;
}) {
  const pathname = usePathname();
  /** 未登录 = 游客模式：工具栏（含 logo、首页）全部不可点击，只能操作当前页面内的功能 */
  const guest = !displayName;

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white">
      <div className="mx-auto flex h-14 w-full max-w-[1536px] items-center gap-6 px-4 md:h-16 md:px-6">
        {guest ? (
          // 游客态：logo 保留原样式但去掉跳转，避免把游客带离当前页面
          <span className="flex shrink-0 items-center gap-2">
            <Image
              src={PRODUCT.LOGO_PATH}
              alt={PRODUCT.NAME}
              width={36}
              height={36}
              className="h-9 w-9"
            />
            <span className="font-bold text-stone-900">{PRODUCT.NAME}</span>
          </span>
        ) : (
          <Link href={ROUTES.HOME} className="flex shrink-0 items-center gap-2">
            <Image
              src={PRODUCT.LOGO_PATH}
              alt={PRODUCT.NAME}
              width={36}
              height={36}
              className="h-9 w-9"
            />
            <span className="font-bold text-stone-900">{PRODUCT.NAME}</span>
          </Link>
        )}

        <nav className="hidden items-center gap-1 text-sm md:flex">
          {NAV_ITEMS.map((item) => {
            // 游客态下导航项全部置灰且不可点击（含首页）
            if (guest) {
              return (
                <span
                  key={item.href}
                  aria-disabled="true"
                  title={MESSAGES.NAV_GUEST_LOCKED}
                  className="cursor-not-allowed rounded-lg px-3 py-2 text-stone-300"
                >
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
                  'inline-flex items-center gap-1 rounded-lg px-3 py-2',
                  active
                    ? 'bg-primary/5 font-semibold text-primary'
                    : 'text-stone-600 hover:bg-stone-100',
                )}
              >
                {item.label}
                {item.href === ROUTES.PROFILE && showMemberBubble ? (
                  <span className="pointer-events-none ml-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] leading-none font-semibold whitespace-nowrap text-amber-600 shadow-sm">
                    已开通会员
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {displayName ? (
            <UserMenu displayName={displayName} isAdmin={isAdmin} isMember={isMember} />
          ) : (
            <>
              <span className="hidden rounded-lg bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary sm:inline">
                {MESSAGES.NAV_GUEST}
              </span>
              <Link
                href={ROUTES.LOGIN}
                className="flex h-11 items-center rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-4 text-sm font-semibold text-white hover:brightness-110 md:h-9"
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
