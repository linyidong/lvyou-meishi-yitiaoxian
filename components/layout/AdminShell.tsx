import { AdminSidebar } from '@/components/layout/AdminSidebar';

/** 管理员端页面外壳（侧边栏 + 内容区） */
export function AdminShell({ currentPath, children }: { currentPath: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 md:flex-row md:gap-6">
      <AdminSidebar currentPath={currentPath} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
