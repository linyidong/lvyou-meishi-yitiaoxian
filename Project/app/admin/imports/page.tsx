import { BUSINESS } from '@/config/business';
import { IMPORT_STATUS } from '@/config/enums';
import { ROUTES } from '@/config/routes';
import { AdminImportsClient, type AdminImportRow } from '@/components/admin/AdminImportsClient';
import { PageHeader } from '@/components/common/PageHeader';
import { AdminShell } from '@/components/layout/AdminShell';
import { createClient } from '@/lib/supabase/server';
import type { ImportSource, ImportStatus } from '@/types';

/** 内容摘要截断长度（字） */
const SUMMARY_MAX_LENGTH = 80;

/** A07 导入记录：只读，单次上限 B19 */
export default async function AdminImportsPage() {
  const supabase = createClient();

  const [importsRes, usersRes] = await Promise.all([
    supabase
      .from('imports')
      .select('id,user_id,raw_text,source,status,created_at')
      .order('created_at', { ascending: false })
      .limit(BUSINESS.ADMIN_LIST_LIMIT),
    supabase.from('users').select('id,email'),
  ]);

  if (importsRes.error) {
    return (
      <AdminShell currentPath={ROUTES.ADMIN_IMPORTS}>
        <PageHeader title="A07 导入记录" />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="font-semibold text-red-800">导入记录加载失败</p>
          <p className="mt-1 text-sm text-red-700">{importsRes.error.message}</p>
        </div>
      </AdminShell>
    );
  }

  const emailById = new Map((usersRes.data ?? []).map((u) => [u.id, u.email]));

  const rows: AdminImportRow[] = (importsRes.data ?? []).map((it) => {
    const raw = (it.raw_text ?? '').replace(/\s+/g, ' ').trim();
    return {
      id: it.id,
      createdAt: it.created_at,
      userEmail: emailById.get(it.user_id) ?? null,
      source: it.source as ImportSource,
      summary:
        raw.length > SUMMARY_MAX_LENGTH ? `${raw.slice(0, SUMMARY_MAX_LENGTH)}…` : raw || '（空）',
      status: it.status as ImportStatus,
    };
  });

  return (
    <AdminShell currentPath={ROUTES.ADMIN_IMPORTS}>
      <PageHeader
        title="A07 导入记录"
        description={`只读列表，按导入时间倒序 · 摘要截断 ${SUMMARY_MAX_LENGTH} 字 · 单次最多读取 ${BUSINESS.ADMIN_LIST_LIMIT} 条。`}
      />
      <AdminImportsClient rows={rows} />
    </AdminShell>
  );
}
