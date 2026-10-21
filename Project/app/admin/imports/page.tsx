import { BUSINESS } from '@/config/business';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { AdminImportsClient, type AdminImportRow } from '@/components/admin/AdminImportsClient';
import { AdminErrorState } from '@/components/admin/AdminState';
import { AdminShell } from '@/components/layout/AdminShell';
import { createClient } from '@/lib/supabase/server';
import { DatabaseZap } from 'lucide-react';
import type { ImportSource, ImportStatus } from '@/types';

/** A07 导入记录：只读全量导入记录（单次上限 B19） */
export default async function AdminImportsPage() {
  const supabase = createClient();

  const [importsRes, usersRes] = await Promise.all([
    supabase
      .from('imports')
      .select('id,user_id,raw_text,source,status,created_at')
      .order('created_at', { ascending: false })
      .limit(BUSINESS.ADMIN_LIST_LIMIT),
    supabase.from('users').select('id,email').limit(BUSINESS.ADMIN_LIST_LIMIT),
  ]);

  if (importsRes.error) {
    return (
      <AdminShell
        currentPath={ROUTES.ADMIN_IMPORTS}
        title={MESSAGES.ADMIN_SHELL.navImports}
        badge={MESSAGES.ADMIN_SHELL.badgeReadonly}
      >
        <AdminErrorState icon={<DatabaseZap className="mx-auto h-12 w-12 text-red-400" />} title={MESSAGES.ADMIN_IMPORTS.errorTitle} />
      </AdminShell>
    );
  }

  const emailById = new Map((usersRes.data ?? []).map((u) => [u.id, u.email]));
  // 未取到用户即在左连接失败时保持 null，前端显示 —
  const rows: AdminImportRow[] = (importsRes.data ?? []).map((r) => ({
    id: r.id,
    userEmail: emailById.get(r.user_id) ?? null,
    rawText: r.raw_text,
    source: r.source as ImportSource,
    status: r.status as ImportStatus,
    createdAt: r.created_at,
  }));

  return (
    <AdminShell
      currentPath={ROUTES.ADMIN_IMPORTS}
      title={MESSAGES.ADMIN_SHELL.navImports}
      badge={MESSAGES.ADMIN_SHELL.badgeReadonly}
    >
      <AdminImportsClient rows={rows} />
    </AdminShell>
  );
}
