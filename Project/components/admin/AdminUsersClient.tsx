'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, Trash2 } from 'lucide-react';
import { BUSINESS } from '@/config/business';
import {
  MEMBER_ACTION,
  MEMBER_ACTION_LABEL,
  MEMBER_SOURCE_LABEL,
  USER_ROLE,
  USER_ROLE_LABEL,
} from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import type { MemberAction, MemberSource, UserRole } from '@/types';

export interface AdminUserItem {
  id: string;
  email: string | null;
  username: string | null;
  role: UserRole;
  member: boolean;
  memberSince: string | null;
  memberSource: MemberSource | null;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface MemberLogItem {
  id: string;
  targetEmail: string;
  action: MemberAction;
  source: MemberSource;
  operatorEmail: string;
  createdAt: string;
}

type StatusFilter = 'all' | 'on' | 'off';
type IdentityFilter = 'all' | 'free' | 'member';

/** YYYY-MM-DD HH:mm */
function fmt(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 最后活跃：≤ ONLINE_THRESHOLD_MINUTES 分钟为在线 */
function minutesAgo(iso: string | null) {
  if (!iso) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

const tabCls = (on: boolean) =>
  `rounded-lg px-3 py-1 text-sm font-medium ${on ? 'bg-foreground text-background' : 'text-muted-foreground'}`;

/** A03 用户列表：只读列表 + 两项写操作「开通 / 取消会员」「删除普通用户账号」+ 会员操作留痕 */
export function AdminUsersClient({
  users,
  logs,
}: {
  users: AdminUserItem[];
  logs: MemberLogItem[];
}) {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [identity, setIdentity] = useState<IdentityFilter>('all');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{ user: AdminUserItem; grant: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState('');
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return users.filter((u) => {
      const online = minutesAgo(u.lastSeenAt) <= BUSINESS.ONLINE_THRESHOLD_MINUTES;
      if (status === 'on' && !online) return false;
      if (status === 'off' && online) return false;
      if (identity === 'member' && !u.member) return false;
      if (identity === 'free' && u.member) return false;
      if (!kw) return true;
      return [u.email, u.username].some((v) =>
        String(v ?? '')
          .toLowerCase()
          .includes(kw),
      );
    });
  }, [users, keyword, status, identity]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / BUSINESS.ADMIN_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice(
    (currentPage - 1) * BUSINESS.ADMIN_PAGE_SIZE,
    currentPage * BUSINESS.ADMIN_PAGE_SIZE,
  );

  const onlineCount = users.filter((u) => minutesAgo(u.lastSeenAt) <= BUSINESS.ONLINE_THRESHOLD_MINUTES)
    .length;
  const memberCount = users.filter((u) => u.member).length;

  function showToast(text: string, tone: 'ok' | 'err') {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 2600);
  }

  function askMember(user: AdminUserItem) {
    setModalError('');
    setPending({ user, grant: !user.member });
  }

  function askDelete(user: AdminUserItem) {
    setDeleteError('');
    setDeleteTarget(user);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setDeleteError(data.message ?? MESSAGES.USER_DELETE_FAILED);
        return;
      }
      showToast(MESSAGES.USER_DELETED, 'ok');
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setDeleteError(MESSAGES.USER_DELETE_FAILED);
    } finally {
      setDeleting(false);
    }
  }

