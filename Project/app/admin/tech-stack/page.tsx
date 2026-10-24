import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { AdminShell } from '@/components/layout/AdminShell';
import { TechStackBoard } from '@/components/admin/TechStackBoard';

/**
 * T-050 管理端「技术栈」页：内容由 T-049 静态骨架升级为动态分层看板
 * （点击分层展开明细、SVG 连线流动、统计数字递增、hover 发光）。
 * 访问保护：middleware.ts 的 ADMIN_ROUTES 已要求 role=admin。
 */

const M = MESSAGES.ADMIN_TECH_STACK;

export default function AdminTechStackPage() {
  return (
    <AdminShell currentPath={ROUTES.ADMIN_TECH_STACK} title={M.title} badge={M.badge}>
      <TechStackBoard />
    </AdminShell>
  );
}
