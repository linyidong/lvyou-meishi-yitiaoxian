'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { Copy, Download, Loader2, Lock, Share2 } from 'lucide-react';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { ROUTES } from '@/config/routes';
import { renderRoutePoster } from '@/lib/route-poster';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import type { RouteShareSnapshot } from '@/types';

const S = MESSAGES.SHARE;

/**
 * 阶段 3 「导出长图 / 分享二维码」（U09 路线结果页）。
 * canExport=false 时渲染锁定态（与「手机高德导航」锁定态同款风格），点击跳个人中心升级。
 */
export function RouteShareButton({
  routeId,
  canExport,
  className,
}: {
  routeId: string;
  canExport: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'done' | 'error'>('loading');
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);

  function triggerDownload(data: Blob) {
    const objectUrl = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = S.downloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function startShare() {
    setOpen(true);
    setPhase('loading');
    setError('');
    setCopied(false);
    try {
      const res = await fetch(`/api/routes/${routeId}/share`, { method: 'POST' });
      const data = (await res.json()) as {
        ok: boolean;
        url?: string;
        snapshot?: RouteShareSnapshot;
        message?: string;
      };
      if (!data.ok || !data.url || !data.snapshot) {
        setError(data.message ?? S.failSave);
        setPhase('error');
        return;
      }
      const qrDataUrl = await QRCode.toDataURL(data.url, { margin: 1, width: 512 });
      const poster = await renderRoutePoster({
        snapshot: data.snapshot,
        shareUrl: data.url,
        qrDataUrl,
      });
      setQr(qrDataUrl);
      setUrl(data.url);
      setBlob(poster);
      setPhase('done');
      triggerDownload(poster);
    } catch {
      setError(S.failDesc);
      setPhase('error');
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setError(S.copyFailed);
    }
  }

  if (!canExport) {
    return (
      <>
        <button
          type="button"
          title={S.lockedTitle}
          onClick={() => setUpgradeOpen(true)}
          className={
            className ??
            'flex h-10 shrink-0 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-primary-from/70 to-primary-to/70 px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-110'
          }
        >
          <Lock className="h-4 w-4" />
          {S.exportBtn}
          <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-medium leading-none">
            {S.locked}
          </span>
        </button>
        <ConfirmDialog
          open={upgradeOpen}
          title={S.upgradeTitle}
          description={S.upgradeDesc}
          confirmText={S.upgradeGo}
          cancelText={S.upgradeCancel}
          onConfirm={() => {
            setUpgradeOpen(false);
            router.push(ROUTES.PROFILE);
          }}
          onCancel={() => setUpgradeOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={startShare}
        className={
          className ??
          'flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-4 text-sm font-semibold text-white hover:brightness-110'
        }
      >
        <Share2 className="h-4 w-4" />
        {S.exportBtn}
      </button>

      {open ? (
        /* T-073 弹层改登机牌票根外观：米白票面 + 渐变票头条 + 票头徽章；
           内容（二维码 / 链接 / 下载 / 复制 / 关闭）与业务逻辑保持原样，
           不塞长图里的城市 / 天数 / 地点等信息。 */
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4">
          <div className="max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-[#fffdf8] text-stone-800 shadow-2xl">
            {/* 顶部渐变条 teal→amber→rose */}
            <div className="h-1.5 bg-gradient-to-r from-teal-500 via-amber-400 to-rose-400" />
            <div className="p-6">
              {/* 票头：自绘路线小 logo + 产品名；右侧 ROUTE PASS / 路线分享 徽章（390 只留 ROUTE PASS） */}
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-teal-500 to-teal-700">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <polyline
                        points="2,11 5,5 9,8 12,3"
                        stroke="#fff"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="5" cy="5" r="1.4" fill="#fbbf24" />
                      <circle cx="9" cy="8" r="1.4" fill="#fda4af" />
                    </svg>
                  </span>
                  <span className="min-w-0 truncate text-[11px] font-bold text-stone-700 sm:text-xs">
                    {PRODUCT.NAME}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 rounded-full border border-teal-600/40 px-2 py-0.5 text-[9px] font-bold tracking-wide text-teal-700">
                  {S.ticketBadge}
                  <span className="hidden font-normal text-stone-500 sm:inline">
                    / {S.ticketBadgeSub}
                  </span>
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-stone-900">{S.modalTitle}</h3>

              {phase === 'loading' ? (
                <div className="mt-6 flex flex-col items-center gap-3 py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-stone-500">{S.generating}</p>
                </div>
              ) : phase === 'error' ? (
                <>
                  <p className="mt-6 font-semibold text-red-600">{S.failTitle}</p>
                  <p className="mt-1 text-sm text-stone-500">{error || S.failDesc}</p>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="h-11 rounded-xl border border-stone-300 text-sm"
                    >
                      {S.close}
                    </button>
                    <button
                      type="button"
                      onClick={startShare}
                      className="h-11 rounded-xl bg-gradient-to-r from-primary-from to-primary-to text-sm font-semibold text-white"
                    >
                      {S.exportBtn}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm text-stone-600">{S.modalDesc}</p>
                  <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-4">
                    {qr ? (
                      <Image
                        src={qr}
                        alt={S.qrAlt}
                        width={180}
                        height={180}
                        unoptimized
                        className="rounded-lg bg-white"
                      />
                    ) : null}
                    <p className="text-center text-xs text-stone-500">{S.qrHint}</p>
                  </div>
                  <p className="mt-3 text-xs font-medium text-stone-500">{S.linkLabel}</p>
                  <p className="mt-1 truncate rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
                    {url}
                  </p>
                  {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => blob && triggerDownload(blob)}
                      disabled={!blob}
                      className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-stone-300 text-sm disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      {S.download}
                    </button>
                    <button
                      type="button"
                      onClick={copyLink}
                      className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-stone-900 text-sm text-white"
                    >
                      <Copy className="h-4 w-4" />
                      {copied ? S.copied : S.copyLink}
                    </button>
                  </div>
                  {/* 撕票虚线 + 两侧半圆缺口：让弹层更像一张票根（缺口用遮罩同色圆模拟打孔） */}
                  <div className="relative -mx-6 mt-4">
                    <div className="border-t-2 border-dashed border-stone-300" />
                    <span className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-stone-900/50" />
                    <span className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-stone-900/50" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="mt-2 h-10 w-full rounded-xl text-sm text-stone-500"
                  >
                    {S.close}
                  </button>
                </>
              )}

              {/* 撕票虚线：票根底部装饰，与首页第 6 屏同一视觉语言 */}
              <div aria-hidden="true" className="mt-6 border-t border-dashed border-stone-300" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