  async function confirmMember() {
    if (!pending) return;
    setBusy(true);
    setModalError('');
    try {
      const res = await fetch('/api/admin/member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pending.user.id, grant: pending.grant }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setModalError(data.message ?? MESSAGES.MEMBER_OP_FAILED);
        return;
      }
      showToast(pending.grant ? MESSAGES.MEMBER_GRANTED : MESSAGES.MEMBER_REVOKED, 'ok');
      setPending(null);
      router.refresh();
    } catch {
      setModalError(MESSAGES.MEMBER_OP_FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* 筛选 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
          placeholder="搜索邮箱或用户名"
          className="h-10 w-full max-w-xs rounded-lg border border-border px-3 text-sm outline-none focus:border-primary md:w-64"
        />
        <div className="flex rounded-lg border border-border bg-background p-1">
          {(
            [
              ['all', '全部'],
              ['on', '在线'],
              ['off', '离线'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
              className={tabCls(status === value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-border bg-background p-1">
          {(
            [
              ['all', '全部身份'],
              ['free', '普通用户'],
              ['member', '会员用户'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setIdentity(value);
                setPage(1);
              }}
              className={tabCls(identity === value)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground md:ml-auto">
          共 {users.length} 位用户 · 在线 {onlineCount} 位 · 会员 {memberCount} 位
        </span>
      </div>

      {/* 会员操作留痕 */}
      <section className="mb-4 rounded-2xl border border-border bg-background p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">会员操作留痕</h2>
          <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">写操作</span>
          <span className="ml-auto text-xs text-muted-foreground">
            最多展示最近 {BUSINESS.MEMBER_LOG_LIMIT} 条
          </span>
        </div>
        {logs.length === 0 ? (
          <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            暂无会员操作记录，点表格右侧「开通会员 / 取消会员」后在此留痕。
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-xs">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2">
                <span className="font-medium">{l.targetEmail}</span>
                <span
                  className={`rounded px-2 py-0.5 ${
                    l.action === MEMBER_ACTION.GRANT
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-muted-foreground/20 text-foreground'
                  }`}
                >
                  {MEMBER_ACTION_LABEL[l.action]}
                </span>
                <span className="text-muted-foreground">
                  {MEMBER_SOURCE_LABEL[l.source]} · 操作人 {l.operatorEmail}
                </span>
                <span className="ml-auto text-muted-foreground">{fmt(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 列表 */}
      <section className="overflow-hidden rounded-2xl border border-border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">邮箱</th>
                <th className="px-4 py-3 text-left font-medium">用户名</th>
                <th className="px-4 py-3 text-left font-medium">角色</th>
                <th className="px-4 py-3 text-left font-medium">在线状态</th>
                <th className="px-4 py-3 text-left font-medium">最后活跃</th>
                <th className="px-4 py-3 text-left font-medium">用户身份</th>
                <th className="px-4 py-3 text-left font-medium">管理员操作（会员）</th>
                <th className="px-4 py-3 text-left font-medium">删除账号</th>
                <th className="px-4 py-3 text-left font-medium">注册时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((u) => {
                const online = minutesAgo(u.lastSeenAt) <= BUSINESS.ONLINE_THRESHOLD_MINUTES;
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3">{u.email ?? '—'}</td>
                    <td className="px-4 py-3">{u.username ?? '—'}</td>
                    <td className="px-4 py-3">{USER_ROLE_LABEL[u.role]}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${
                          online
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {online ? '在线' : '离线'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmt(u.lastSeenAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${
                          u.member ? 'bg-amber-100 font-medium text-amber-700' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {u.member ? (
                          <>
                            <Crown className="h-3 w-3" />
                            会员用户
                          </>
                        ) : (
                          '普通用户'
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => askMember(u)}
                        className={`rounded-lg px-2.5 py-1 text-xs ${
                          u.member
                            ? 'border border-border text-muted-foreground hover:bg-muted'
                            : 'bg-amber-500 font-medium text-white hover:bg-amber-600'
                        }`}
                      >
                        {u.member ? '取消会员' : '开通会员'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {u.role === USER_ROLE.USER ? (
                        <button
                          type="button"
                          onClick={() => askDelete(u)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          删除账号
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmt(u.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm text-muted-foreground">
              {users.length === 0 ? '暂无注册用户' : '没有符合条件的用户'}
            </p>
            {users.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setKeyword('');
                  setStatus('all');
                  setIdentity('all');
                }}
                className="mt-3 text-sm underline"
              >
                清空筛选
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              共 {filtered.length} 条 · 第 {currentPage} / {totalPages} 页
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
                className="rounded-lg border border-border px-3 py-1 disabled:opacity-40"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
                className="rounded-lg border border-border px-3 py-1 disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="mt-4 text-xs text-muted-foreground">
        写操作仅两项：「开通 / 取消会员」与「删除账号」（仅可删普通用户，管理员账号不可删）。
        角色列（{USER_ROLE_LABEL[USER_ROLE.USER]} / {USER_ROLE_LABEL[USER_ROLE.ADMIN]}）为账号权限，
        用户身份列为会员权益状态，两者含义不同。
      </p>

      {/* 会员操作确认弹窗 */}
      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-background p-6">
            <h3 className="text-lg font-semibold">{pending.grant ? '开通会员' : '取消会员'}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              目标用户：{pending.user.email ?? '—'}
              {pending.user.username ? `（${pending.user.username}）` : ''}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {pending.grant
                ? `开通后该用户身份变为「会员用户」，可享受会员权益（${PRODUCT.MEMBER_BENEFITS.join('、')}）。`
                : '取消后该用户身份回到「普通用户」，将不再享受会员权益，历史路线与收藏保留。'}
            </p>
            {modalError ? <p className="mt-2 text-xs text-red-600">{modalError}</p> : null}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setPending(null)}
                className="h-11 rounded-xl border border-border text-sm disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirmMember}
                className="h-11 rounded-xl bg-foreground text-sm font-semibold text-background disabled:opacity-50"
              >
                {busy ? '处理中…' : pending.grant ? '确认开通' : '确认取消'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 删除账号确认弹窗 */}
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-background p-6">
            <h3 className="text-lg font-semibold text-red-600">删除账号</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              目标用户：{deleteTarget.email ?? '—'}
              {deleteTarget.username ? `（${deleteTarget.username}）` : ''}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {MESSAGES.USER_DELETE_CONFIRM(deleteTarget.email ?? '该账号')}
            </p>
            {deleteError ? <p className="mt-2 text-xs text-red-600">{deleteError}</p> : null}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="h-11 rounded-xl border border-border text-sm disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="h-11 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm text-white shadow-lg ${
            toast.tone === 'ok' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.text}
        </div>
      ) : null}
    </>
  );
}
