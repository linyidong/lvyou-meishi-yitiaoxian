import Image from 'next/image';
import Link from 'next/link';
import { PRODUCT } from '@/config/product';
import { ROUTES } from '@/config/routes';

const NAV_ITEMS = [
  { href: ROUTES.HOME, label: '首页' },
  { href: ROUTES.MY_ROUTES, label: '我的路线' },
  { href: ROUTES.ROUTE_NEW, label: '新建路线' },
  { href: ROUTES.PROFILE, label: '个人中心' },
];

/** 用户端顶部导航 */
export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4">
        <Link href={ROUTES.HOME} className="flex items-center gap-2">
          <Image src={PRODUCT.LOGO_PATH} alt={PRODUCT.NAME} width={28} height={28} />
          <span className="text-sm font-semibold">{PRODUCT.NAME}</span>
        </Link>

        <nav className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
