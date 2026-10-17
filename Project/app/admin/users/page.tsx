import { BUSINESS } from '@/config/business';
import { ROUTES } from '@/config/routes';
import {
  AdminUsersClient,
  type AdminUserItem,
  type MemberLogItem,
} from '@/components/admin/AdminUsersClient';
import { PageHeader } from '@/components/common/PageHeader';
import { AdminShell } from '@/components/layout/AdminShell';
import { createClient } from '@/lib/supabase/server';
import type { MemberAction, MemberSource, UserRole } from '@/types';

/** A03 用户列表：只读 + 两项写操作（会员开通 / 取消、删除普通用户账号）+ 会员操作留痕 */
export default async function AdminUsersPage() {
  const supabase = createClient();

  const [usersRes, logsRes] = await Promise.all([
    supabase
      .from('users')
      .select('id,email,username,role,member,member_since,member_source,last_seen_at,created_at')
      .order('created_at', { ascending: false })
      .limit(BUSINESS.ADMIN_LIST_LIMIT),
    supabase
      .from('member_logs')
      .select('id,target_user,action,source,operator_id,created_at')
      .order('created_at', { ascending: false })
      .limit(BUSINESS.MEMBER_LOG_LIMIT),
  ]);

  const emailById = new Map((usersRes.data ?? []).map((u) => [u.id, u.email ?? '—']));

  const users: AdminUserItem[] = (usersRes.data ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    username: u.username,
    role: u.role as UserRole,
    member: u.member,
    memberSince: u.member_since,
    memberSource: (u.member_source as MemberSource | null) ?? null,
    lastSeenAt: u.last_seen_at,
    createdAt: u.created_at,
  }));

  const logs: MemberLogItem[] = (logsRes.data ?? []).map((l) => ({
    id: l.id,
    targetEmail: emailById.get(l.target_user) ?? '—',
    action: l.action as MemberAction,
    source: l.source as MemberSource,
    operatorEmail: l.operator_id ? emailById.get(l.operator_id) ?? '—' : '—',
    createdAt: l.created_at,
  }));

  return (
    <AdminShell currentPath={ROUTES.ADMIN_USERS}>
      <PageHeader
        title="A03 用户列表"
        description={`用户为真实注册数据，在线状态按最后活跃时间 ≤ ${BUSINESS.ONLINE_THRESHOLD_MINUTES} 分钟计算 · 可写操作：开通 / 取消会员、删除普通用户账号。`}
      />
      {usersRes.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="font-semibold text-red-800">用户列表加载失败</p>
          <p className="mt-1 text-sm text-red-700">{usersRes.error.message}</p>
        </div>
      ) : (
        <AdminUsersClient users={users} logs={logs} />
      )}
    </AdminShell>
  );
}
