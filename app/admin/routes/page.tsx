import { PageHeader } from '@/components/common/PageHeader';
import { AdminShell } from '@/components/layout/AdminShell';
import { ROUTES } from '@/config/routes';

export default function AdminRoutesPage() {
  return (
    <AdminShell currentPath={ROUTES.ADMIN_ROUTES}>
      <PageHeader title="A06 路线列表" description="骨架占位：待阶段⑥实现（只读列表 + 分页）。" />
    </AdminShell>
  );
}
