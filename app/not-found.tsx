import Link from 'next/link';
import { PageHeader } from '@/components/common/PageHeader';
import { ROUTES } from '@/config/routes';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-4 px-4">
      <PageHeader title="404" description="这个页面不存在或已被移动。" />
      <Link
        href={ROUTES.HOME}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        返回首页
      </Link>
    </div>
  );
}
