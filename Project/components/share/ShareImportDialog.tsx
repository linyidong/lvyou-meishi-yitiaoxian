'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, X } from 'lucide-react';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { parseShareToken } from '@/lib/share-token';
import { cn } from '@/lib/utils';

/** T-041 导入模式：建成我的路线 / 只收藏地点 */
type ImportMode = 'route' | 'places';

/** 导入成功后的结果（用于区分两种模式的成功提示与跳转链接） */
interface ImportResult {
  mode: ImportMode;
  placesCount: number;
}

/**
 * T-041 首页「导入分享路线」弹层（会员功能入口，接口侧另有 403 兜底）：
 * 粘贴分享链接或 token → 选模式 → 提交 POST /api/shares/[token]/import → 成功提示 + 跳转链接。
 */
export function ShareImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const S = MESSAGES.SHARE;
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ImportMode>('route');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  if (!open) return null;

  const reset = () => {
    setInput('');
    setMode('route');
    setError(null);
    setResult(null);
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  async function submit() {
    if (submitting) return;
    setError(null);
    const token = parseShareToken(input);
    if (!token) {
      setError(S.invalidInput);
      return;
    }
    setSubmitting(true);
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
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-stone-100"
            aria-label={S.close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-sm text-stone-500">{S.dialogDesc}</p>

        {result ? (
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
        ) : (
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

            <div className="mt-4 grid gap-2">
              {(
                [
                  { key: 'route' as const, title: S.modeRouteTitle, desc: S.modeRouteDesc },
                  { key: 'places' as const, title: S.modePlacesTitle, desc: S.modePlacesDesc },
                ]
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setMode(opt.key)}
                  className={cn(
                    'rounded-xl border p-3 text-left',
                    mode === opt.key
                      ? 'border-primary bg-primary/5'
                      : 'border-stone-200 hover:bg-stone-50',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                    <span
                      className={cn(
                        'grid h-4 w-4 place-items-center rounded-full border',
                        mode === opt.key ? 'border-primary bg-primary' : 'border-stone-300',
                      )}
                    >
                      {mode === opt.key ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                    </span>
                    {opt.title}
                  </span>
                  <span className="mt-1 block pl-6 text-xs text-stone-500">{opt.desc}</span>
                </button>
              ))}
            </div>

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={close}
                disabled={submitting}
                className="h-10 rounded-lg border border-stone-300 px-4 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                {S.close}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !input.trim()}
                className="flex h-10 items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-4 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitting ? S.submitting : S.submit}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
