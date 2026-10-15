'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Crown } from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { MEMBER_SOURCE_LABEL, EVENT_NAME } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { trackEvent } from '@/lib/events';
import type { MemberSource } from '@/types';

/** YYYY-MM-DD */
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * U10 会员卡：未开通显示升级卡（模拟支付），已开通显示权益提示。
 * 升级走 POST /api/member，成功后刷新服务端数据。
 */
export function MemberCard({
  member,
  memberSince,
  memberSource,
}: {
  member: boolean;
  memberSince: string | null;
  memberSource: MemberSource | null;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  function showToast(text: string, tone: 'ok' | 'err') {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 2600);
  }

  function openUpgrade() {
    void trackEvent(EVENT_NAME.CLICK_UPGRADE, { from: 'profile' });
    setErrorText('');
    setModalOpen(true);
  }

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

  return (
    <>
      {member ? (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600">
            <Crown className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-amber-900">你已成为会员用户</p>
            <p className="mt-1 text-sm text-amber-800">
              已享受会员权益：{PRODUCT.MEMBER_BENEFITS.join('、')}。
            </p>
            <p className="mt-1 text-xs text-amber-700">
              开通于 {fmtDate(memberSince)} ·{' '}
              {memberSource ? MEMBER_SOURCE_LABEL[memberSource] : '来源未知'}
            </p>
          </div>
        </section>
      ) : (
        <section className="relative grid gap-5 overflow-hidden rounded-2xl bg-foreground p-5 text-white md:grid-cols-3 md:items-center">
          <div className="relative md:col-span-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-secondary">
              <Crown className="h-4 w-4" />
              会员权益
            </p>
            <h2 className="mt-2 text-xl font-bold">升级为会员，解锁更强的路线规划</h2>
            <ul className="mt-3 grid gap-1.5 text-sm text-white/70 sm:grid-cols-2">
              {PRODUCT.MEMBER_BENEFITS.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 shrink-0" />
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
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary font-bold text-foreground hover:brightness-105"
              >
                升级为会员
              </button>
            ) : (
              <p className="text-sm text-white/70">{MESSAGES.UPGRADE_TOAST}</p>
            )}
            <p className="mt-2 text-center text-[11px] text-white/50">
              {BUSINESS.ENABLE_REAL_PAYMENT
                ? '点击后进入支付流程'
                : '模拟流程：点击后仅模拟支付成功，第一版不真实收费、未接入真实支付'}
            </p>
          </div>
        </section>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-background p-6">
            <h3 className="text-lg font-semibold">升级为会员（模拟）</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              模拟支付成功后，你的身份将变为「会员用户」，可享受
              {PRODUCT.MEMBER_BENEFITS.join('、')}。
            </p>
            <p className="mt-2 text-xs text-muted-foreground/80">
              本页不接入真实支付，点击「模拟支付成功」不会产生任何扣费，仅用于演示会员状态；管理员也可在后台为你开通会员。
            </p>
            {errorText ? <p className="mt-2 text-xs text-red-600">{errorText}</p> : null}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setModalOpen(false)}
                className="h-11 rounded-xl border border-border text-sm disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirmUpgrade}
                className="h-11 rounded-xl bg-secondary text-sm font-semibold text-foreground disabled:opacity-50"
              >
                {busy ? '处理中…' : '模拟支付成功'}
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
