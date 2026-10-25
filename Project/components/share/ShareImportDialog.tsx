'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import jsQR from 'jsqr';
import { CheckCircle2, ImageUp, Loader2, MapPin, X } from 'lucide-react';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { parseShareToken } from '@/lib/share-token';
import { cn } from '@/lib/utils';

/** T-041 导入模式：建成我的路线 / 只收藏地点 */
type ImportMode = 'route' | 'places';

/** T-060 弹窗两步：先输入（链接 / 长图二维码），解析成功后进入预览，再选动作 */
type Step = 'input' | 'preview' | 'done';
type Tab = 'link' | 'qr';

/** GET /api/shares/[token] 返回的精简快照 */
interface PreviewSnapshot {
  title: string;
  cityName: string | null;
  days: number;
  placeCount: number;
  places: { name: string; type: string }[];
  exportedAt: string;
}

/** 导入成功后的结果（用于区分两种模式的成功提示与跳转链接） */
interface ImportResult {
  mode: ImportMode;
  placesCount: number;
}

/** 上传长图大小上限（T-060：≤7MB） */
const MAX_QR_BYTES = 7 * 1024 * 1024;
const QR_ACCEPT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * T-060 前端二维码识别（jsQR，纯客户端，不上传服务器）：
 * 整图先缩放到长边 ≤1200 解码；失败依次裁剪中心 60%、底部 40% 区域重试
 * （长图二维码较小且位于底部，整图缩放后可能丢失细节）。识别不出返回 null。
 */
async function decodeShareQr(file: File): Promise<string | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    return null;
  }
  const w = bitmap.width;
  const h = bitmap.height;
  // T-060：长图里的二维码通常很小，缩放会糊掉码点，所以优先用原分辨率解码；
  // 区域从"整图 → 左下角（本产品海报二维码位置）→ 下半部 → 中心"逐级尝试，
  // 并对每块做 attemptBoth（兼容浅底深码 / 深底浅码）。
  const regions = [
    { x: 0, y: Math.round(h * 0.55), w: Math.round(w * 0.55), h: h - Math.round(h * 0.55) },
    { x: 0, y: Math.round(h * 0.6), w, h: h - Math.round(h * 0.6) },
    { x: 0, y: 0, w, h },
    { x: Math.round(w * 0.2), y: Math.round(h * 0.2), w: Math.round(w * 0.6), h: Math.round(h * 0.6) },
  ];
  try {
    for (const r of regions) {
      for (const maxEdge of [3200, 1600, 1000]) {
        const scale = Math.min(1, maxEdge / Math.max(r.w, r.h));
        const cw = Math.max(1, Math.round(r.w * scale));
        const ch = Math.max(1, Math.round(r.h * scale));
        canvas.width = cw;
        canvas.height = ch;
        ctx.drawImage(bitmap, r.x, r.y, r.w, r.h, 0, 0, cw, ch);
        const { data } = ctx.getImageData(0, 0, cw, ch);
        const code = jsQR(data, cw, ch, { inversionAttempts: 'attemptBoth' });
        if (code?.data) return code.data;
      }
    }
    return null;
  } finally {
    bitmap.close();
  }
}

/**
 * T-041 / T-060 首页「导入分享路线」弹层（会员功能入口，接口侧另有 403 兜底）：
 * 第一步输入：两个入口 tab——粘贴分享链接 / token、上传含二维码的路线长图（jsQR 识别）；
 * 解析成功后 GET /api/shares/[token] 预览（只读、不占额度）；
 * 第二步预览：展示标题 / 城市 / 天数 / 地点数 / 前 8 个地点 / 分享时间，
 * 再选「建成我的路线」或「只收藏地点」（沿用 POST /api/shares/[token]/import 的 mode）。
 */
