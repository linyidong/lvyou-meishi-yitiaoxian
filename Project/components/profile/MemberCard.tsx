'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Crown } from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { EVENT_NAME, MEMBER_PLAN_LABEL, MEMBER_SOURCE_LABEL, ORDER_STATUS } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { trackEvent } from '@/lib/events';
import type { MemberPlan, MemberSource, PayChannel } from '@/types';

const M = MESSAGES.PROFILE;
/** 收银台文案（阶段 3 真实付费） */
const MO = MESSAGES.MEMBER_ORDER;

/** YYYY-MM-DD */
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 分 → 元（整数不带小数，非整数保留两位） */
function yuan(cents: number) {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** 待核销订单摘要（个人中心传入） */
export interface PendingOrderInfo {
  plan: MemberPlan;
  createdAt: string;
}

/**
 * U10 会员卡（按登录身份展示对应档位规则）：
 * - 管理员：标题与权益取自 PRODUCT.ADMIN_BENEFITS（管理员 = 最高级会员，配额不限）；
 * - 会员：标题与权益取自 PRODUCT.MEMBER_BENEFITS（会员每月 10 条路线 / 7 天 / 单日 12 个地点 / 文案识别 20 次每日）；
 * - 普通用户：展示 PRODUCT.FREE_BENEFITS（免费版规则），右侧保留「升级为会员」入口。
 * 付费流程：BUSINESS.ENABLE_REAL_PAYMENT = true 时点击进入收款码收银台，提交订单后展示「已提交，等待管理员核销」；
 *         false 时保留旧的模拟支付弹层（POST /api/member）。
 */
export function MemberCard({
  member,
  isAdmin,
  memberSince,
  memberSource,
  memberUntil,
  pendingOrder,
}: {
  member: boolean;
  /** 管理员身份（管理员在库侧同样是会员，但展示的是不限配额的管理员规则） */
  isAdmin: boolean;
  memberSince: string | null;
  memberSource: MemberSource | null;
  /** 会员到期时间；null = 永久会员 */
  memberUntil: string | null;
  pendingOrder: PendingOrderInfo | null;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  /** 收银台：已选套餐 / 已选收款码通道 / 付款备注 */
  const [plan, setPlan] = useState<MemberPlan>('month');
  const [channel, setChannel] = useState<PayChannel>(BUSINESS.MEMBER_PAY_CHANNELS[0].key);
  const [payNote, setPayNote] = useState('');
  /**
   * 收银台阶段（A 半自动链路）：
   * form 填单 → waiting 已提交、等待管理员核对到账（弹窗内轮询）
   * → 核销后自动关闭弹窗并提示成功；驳回 / 超时则给出对应提示
   */
  const [stage, setStage] = useState<'form' | 'waiting' | 'rejected' | 'timeout'>('form');
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);

  function showToast(text: string, tone: 'ok' | 'err') {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 2600);
  }

  function openUpgrade() {
    void trackEvent(EVENT_NAME.CLICK_UPGRADE, { from: 'profile' });
    setErrorText('');
    setSubmittedId(null);
    setRejectReason(null);
    setStage('form');
    setModalOpen(true);
  }

  /** 旧的模拟自助升级（ENABLE_REAL_PAYMENT = false 时保留） */
  async function confirmUpgrade() {
    setBusy(true);
    setErrorText('');
    try {
      const res = await fetch('/api/member', { method: 'POST' });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setErrorText(data.message ?? MESSAGES.MEMBER_OP_FAILED);
        return;
      }
      void trackEvent(EVENT_NAME.MEMBER_CHANGE, { action: 'grant', source: 'self' });
      setModalOpen(false);
      showToast(MESSAGES.MEMBER_GRANTED, 'ok');
      router.refresh();
    } catch {
      setErrorText(MESSAGES.MEMBER_OP_FAILED);
    } finally {
      setBusy(false);
    }
  }

  /** 阶段 3：提交付费订单（收款码人工核销） */
  async function submitOrder() {
    setBusy(true);
    setErrorText('');
    try {
      const res = await fetch('/api/member/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, payNote, payChannel: channel }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string; orderId?: string };
      if (!data.ok || !data.orderId) {
        setErrorText(data.message ?? MO.errOrderFailed);
        return;
      }
      void trackEvent(EVENT_NAME.CLICK_UPGRADE, { from: 'profile', plan });
      setSubmittedId(data.orderId);
      setPayNote('');
      setStage('waiting');
      router.refresh();
    } catch {
      setErrorText(MO.errOrderFailed);
    } finally {
      setBusy(false);
    }
  }

  /**
   * A 半自动链路：进入「等待到账确认」态后轮询订单状态。
   * 管理员在后台核对流水并核销 → 这里感知到 approved 即自动关闭弹窗、提示开通成功并刷新页面；
   * 驳回 → 展示原因并允许重新提交；超时 → 提示用户稍后回来查看（开通依然会生效）。
   */
  const pollStartRef = useRef(0);
  useEffect(() => {
    if (!modalOpen || stage !== 'waiting') return;
    pollStartRef.current = Date.now();
    const interval = BUSINESS.ORDER_STATUS_POLL_SECONDS * 1000;
    const timeout = BUSINESS.ORDER_STATUS_POLL_TIMEOUT_MINUTES * 60 * 1000;

    const timer = window.setInterval(async () => {
      if (Date.now() - pollStartRef.current > timeout) {
        window.clearInterval(timer);
        setStage('timeout');
        return;
      }
      try {
        const res = await fetch('/api/member/orders/status', { cache: 'no-store' });
        const data = (await res.json()) as {
          ok: boolean;
          order: { id: string; status: string; reject_reason: string | null } | null;
          member: boolean;
          memberUntil: string | null;
        };
        if (!data.ok) return;

        // 核销成功：自动关闭弹窗 + 提示开通成功（用户无需手动刷新）
        if (data.member || data.order?.status === ORDER_STATUS.APPROVED) {
          window.clearInterval(timer);
          setModalOpen(false);
          setStage('form');
          showToast(
            data.memberUntil ? MO.successDesc(fmtDate(data.memberUntil)) : MO.successTitleForever,
            'ok',
          );
          router.refresh();
          return;
        }
        if (data.order?.status === ORDER_STATUS.REJECTED) {
          window.clearInterval(timer);
          setRejectReason(data.order.reject_reason);
          setStage('rejected');
        }
      } catch {
        // 单次轮询失败静默，下一轮继续
      }
    }, interval);

    return () => window.clearInterval(timer);
  }, [modalOpen, stage, router]);

  /** 已开通身份（会员 / 管理员）的权益文案：管理员不限配额，会员按会员档配额 */
  const benefits = (isAdmin ? PRODUCT.ADMIN_BENEFITS : PRODUCT.MEMBER_BENEFITS).join('、');
  const validityText = memberUntil ? M.memberUntil(fmtDate(memberUntil)) : M.memberForever;
  /** 收银台当前选中的收款码通道（配置缺失时回退到第一个通道，保证图片总能渲染） */
  const payChannel =
    BUSINESS.MEMBER_PAY_CHANNELS.find((c) => c.key === channel) ?? BUSINESS.MEMBER_PAY_CHANNELS[0];

  return (
    <>
      {member ? (
        <section className="flex items-start gap-3 rounded-2xl bg-gradient-to-br from-primary-from to-primary-to p-5 text-white">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20 text-amber-300">
            <Crown className="h-[22px] w-[22px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-amber-300">
              {isAdmin ? M.adminOnTitle : M.memberOnTitle}
            </p>
            <p className="mt-1 text-sm font-semibold text-amber-200">
              {isAdmin ? M.adminOnDesc(benefits) : M.memberOnDesc(benefits)}
            </p>
            <p className="mt-1 text-xs font-semibold text-amber-200">
              {M.memberOnMeta(
                fmtDate(memberSince),
                memberSource ? MEMBER_SOURCE_LABEL[memberSource] : M.sourceUnknown,
              )}
              {' · '}
              {validityText}
            </p>
          </div>
        </section>
      ) : (
        <section className="relative grid items-center gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-from to-primary-to p-5 text-white md:grid-cols-3 md:p-6">
          <div className="absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-white/10" />
          <div className="relative md:col-span-2">
            <p className="flex items-center gap-1 text-xs font-semibold text-white/90">
              <Crown className="h-4 w-4" />
              {M.upgradeTag}
            </p>
            <h2 className="mt-2 text-xl font-bold">{M.upgradeTitle}</h2>
            <ul className="mt-3 grid gap-1.5 text-sm text-white/80 sm:grid-cols-2">
              {PRODUCT.FREE_BENEFITS.map((item) => (
                <li key={item} className="flex gap-1.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            {BUSINESS.ENABLE_UPGRADE_BUTTON ? (
              <button
                type="button"
                onClick={openUpgrade}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white font-bold text-primary-from hover:bg-white/90"
              >
                {M.upgradeBtn}
              </button>
            ) : (
              <p className="text-sm text-white/80">{MESSAGES.UPGRADE_TOAST}</p>
            )}
            <p className="mt-2 text-center text-[11px] text-white/70">
              {BUSINESS.ENABLE_REAL_PAYMENT ? M.upgradeNoteReal : M.upgradeNoteMock}
            </p>
          </div>
        </section>
      )}

      {/* 待核销订单提示条 */}
      {!member && pendingOrder ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary-from/20 bg-primary-from/10 px-4 py-2.5 text-sm text-primary-from">
          <Crown className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            {MO.pendingTip}
            <span className="ml-1 text-xs text-primary-to">
              {MO.pendingTipPlan(
                MEMBER_PLAN_LABEL[pendingOrder.plan],
                fmtDate(pendingOrder.createdAt),
              )}
            </span>
          </span>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4">
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6">
            {stage === 'waiting' ? (
              <>
                <div className="-mx-6 -mt-6 mb-4 rounded-t-2xl bg-gradient-to-r from-primary-from to-primary-to px-6 py-4 text-white">
                  <h3 className="text-lg font-semibold">{MO.waitingTitle}</h3>
                </div>
                <p className="mt-2 text-sm text-stone-600">{MO.waitingDesc}</p>
                {submittedId ? (
                  <p className="mt-2 text-xs text-stone-400">{MO.waitingOrder(submittedId)}</p>
                ) : null}
                <div className="mt-5 flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-stone-300 border-t-primary-from" />
                  <span className="text-xs text-stone-500">{MO.waitingHint}</span>
                </div>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      setStage('form');
                    }}
                    className="h-11 w-full rounded-xl border border-stone-300 text-sm font-medium text-stone-700 hover:bg-stone-50"
                  >
                    {MO.close}
                  </button>
                </div>
              </>
            ) : stage === 'rejected' ? (
              <>
                <div className="-mx-6 -mt-6 mb-4 rounded-t-2xl bg-red-500 px-6 py-4 text-white">
                  <h3 className="text-lg font-semibold">{MO.rejectedTitle}</h3>
                </div>
                <p className="mt-2 text-sm text-stone-600">{MO.rejectedDesc(rejectReason)}</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      setStage('form');
                    }}
                    className="h-11 rounded-xl border border-stone-300 text-sm"
                  >
                    {MO.close}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStage('form')}
                    className="h-11 rounded-xl bg-gradient-to-r from-primary-from to-primary-to text-sm font-semibold text-white hover:brightness-110"
                  >
                    {MO.rejectedRetry}
                  </button>
                </div>
              </>
            ) : stage === 'timeout' ? (
              <>
                <div className="-mx-6 -mt-6 mb-4 rounded-t-2xl bg-gradient-to-r from-primary-from to-primary-to px-6 py-4 text-white">
                  <h3 className="text-lg font-semibold">{MO.waitingTitle}</h3>
                </div>
                <p className="mt-2 text-sm text-stone-600">{MO.pollTimeout}</p>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      setStage('form');
                    }}
                    className="h-11 w-full rounded-xl bg-gradient-to-r from-primary-from to-primary-to text-sm font-semibold text-white hover:brightness-110"
                  >
                    {MO.close}
                  </button>
                </div>
              </>
            ) : BUSINESS.ENABLE_REAL_PAYMENT ? (
              <>
                <div className="-mx-6 -mt-6 mb-4 rounded-t-2xl bg-gradient-to-r from-primary-from to-primary-to px-6 py-4 text-white">
                  <h3 className="text-lg font-semibold">{MO.cashierTitle}</h3>
                  <p className="mt-1 text-sm text-white/80">{MO.cashierDesc}</p>
                </div>

                {/* 套餐单选 */}
                <p className="text-xs font-medium text-stone-500">{MO.planLabel}</p>
                <div className="mt-2 grid gap-2">
                  {BUSINESS.MEMBER_PLANS.map((p) => {
                    const on = plan === p.key;
                    return (
                      <label
                        key={p.key}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                          on ? 'border-primary-from bg-primary-from/5' : 'border-stone-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="member-plan"
                          checked={on}
                          onChange={() => setPlan(p.key)}
                          className="accent-primary-from"
                        />
                        <span className="font-semibold text-stone-900">{MEMBER_PLAN_LABEL[p.key]}</span>
                        <span className="ml-auto text-sm text-stone-600">
                          {MO.planMeta(MO.planPrice(yuan(p.priceCents)), MO.planValidity(p.days))}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {/* 付款方式（微信 / 支付宝收款码切换） */}
                <p className="mt-4 text-xs font-medium text-stone-500">{MO.payChannelLabel}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {BUSINESS.MEMBER_PAY_CHANNELS.map((c) => {
                    const on = channel === c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => {
                          setChannel(c.key);
                          setQrError(false);
                        }}
                        className={`h-10 rounded-xl border text-sm font-medium ${
                          on
                            ? 'border-primary-from bg-primary-from/5 text-primary-from'
                            : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>

                {/* 收款码 */}
                <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-4">
                  {qrError ? (
                    <p className="py-8 text-center text-sm text-stone-500">{MO.qrMissing}</p>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={payChannel.image}
                      alt={MO.qrAlt(payChannel.label)}
                      width={280}
                      height={380}
                      onError={() => setQrError(true)}
                      // 收款码多为竖版长图：按比例放大展示（不再锁死 200×200，避免二维码被压小扫不出来）
                      className="h-auto max-h-[56vh] w-full max-w-[280px] rounded-lg bg-white object-contain"
                    />
                  )}
                  <p className="text-center text-xs text-stone-500">{MO.scanTip}</p>
                </div>

                {/* 付款备注 */}
                <label className="mt-4 block">
                  <span className="text-xs font-medium text-stone-500">{MO.payNoteLabel}</span>
                  <input
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    maxLength={60}
                    placeholder={MO.payNotePlaceholder}
                    className="mt-1 h-11 w-full rounded-xl border border-stone-300 px-3 text-sm outline-none focus:border-primary-from"
                  />
                </label>

                {errorText ? <p className="mt-2 text-xs text-red-600">{errorText}</p> : null}

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setModalOpen(false)}
                    className="h-11 rounded-xl border border-stone-300 text-sm disabled:opacity-50"
                  >
                    {MO.cancel}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={submitOrder}
                    className="h-11 rounded-xl bg-gradient-to-r from-primary-from to-primary-to text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
                  >
                    {busy ? MO.processing : MO.submit}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="-mx-6 -mt-6 mb-4 rounded-t-2xl bg-gradient-to-r from-primary-from to-primary-to px-6 py-4 text-white">
                  <h3 className="text-lg font-semibold">{M.modalTitle}</h3>
                  <p className="mt-1 text-sm text-white/80">{M.modalDesc(benefits)}</p>
                </div>
                <p className="text-xs text-stone-400">{M.modalNote}</p>
                {errorText ? <p className="mt-2 text-xs text-red-600">{errorText}</p> : null}
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setModalOpen(false)}
                    className="h-11 rounded-xl border border-stone-300 text-sm disabled:opacity-50"
                  >
                    {M.cancel}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={confirmUpgrade}
                    className="h-11 rounded-xl bg-gradient-to-r from-primary-from to-primary-to text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
                  >
                    {busy ? M.processing : M.confirmUpgrade}
                  </button>
                </div>
              </>
            )}
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
