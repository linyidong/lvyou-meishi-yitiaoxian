'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { Copy, Download, Loader2, Lock, Share2 } from 'lucide-react';
import { MESSAGES } from '@/config/messages';
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
      const qrDataUrl = await QRCode.toDataURL(data.url, { margin: 1, width: 240 });
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4">
          <div className="max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6">
            <h3 className="text-lg font-semibold text-stone-900">{S.modalTitle}</h3>

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
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-3 h-10 w-full rounded-xl text-sm text-stone-500"
                >
                  {S.close}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
