import { PageHeader } from '@/components/common/PageHeader';
import { AdminShell } from '@/components/layout/AdminShell';
import { ROUTES } from '@/config/routes';

export default function AdminImportsPage() {
  return (
    <AdminShell currentPath={ROUTES.ADMIN_IMPORTS}>
      <PageHeader title="A07 导入记录" description="骨架占位：待阶段⑥实现（只读列表 + 分页）。" />
    </AdminShell>
  );
}
