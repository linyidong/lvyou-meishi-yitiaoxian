import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { AdminFeedbackClient, type AdminFeedbackItem } from '@/components/admin/AdminFeedbackClient';
import { AdminShell } from '@/components/layout/AdminShell';
import { createAdminClient } from '@/lib/supabase/admin';

/** T-098 意见箱：service_role 读取全部建议（用户端只能看自己的） */
export default async function AdminFeedbackPage() {
  const admin = createAdminClient();
  let items: AdminFeedbackItem[] = [];
  let failed = false;

  try {
    const { data: rows, error } = await admin
      .from('feedback')
      .select('id,user_id,page_key,feature_key,content,status,admin_note,created_at')
      .eq('hidden_by_admin', false)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) failed = true;

    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id as string)));
    const { data: users } = userIds.length
      ? await admin.from('users').select('id,email,username').in('id', userIds)
      : { data: [] as { id: string; email: string | null; username: string | null }[] };
    const labelOf = new Map(
      (users ?? []).map((u) => [u.id, u.username ?? u.email ?? MESSAGES.ADMIN_FEEDBACK.userUnknown]),
    );

    items = (rows ?? []).map((r) => ({
      id: r.id as string,
      pageKey: r.page_key as string,
      featureKey: r.feature_key as string,
      content: r.content as string,
      status: r.status as AdminFeedbackItem['status'],
      adminNote: (r.admin_note as string | null) ?? null,
      createdAt: r.created_at as string,
      userLabel: labelOf.get(r.user_id as string) ?? MESSAGES.ADMIN_FEEDBACK.userUnknown,
    }));
  } catch {
    failed = true;
  }

  return (
    <AdminShell
      currentPath={ROUTES.ADMIN_FEEDBACK}
      title={MESSAGES.ADMIN_FEEDBACK.title}
    >
      <p className="mb-4 text-sm text-stone-500">{MESSAGES.ADMIN_FEEDBACK.desc}</p>
      {failed ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {MESSAGES.ADMIN_FEEDBACK.loadFailed}
        </p>
      ) : (
        <AdminFeedbackClient items={items} />
      )}
    </AdminShell>
  );
}
