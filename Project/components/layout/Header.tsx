import Image from 'next/image';
import Link from 'next/link';
import { PRODUCT } from '@/config/product';
import { ROUTES } from '@/config/routes';
import { UserMenu } from '@/components/layout/UserMenu';

/** 顺序与原型 U02 导航一致：首页 / 新建路线 / 我的路线 / 我的收藏 / 个人中心 */
const NAV_ITEMS = [
  { href: ROUTES.HOME, label: '首页' },
  { href: ROUTES.ROUTE_NEW, label: '新建路线' },
  { href: ROUTES.MY_ROUTES, label: '我的路线' },
  { href: ROUTES.COLLECTED, label: '我的收藏' },
  { href: ROUTES.PROFILE, label: '个人中心' },
];

/** 用户端顶部导航；未登录时右侧显示「登录 / 注册」入口 */
export function Header({ displayName, isAdmin = false }: { displayName?: string | null; isAdmin?: boolean }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
        <Link href={ROUTES.HOME} className="flex shrink-0 items-center gap-2">
          <Image src={PRODUCT.LOGO_PATH} alt={PRODUCT.NAME} width={28} height={28} />
          <span className="hidden text-sm font-semibold sm:inline">{PRODUCT.NAME}</span>
        </Link>

        <nav className="ml-auto flex items-center gap-3 overflow-x-auto text-sm text-muted-foreground sm:gap-4">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="shrink-0 hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="shrink-0 border-l border-border pl-3">
          {displayName ? (
            <UserMenu displayName={displayName} isAdmin={isAdmin} />
          ) : (
            <Link
              href={ROUTES.LOGIN}
              className="flex h-8 items-center rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-3 text-xs font-semibold text-white hover:brightness-110"
            >
              登录 / 注册
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