export function ShareImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const S = MESSAGES.SHARE;
  const [step, setStep] = useState<Step>('input');
  const [tab, setTab] = useState<Tab>('link');
  const [input, setInput] = useState('');
  const [token, setToken] = useState('');
  const [preview, setPreview] = useState<PreviewSnapshot | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const busy = previewing || qrBusy || submitting;

  const reset = () => {
    setStep('input');
    setTab('link');
    setInput('');
    setToken('');
    setPreview(null);
    setPreviewing(false);
    setQrBusy(false);
    setSubmitting(false);
    setError(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  /** 解析出 token 后拉预览：成功切 preview 步骤，失败留在当前输入界面提示 */
  async function loadPreview(t: string) {
    setPreviewing(true);
    setError(null);
    try {
      const res = await fetch(`/api/shares/${encodeURIComponent(t)}`);
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string; snapshot?: PreviewSnapshot }
        | null;
      if (res.ok && json?.ok && json.snapshot) {
        setToken(t);
        setPreview(json.snapshot);
        setStep('preview');
      } else {
        setError(json?.message ?? S.previewFailed);
      }
    } catch {
      setError(S.previewFailed);
    } finally {
      setPreviewing(false);
    }
  }

  /** 入口 A：粘贴链接 / token */
  function submitLink() {
    if (busy) return;
    setError(null);
    const t = parseShareToken(input);
    if (!t) {
      setError(S.invalidInput);
      return;
    }
    void loadPreview(t);
  }

  /** 入口 B：上传长图 → jsQR 识别 → 解析 token → 预览 */
  async function onQrFile(file: File | null) {
    if (!file || busy) return;
    setError(null);
    if (!QR_ACCEPT_TYPES.includes(file.type)) {
      setError(S.qrBadType);
      return;
    }
    if (file.size > MAX_QR_BYTES) {
      setError(S.qrTooLarge);
      return;
    }
    setQrBusy(true);
    try {
      const text = await decodeShareQr(file);
      const t = text ? parseShareToken(text) : null;
      if (!t) {
        setError(S.qrFailed);
        return;
      }
      await loadPreview(t);
    } catch {
      setError(S.qrFailed);
    } finally {
      setQrBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  /** 预览页动作：沿用 POST import 的 mode=route|places */
  async function runImport(mode: ImportMode) {
    if (busy || !token) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/shares/${encodeURIComponent(token)}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string; mode?: string; placesCount?: number }
        | null;
      if (res.ok && json?.ok) {
        setResult({
          mode: json.mode === 'places' ? 'places' : 'route',
          placesCount: typeof json.placesCount === 'number' ? json.placesCount : 0,
        });
        setStep('done');
      } else {
        setError(json?.message ?? S.importFailed);
      }
    } catch {
      setError(S.importFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-bold text-stone-900">{S.dialogTitle}</h2>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-stone-100 disabled:opacity-50"
            aria-label={S.close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-sm text-stone-500">{S.dialogDesc}</p>

        {step === 'done' && result ? (
          <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4">
            <p className="flex items-center gap-2 font-semibold text-teal-800">
              <CheckCircle2 className="h-5 w-5" />
              {result.mode === 'route' ? S.doneRoute : S.donePlaces(result.placesCount)}
            </p>
            <div className="mt-3 flex gap-3 text-sm">
              <Link
                href={result.mode === 'route' ? ROUTES.MY_ROUTES : ROUTES.COLLECTED}
                className="font-semibold text-primary hover:underline"
              >
                {result.mode === 'route' ? S.goMyRoutes : S.goCollected}
              </Link>
              <button type="button" onClick={close} className="text-stone-500 hover:text-stone-700">
                {S.close}
              </button>
            </div>
          </div>
        ) : step === 'preview' && preview ? (
          <div data-testid="share-import-preview" className="mt-4">
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-xs font-medium text-stone-400">{S.previewTitle}</p>
              <p className="mt-1 font-semibold text-stone-900">{preview.title}</p>
              <p className="mt-1 text-sm text-stone-500">
                {preview.days > 1
                  ? S.summary(preview.cityName ?? S.noCity, preview.days, preview.placeCount)
                  : S.summarySingle(preview.cityName ?? S.noCity, preview.placeCount)}
              </p>
              <ul className="mt-3 max-h-40 space-y-1.5 overflow-y-auto">
                {preview.places.map((p, i) => (
                  <li key={`${p.name}-${i}`} className="flex items-start gap-2 text-sm text-stone-700">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 break-words">{p.name}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-stone-400">
                {S.previewPlacesShown(preview.places.length, preview.placeCount)} ·{' '}
                {S.previewExported(preview.exportedAt.slice(0, 10))}
              </p>
            </div>

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                data-testid="share-import-route-btn"
                onClick={() => void runImport('route')}
                disabled={busy}
                className="flex h-11 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-4 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {S.modeRouteTitle}
              </button>
              <button
                type="button"
                data-testid="share-import-places-btn"
                onClick={() => void runImport('places')}
                disabled={busy}
                className="flex h-11 items-center justify-center gap-1.5 rounded-lg border border-primary bg-primary/5 px-4 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
              >
                {S.modePlacesTitle}
              </button>
            </div>
            <p className="mt-2 text-xs text-stone-400">
              {S.modeRouteDesc}；{S.modePlacesDesc}
            </p>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setStep('input');
                  setPreview(null);
                  setToken('');
                  setError(null);
                }}
                disabled={busy}
                className="h-10 rounded-lg border border-stone-300 px-4 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                {S.previewBack}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div role="tablist" className="mt-4 grid grid-cols-2 gap-2">
              {(
                [
                  { key: 'link' as const, label: S.tabLink },
                  { key: 'qr' as const, label: S.tabQr },
                ]
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  data-testid={`share-import-tab-${t.key}`}
                  onClick={() => {
                    setTab(t.key);
                    setError(null);
                  }}
                  className={cn(
                    'h-10 rounded-xl border text-sm font-semibold',
                    tab === t.key
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'link' ? (
              <>
                <label className="mt-4 block text-sm font-medium text-stone-700" htmlFor="share-import-input">
                  {S.inputLabel}
                </label>
                <textarea
                  id="share-import-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={2}
                  placeholder={S.inputPlaceholder}
                  className="mt-1 w-full resize-none rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </>
            ) : (
              <div className="mt-4">
                <p className="text-sm text-stone-500">{S.qrTabDesc}</p>
                <input
                  ref={fileRef}
                  data-testid="share-import-qr-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => void onQrFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  data-testid="share-import-qr-pick"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 text-sm font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                >
                  {qrBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
                  {qrBusy ? S.qrBusy : S.qrPick}
                </button>
              </div>
            )}

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="h-10 rounded-lg border border-stone-300 px-4 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                {S.close}
              </button>
              {tab === 'link' ? (
                <button
                  type="button"
                  data-testid="share-import-preview-btn"
                  onClick={submitLink}
                  disabled={busy || !input.trim()}
                  className="flex h-10 items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-4 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
                >
                  {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {previewing ? S.previewBusy : S.previewBtn}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
