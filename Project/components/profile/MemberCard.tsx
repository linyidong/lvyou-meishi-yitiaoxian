'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Crown } from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { EVENT_NAME, MEMBER_SOURCE_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { trackEvent } from '@/lib/events';
import type { MemberSource } from '@/types';

const M = MESSAGES.PROFILE;

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

  const benefits = PRODUCT.MEMBER_BENEFITS.join('、');

  return (
    <>
      {member ? (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600">
            <Crown className="h-[22px] w-[22px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-amber-900">{M.memberOnTitle}</p>
            <p className="mt-1 text-sm text-amber-800">{M.memberOnDesc(benefits)}</p>
            <p className="mt-1 text-xs text-amber-700">
              {M.memberOnMeta(
                fmtDate(memberSince),
                memberSource ? MEMBER_SOURCE_LABEL[memberSource] : M.sourceUnknown,
              )}
            </p>
          </div>
        </section>
      ) : (
        <section className="relative grid items-center gap-5 overflow-hidden rounded-2xl bg-stone-900 p-5 text-white md:grid-cols-3 md:p-6">
          <div className="absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-primary/40" />
          <div className="relative md:col-span-2">
            <p className="flex items-center gap-1 text-xs font-semibold text-amber-300">
              <Crown className="h-4 w-4" />
              {M.upgradeTag}
            </p>
            <h2 className="mt-2 text-xl font-bold">{M.upgradeTitle}</h2>
            <ul className="mt-3 grid gap-1.5 text-sm text-stone-300 sm:grid-cols-2">
              {PRODUCT.MEMBER_BENEFITS.map((item) => (
                <li key={item} className="flex gap-1.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
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
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 font-bold text-stone-900 hover:bg-amber-300"
              >
                {M.upgradeBtn}
              </button>
            ) : (
              <p className="text-sm text-stone-300">{MESSAGES.UPGRADE_TOAST}</p>
            )}
            <p className="mt-2 text-center text-[11px] text-stone-400">
              {BUSINESS.ENABLE_REAL_PAYMENT ? M.upgradeNoteReal : M.upgradeNoteMock}
            </p>
          </div>
        </section>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h3 className="text-lg font-semibold">{M.modalTitle}</h3>
            <p className="mt-2 text-sm text-stone-600">{M.modalDesc(benefits)}</p>
            <p className="mt-2 text-xs text-stone-400">{M.modalNote}</p>
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
                className="h-11 rounded-xl bg-amber-400 text-sm font-semibold text-stone-900 disabled:opacity-50"
              >
                {busy ? M.processing : M.confirmUpgrade}
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
