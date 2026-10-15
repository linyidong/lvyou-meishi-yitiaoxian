import { PageHeader } from '@/components/common/PageHeader';
import { AdminShell } from '@/components/layout/AdminShell';
import { BUSINESS } from '@/config/business';
import { ROUTES } from '@/config/routes';

export default function AdminOnlinePage() {
  return (
    <AdminShell currentPath={ROUTES.ADMIN_ONLINE}>
      <PageHeader
        title="A04 在线用户"
        description={`骨架占位：在线判定 ${BUSINESS.ONLINE_THRESHOLD_MINUTES} 分钟，待阶段⑥实现。`}
      />
    </AdminShell>
  );
}
