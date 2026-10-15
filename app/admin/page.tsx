import { PageHeader } from '@/components/common/PageHeader';
import { AdminShell } from '@/components/layout/AdminShell';
import { ROUTES } from '@/config/routes';

export default function AdminHomePage() {
  return (
    <AdminShell currentPath={ROUTES.ADMIN_HOME}>
      <PageHeader title="A02 管理员概览" description="骨架占位：待阶段⑥实现（用户数 / 路线数 / 地点数统计）。" />
    </AdminShell>
  );
}
