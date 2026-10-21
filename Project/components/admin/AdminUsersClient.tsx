'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Crown, Search, Trash2, UserSearch, UserX } from 'lucide-react';
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

const M = MESSAGES.ADMIN_USERS;

export interface AdminUserItem {
  id: string;
  email: string | null;
  username: string | null;
  role: UserRole;
  member: boolean;
  /** T-018：会员到期时间（ISO）；null = 永久或未开通 */
  memberUntil: string | null;
  /** T-018：服务端按 isMemberActive 判定的「有效会员」（管理员/永久/未到期为 true，已过期为 false） */
  memberActive: boolean;
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

/** YYYY-MM-DD */
function fmt(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** YYYY-MM-DD（T-018 会员到期日展示） */
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 最后活跃：≤ ONLINE_THRESHOLD_MINUTES 分钟为在线 */
function minutesAgo(iso: string | null) {
  if (!iso) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

/**
 * 会员权益判定（T-018）：改用服务端 `isMemberActive` 的派生结果 `memberActive`
 * （管理员恒为 true；付费会员按 member_until 惰性判定，已过期视为非会员，
 * 与用户端配额口径一致）。用于身份筛选与「会员 N 位」统计。
 */
function isMemberRow(u: AdminUserItem) {
  return u.memberActive;
}

/**
 * T-018 三态徽章派生：管理员永久 / 永久会员 / 有效会员（带到期日）/ 已过期 / 非会员。
 * 有效性来自服务端 isMemberActive；`member && !memberActive` 即「曾开通但已到期」。
 */
function memberStateOf(u: AdminUserItem): 'admin' | 'forever' | 'active' | 'expired' | 'none' {
  if (u.role === USER_ROLE.ADMIN) return 'admin';
  if (!u.member) return 'none';
  if (!u.memberActive) return 'expired';
  return u.memberUntil ? 'active' : 'forever';
}

/** 筛选 Tab（原型：白底描边容器 + 内嵌按钮） */
const tabCls = (on: boolean) =>
  `rounded-md px-3 py-1 ${on ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`;

/** A03 用户列表：管理员置顶 + 会员开通 / 取消（管理员默认最高级会员，不可改）+ 删除普通用户账号 + 会员操作留痕 */
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
      if (identity === 'member' && !isMemberRow(u)) return false;
      if (identity === 'free' && isMemberRow(u)) return false;
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

  const onlineCount = users.filter(
    (u) => minutesAgo(u.lastSeenAt) <= BUSINESS.ONLINE_THRESHOLD_MINUTES,
  ).length;
  const memberCount = users.filter(isMemberRow).length;

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
      {/* 约束变更说明 */}
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {M.noticeLead}
          <strong>{M.noticeStrong}</strong>
          {M.noticeTail}
        </span>
      </div>

      {/* 筛选 */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            placeholder={M.searchPlaceholder}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-sm outline-none focus:border-slate-900"
          />
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
          {(
            [
              ['all', M.statusAll],
              ['on', M.statusOn],
              ['off', M.statusOff],
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
        <div className="flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
          {(
            [
              ['all', M.identityAll],
              ['free', M.identityFree],
              ['member', M.identityMember],
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
        <span className="text-sm text-slate-500 md:ml-auto">
          共 {users.length} 位用户 · 在线 {onlineCount} 位 · 会员 {memberCount} 位
        </span>
      </div>

      {/* 会员操作留痕 */}
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">{M.logTitle}</h2>
          <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
            {M.logTag}
          </span>
          <span className="ml-auto text-xs text-slate-400">{M.logLimit}</span>
        </div>
        {logs.length === 0 ? (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{M.logEmpty}</p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-xs">
            {logs.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"
              >
                <span className="font-medium">{l.targetEmail}</span>
                <span
                  className={`rounded px-2 py-0.5 ${
                    l.action === MEMBER_ACTION.GRANT
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {MEMBER_ACTION_LABEL[l.action]}
                </span>
                <span className="text-slate-500">
                  {MEMBER_SOURCE_LABEL[l.source]} · 操作人 {l.operatorEmail}
                </span>
                <span className="ml-auto text-slate-500">{fmt(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 列表 */}
      {users.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <UserX className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 font-semibold">{M.emptyTitle}</p>
          <p className="mt-1 text-sm text-slate-500">{M.emptyDesc}</p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{M.thEmail}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thUsername}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thRole}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thOnline}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thLastSeen}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thIdentity}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thMemberAction}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thDelete}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thCreatedAt}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((u) => {
                  const online = minutesAgo(u.lastSeenAt) <= BUSINESS.ONLINE_THRESHOLD_MINUTES;
                  const mstate = memberStateOf(u);
                  return (
                    <tr key={u.id}>
                      <td className="px-4 py-3">{u.email ?? '—'}</td>
                      <td className="px-4 py-3">{u.username ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            u.role === USER_ROLE.ADMIN
                              ? 'bg-slate-900 font-medium text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {USER_ROLE_LABEL[u.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${
                            online
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {online ? M.online : M.offline}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{fmt(u.lastSeenAt)}</td>
                      <td className="px-4 py-3">
                        {/* T-018 三态徽章：有效=绿色系 / 永久=紫色系 / 已过期=琥珀色 / 非会员=灰 */}
                        {mstate === 'none' ? (
                          <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                            {M.memberNone}
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                              mstate === 'expired'
                                ? 'bg-amber-50 text-amber-600'
                                : mstate === 'active'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-violet-100 text-violet-700'
                            }`}
                          >
                            {mstate !== 'expired' && <Crown className="h-3 w-3" />}
                            {mstate === 'admin'
                              ? M.memberAdminBadge
                              : mstate === 'forever'
                                ? M.memberForever
                                : mstate === 'active'
                                  ? M.memberActiveUntil(fmtDate(u.memberUntil))
                                  : M.memberExpired}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.role === USER_ROLE.ADMIN ? (
                          <span className="text-xs text-slate-500">{M.memberActionFixed}</span>
                        ) : mstate === 'expired' ? (
                          /* T-018：已过期用户不再显示可点的「取消会员」（误导操作），禁用并显示「已过期」；不新增写库行为 */
                          <button
                            type="button"
                            disabled
                            aria-disabled="true"
                            className="cursor-not-allowed rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-400"
                          >
                            {M.memberExpired}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => askMember(u)}
                            className={`rounded-lg px-2.5 py-1 text-xs ${
                              u.member
                                ? 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                                : 'bg-amber-500 font-medium text-white hover:bg-amber-600'
                            }`}
                          >
                            {u.member ? M.memberRevoke : M.memberGrant}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.role === USER_ROLE.USER ? (
                          <button
                            type="button"
                            onClick={() => askDelete(u)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                            {M.deleteAccount}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{fmt(u.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {rows.length === 0 ? (
            <div className="py-14 text-center">
              <UserSearch className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">
                {M.noMatchPrefix}
                {keyword.trim()}
                {M.noMatchSuffix}
              </p>
              <button
                type="button"
                onClick={() => {
                  setKeyword('');
                  setStatus('all');
                  setIdentity('all');
                  setPage(1);
                }}
                className="mt-3 text-sm text-slate-900 underline"
              >
                {M.clearSearch}
              </button>
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
            <span className="text-slate-500">
              {M.pagination(filtered.length, currentPage, totalPages)}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
                className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
              >
                {M.prev}
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
                className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
              >
                {M.next}
              </button>
            </div>
          </div>
        </section>
      )}

      <p className="mt-4 text-xs text-slate-400">{M.footNote}</p>

      {/* 会员操作确认弹窗 */}
      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              {pending.grant ? M.modalGrantTitle : M.modalRevokeTitle}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {M.modalTarget(pending.user.email ?? '—', pending.user.username)}
            </p>
            <p className="mt-3 text-sm text-slate-600">
              {pending.grant
                ? M.modalGrantDesc(PRODUCT.MEMBER_BENEFITS.join('、'))
                : M.modalRevokeDesc}
            </p>
            <p className="mt-2 text-xs text-slate-400">{M.modalNote}</p>
            {modalError ? <p className="mt-2 text-xs text-red-600">{modalError}</p> : null}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setPending(null)}
                className="h-11 rounded-xl border border-slate-300 text-sm disabled:opacity-50"
              >
                {M.modalCancel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirmMember}
                className="h-11 rounded-xl bg-slate-900 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy
                  ? M.processing
                  : pending.grant
                    ? M.modalConfirmGrant
                    : M.modalConfirmRevoke}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 删除账号确认弹窗 */}
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h3 className="text-lg font-semibold text-red-600">{M.deleteTitle}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {M.modalTarget(deleteTarget.email ?? '—', deleteTarget.username)}
            </p>
            <p className="mt-3 text-sm text-slate-600">
              {MESSAGES.USER_DELETE_CONFIRM(deleteTarget.email ?? '该账号')}
            </p>
            {deleteError ? <p className="mt-2 text-xs text-red-600">{deleteError}</p> : null}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="h-11 rounded-xl border border-slate-300 text-sm disabled:opacity-50"
              >
                {M.modalCancel}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="h-11 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? M.deleting : M.deleteConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 写操作结果反馈 */}
      {toast ? (
        <div
          className={`fixed top-20 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm text-white shadow-lg ${
            toast.tone === 'ok' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.text}
        </div>
      ) : null}
    </>
  );
}
