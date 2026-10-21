import { BUSINESS } from '@/config/business';
import { USER_ROLE } from '@/config/enums';
import { ROUTES } from '@/config/routes';
import {
  AdminUsersClient,
  type AdminUserItem,
  type MemberLogItem,
} from '@/components/admin/AdminUsersClient';
import { AdminErrorState } from '@/components/admin/AdminState';
import { AdminShell } from '@/components/layout/AdminShell';
import { MESSAGES } from '@/config/messages';
import { isMemberActive } from '@/lib/member-quota';
import { createClient } from '@/lib/supabase/server';
import { DatabaseZap } from 'lucide-react';
import type { MemberAction, MemberSource, UserRole } from '@/types';

/** A03 用户列表：只读 + 两项写操作（会员开通 / 取消、删除普通用户账号）+ 会员操作留痕 */
export default async function AdminUsersPage() {
  const supabase = createClient();

  const [usersRes, logsRes] = await Promise.all([
    supabase
      .from('users')
      .select('id,email,username,role,member,member_until,member_since,member_source,last_seen_at,created_at')
      .order('created_at', { ascending: false })
      .limit(BUSINESS.ADMIN_LIST_LIMIT),
    supabase
      .from('member_logs')
      .select('id,target_user,action,source,operator_id,created_at')
      .order('created_at', { ascending: false })
      .limit(BUSINESS.MEMBER_LOG_LIMIT),
  ]);

  const emailById = new Map((usersRes.data ?? []).map((u) => [u.id, u.email ?? '—']));

  // 管理员账号置顶展示，其余用户按注册时间倒序（SQL 侧已按倒序返回，此处仅把管理员提前）
  const users: AdminUserItem[] = (usersRes.data ?? [])
    .map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      role: u.role as UserRole,
      member: u.member,
      // T-018：member_until 透传 + 服务端复用 isMemberActive 判定有效性
      //（lib/member-quota 为服务端专用模块，不可被 'use client' 组件直接 import）
      memberUntil: (u.member_until as string | null) ?? null,
      memberActive: isMemberActive(u.role, u.member, u.member_until),
      memberSince: u.member_since,
      memberSource: (u.member_source as MemberSource | null) ?? null,
      lastSeenAt: u.last_seen_at,
      createdAt: u.created_at,
    }))
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === USER_ROLE.ADMIN ? -1 : 1;
      return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));
    });

  const logs: MemberLogItem[] = (logsRes.data ?? []).map((l) => ({
    id: l.id,
    targetEmail: emailById.get(l.target_user) ?? '—',
    action: l.action as MemberAction,
    source: l.source as MemberSource,
    operatorEmail: l.operator_id ? emailById.get(l.operator_id) ?? '—' : '—',
    createdAt: l.created_at,
  }));

  return (
    <AdminShell
      currentPath={ROUTES.ADMIN_USERS}
      title={MESSAGES.ADMIN_SHELL.navUsers}
      badge={MESSAGES.ADMIN_SHELL.badgeUsers}
      showAdminName
    >
      {usersRes.error ? (
        <AdminErrorState icon={<DatabaseZap className="mx-auto h-12 w-12 text-red-400" />} title={MESSAGES.ADMIN_USERS.errorTitle} />
      ) : (
        <AdminUsersClient users={users} logs={logs} />
      )}
    </AdminShell>
  );
}
