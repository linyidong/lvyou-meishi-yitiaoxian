import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { AdminShell } from '@/components/layout/AdminShell';

/** A02 概览加载骨架（对齐原型 loading 态） */
export default function AdminHomeLoading() {
  return (
    <AdminShell
      currentPath={ROUTES.ADMIN_HOME}
      title={MESSAGES.ADMIN_SHELL.navOverview}
      overview
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-32 animate-pulse rounded-2xl bg-slate-200 ${
              i === 0 ? 'col-span-2 lg:col-span-1' : ''
            }`}
          />
        ))}
      </div>
      <div className="mt-6 h-72 animate-pulse rounded-2xl bg-slate-200" />
    </AdminShell>
  );
}
