import Link from 'next/link';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

const SIDEBAR_ITEMS = [
  { href: ROUTES.ADMIN_HOME, label: '概览' },
  { href: ROUTES.ADMIN_USERS, label: '用户列表' },
  { href: ROUTES.ADMIN_ONLINE, label: '在线用户' },
  { href: ROUTES.ADMIN_PLACES, label: '地点列表' },
  { href: ROUTES.ADMIN_ROUTES, label: '路线列表' },
  { href: ROUTES.ADMIN_IMPORTS, label: '导入记录' },
];

/** 管理员端侧边栏 */
export function AdminSidebar({ currentPath }: { currentPath?: string }) {
  return (
    <aside className="w-full shrink-0 border-b border-border pb-3 md:w-48 md:border-b-0 md:border-r md:pb-0 md:pr-4">
      <nav className="flex flex-wrap gap-2 text-sm md:flex-col">
        {SIDEBAR_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground',
              currentPath === item.href && 'bg-muted font-medium text-foreground',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
