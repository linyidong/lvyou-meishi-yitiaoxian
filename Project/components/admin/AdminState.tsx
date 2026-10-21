'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { MESSAGES } from '@/config/messages';
import { cn } from '@/lib/utils';

/** 管理端「失败重试」按钮（真实可达：接口出错时点击重新拉取） */
export function AdminRetryButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className={cn(
        'h-10 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white',
        className,
      )}
    >
      {MESSAGES.ADMIN_COMMON.retry}
    </button>
  );
}

/** 列表加载骨架（原型 data-state="loading"，Next 路由级 loading.tsx 使用） */
export function AdminListSkeleton({ className, rows = 4 }: { className?: string; rows?: number }) {
  return (
    <section className={cn('space-y-3 rounded-2xl border border-slate-200 bg-white p-4', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
      ))}
    </section>
  );
}

/** 空态（真实可达：列表无数据时） */
export function AdminEmptyState({
  icon: Icon,
  title,
  desc,
  className,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center',
        className,
      )}
    >
      <Icon className="mx-auto h-12 w-12 text-slate-300" />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </section>
  );
}

/** 加载失败（真实可达：Supabase 查询出错时） */
export function AdminErrorState({
  title,
  desc,
  icon,
  className,
}: {
  title: string;
  desc?: string;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-red-200 bg-red-50 py-16 text-center',
        className,
      )}
    >
      {icon}
      <p className="mt-3 font-semibold text-red-700">{title}</p>
      {desc ? <p className="mt-1 text-sm text-red-600">{desc}</p> : null}
      <AdminRetryButton className="mt-4" />
    </section>
  );
}
