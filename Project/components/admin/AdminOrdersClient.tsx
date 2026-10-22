'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReceiptText, Search } from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { MEMBER_PLAN_LABEL, ORDER_STATUS, ORDER_STATUS_LABEL, PAY_CHANNEL_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import type { MemberPlan, OrderStatus, PayChannel } from '@/types';

const M = MESSAGES.ADMIN_ORDERS;

export interface AdminOrderItem {
  id: string;
  email: string;
  plan: MemberPlan;
  amountCents: number;
  payNote: string | null;
  /** 付款通道（微信 / 支付宝收款码），管理员据此去对应账户对账 */
  payChannel: PayChannel;
  status: OrderStatus;
  rejectReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

type StatusFilter = 'all' | 'pending' | 'reviewed';

/** YYYY-MM-DD HH:mm */
function fmt(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 分 → 元 */
function yuan(cents: number) {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

const tabCls = (on: boolean) =>
  `rounded-md px-3 py-1 ${on ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`;

/** A08 管理端会员订单：待核销置顶 + 确认开通 / 驳回（收款码人工核销） */
export function AdminOrdersClient({ orders }: { orders: AdminOrderItem[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<AdminOrderItem[]>(orders);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminOrderItem | null>(null);
  const [reason, setReason] = useState('');
  const [modalError, setModalError] = useState('');
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  // 服务端刷新后同步本地列表
  useEffect(() => {
    setRows(orders);
  }, [orders]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return rows.filter((o) => {
      if (status === 'pending' && o.status !== ORDER_STATUS.PENDING) return false;
      if (status === 'reviewed' && o.status === ORDER_STATUS.PENDING) return false;
      if (!kw) return true;
      return [o.email, o.payNote].some((v) =>
        String(v ?? '')
          .toLowerCase()
          .includes(kw),
      );
    });
  }, [rows, keyword, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / BUSINESS.ADMIN_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (currentPage - 1) * BUSINESS.ADMIN_PAGE_SIZE,
    currentPage * BUSINESS.ADMIN_PAGE_SIZE,
  );

  function showToast(text: string, tone: 'ok' | 'err') {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 2600);
  }

  async function review(order: AdminOrderItem, approve: boolean, rejectReason?: string) {
    setBusyId(order.id);
    setModalError('');
    try {
      const res = await fetch(`/api/admin/member/orders/${order.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve, reason: rejectReason ?? '' }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string; status?: OrderStatus };
      if (!data.ok) {
        if (approve) showToast(data.message ?? M.actionFailed, 'err');
        else setModalError(data.message ?? M.actionFailed);
        return;
      }
      const nextStatus = data.status ?? (approve ? ORDER_STATUS.APPROVED : ORDER_STATUS.REJECTED);
      setRows((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? {
                ...o,
                status: nextStatus,
                rejectReason: approve ? null : (rejectReason ?? null),
                reviewedAt: new Date().toISOString(),
              }
            : o,
        ),
      );
      if (approve) {
        showToast(M.approveSuccess, 'ok');
      } else {
        setRejectTarget(null);
        setReason('');
        showToast(M.rejectSuccess, 'ok');
      }
      router.refresh();
    } catch {
      if (approve) showToast(M.actionFailed, 'err');
      else setModalError(M.actionFailed);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {/* 说明 */}
      <div className="mb-4 flex flex-col gap-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        <span>{M.notice}</span>
        <span className="text-slate-400">{M.desc}</span>
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
            placeholder={MESSAGES.ADMIN_USERS.searchPlaceholder}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-sm outline-none focus:border-slate-900"
          />
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
          {(
            [
              ['all', M.filterAll],
              ['pending', M.filterPending],
              ['reviewed', M.filterReviewed],
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
        <span className="text-sm text-slate-500 md:ml-auto">
          {M.pagination(rows.length, currentPage, totalPages)}
        </span>
      </div>

      {rows.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <ReceiptText className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 font-semibold">{M.emptyTitle}</p>
          <p className="mt-1 text-sm text-slate-500">{M.emptyDesc}</p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {/* T-023：手机端卡片视图（桌面仍用下方表格） */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {pageRows.map((o) => {
              const pending = o.status === ORDER_STATUS.PENDING;
              return (
                <li key={o.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate font-medium">{o.email}</p>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs ${
                        pending
                          ? 'bg-amber-100 font-medium text-amber-700'
                          : o.status === ORDER_STATUS.APPROVED
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {ORDER_STATUS_LABEL[o.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {MEMBER_PLAN_LABEL[o.plan]} · {PAY_CHANNEL_LABEL[o.payChannel]} ·{' '}
                    {M.amount(yuan(o.amountCents))}
                  </p>
                  {!pending && o.rejectReason ? (
                    <p className="mt-0.5 text-[11px] text-slate-400">{o.rejectReason}</p>
                  ) : null}
                  <p className="mt-0.5 truncate text-xs text-slate-400">{o.payNote || M.noNote}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400">{fmt(o.createdAt)}</span>
                    {pending ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busyId === o.id}
                          onClick={() => review(o, true)}
                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                        >
                          {busyId === o.id ? M.processing : M.approve}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === o.id}
                          onClick={() => {
                            setModalError('');
                            setReason('');
                            setRejectTarget(o);
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {M.reject}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:block">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{M.thTime}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thUser}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thPlan}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thChannel}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thAmount}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thNote}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thStatus}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((o) => {
                  const pending = o.status === ORDER_STATUS.PENDING;
                  return (
                    <tr key={o.id}>
                      <td className="px-4 py-3 text-slate-500">{fmt(o.createdAt)}</td>
                      <td className="px-4 py-3">{o.email}</td>
                      <td className="px-4 py-3">{MEMBER_PLAN_LABEL[o.plan]}</td>
                      <td className="px-4 py-3">{PAY_CHANNEL_LABEL[o.payChannel]}</td>
                      <td className="px-4 py-3">{M.amount(yuan(o.amountCents))}</td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-slate-600">
                        {o.payNote || M.noNote}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            pending
                              ? 'bg-amber-100 font-medium text-amber-700'
                              : o.status === ORDER_STATUS.APPROVED
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {ORDER_STATUS_LABEL[o.status]}
                        </span>
                        {!pending && o.rejectReason ? (
                          <span className="ml-1 text-[11px] text-slate-400">{o.rejectReason}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {pending ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={busyId === o.id}
                              onClick={() => review(o, true)}
                              className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                            >
                              {busyId === o.id ? M.processing : M.approve}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === o.id}
                              onClick={() => {
                                setModalError('');
                                setReason('');
                                setRejectTarget(o);
                              }}
                              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {M.reject}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pageRows.length === 0 ? (
            <div className="py-14 text-center">
              <ReceiptText className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">{M.emptyDesc}</p>
            </div>
          ) : null}

          {totalPages > 1 ? (
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
          ) : null}
        </section>
      )}

      <p className="mt-4 text-xs text-slate-400">{M.footNote}</p>

      {/* 驳回弹层 */}
      {rejectTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">{M.rejectTitle}</h3>
            <p className="mt-1 text-xs text-slate-500">{M.rejectDesc(rejectTarget.email)}</p>
            <label className="mt-4 block">
              <span className="text-xs font-medium text-slate-500">{M.rejectReasonLabel}</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={60}
                placeholder={M.rejectReasonPlaceholder}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
              />
            </label>
            {modalError ? <p className="mt-2 text-xs text-red-600">{modalError}</p> : null}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busyId === rejectTarget.id}
                onClick={() => setRejectTarget(null)}
                className="h-11 rounded-xl border border-slate-300 text-sm disabled:opacity-50"
              >
                {M.cancel}
              </button>
              <button
                type="button"
                disabled={busyId === rejectTarget.id}
                onClick={() => review(rejectTarget, false, reason)}
                className="h-11 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busyId === rejectTarget.id ? M.processing : M.rejectConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 结果反馈 */}
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
