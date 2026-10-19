'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Crown, Loader2, MapPin, Upload } from 'lucide-react';
import { PLACE_TYPE_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { ROUTES } from '@/config/routes';
import type { RouteShareSnapshot } from '@/types';

/**
 * 阶段 3 公开分享页（客户端）：逐天清单纯展示 + 底部导入 / 升级横幅。
 * 不调用高德、不做导航，只渲染服务端写入的快照。
 */
export function ShareViewClient({
  token,
  snapshot,
  loggedIn,
  canImport,
  viewerTier,
  productName,
}: {
  token: string;
  snapshot: RouteShareSnapshot;
  loggedIn: boolean;
  canImport: boolean;
  viewerTier: 'admin' | 'member' | 'free';
  productName: string;
}) {
  const router = useRouter();
  const S = MESSAGES.SHARE;
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');

  async function importRoute() {
    setBusy(true);
    setErrorText('');
    try {
      const res = await fetch(`/api/shares/${token}/import`, { method: 'POST' });
      const data = (await res.json()) as { ok: boolean; routeId?: string; message?: string };
      if (!data.ok || !data.routeId) {
        setErrorText(data.message ?? S.importFailed);
        return;
      }
      router.push(ROUTES.ROUTE_DETAIL(data.routeId));
    } catch {
      setErrorText(S.importFailed);
    } finally {
      setBusy(false);
    }
  }

  const summary = snapshot.cityName
    ? snapshot.days > 1
      ? S.summary(snapshot.cityName, snapshot.days, snapshot.totalPlaces)
      : S.summarySingle(snapshot.cityName, snapshot.totalPlaces)
    : S.placesTotal(snapshot.totalPlaces);

  return (
    <div className="mx-auto w-full max-w-screen-md">
      {/* 品牌区 */}
      <header className="relative overflow-hidden bg-gradient-to-r from-primary-from to-primary-to px-5 pt-6 pb-8 text-white">
        <div className="flex items-center gap-2">
          <Image
            src={PRODUCT.LOGO_PATH}
            alt={productName}
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg bg-white/90 p-0.5"
          />
          <div>
            <p className="text-sm leading-tight font-semibold">{productName}</p>
            <p className="text-[11px] text-white/80">{S.sharedBy}</p>
          </div>
          {viewerTier !== 'free' ? (
            <span className="ml-auto rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] text-white">
              {viewerTier === 'admin' ? S.tierAdmin : S.tierMember}
            </span>
          ) : null}
        </div>
        <h1 className="mt-4 text-xl leading-snug font-bold">{snapshot.title}</h1>
        <p className="mt-2 text-sm text-white/85">{summary}</p>
        <p className="mt-1 text-xs text-white/75">
          {S.tripInfo(snapshot.intercityLabel, snapshot.lodgingLabel)}
        </p>
      </header>

      {/* 逐天清单 */}
      <div className="space-y-4 px-4 pt-4">
        {snapshot.dayPlans.map((day) => (
          <section key={day.dayIndex} className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gradient-to-r from-primary-from to-primary-to px-2.5 py-0.5 text-xs font-semibold text-white">
                {S.dayTitle(day.dayIndex + 1)}
              </span>
              <span className="text-xs text-stone-400">
                {S.placesTotal(day.places.length)}
              </span>
            </div>
            {day.places.length === 0 ? (
              <p className="mt-3 text-sm text-stone-400">—</p>
            ) : (
              <ol className="mt-3 divide-y divide-stone-100">
                {day.places.map((place, i) => (
                  <li key={`${place.name}-${i}`} className="flex items-start gap-3 py-2.5">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium text-stone-900">
                        <span className="truncate">{place.name}</span>
                        <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-500">
                          {PLACE_TYPE_LABEL[place.type]}
                        </span>
                      </p>
                      {place.address ? (
                        <p className="mt-0.5 flex items-start gap-1 text-xs text-stone-400">
                          <MapPin className="mt-px h-3 w-3 shrink-0" />
                          <span className="truncate">{place.address}</span>
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>

      {/* 底部横幅 */}
      <div className="sticky bottom-0 mt-4 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
        {!loggedIn ? (
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-xs text-stone-500">{S.viewOnlyTip}</p>
            <Link
              href={`${ROUTES.LOGIN}?redirect=${encodeURIComponent(ROUTES.SHARE(token))}`}
              className="flex h-10 shrink-0 items-center rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-4 text-sm font-semibold text-white hover:brightness-110"
            >
              {S.loginToImport}
            </Link>
          </div>
        ) : canImport ? (
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-xs text-stone-500">{S.importHint}</p>
            <button
              type="button"
              disabled={busy}
              onClick={importRoute}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-4 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {busy ? S.importing : S.importBtn}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-xs text-stone-500">{S.viewOnlyTip}</p>
            <Link
              href={ROUTES.PROFILE}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-4 text-sm font-semibold text-white hover:brightness-110"
            >
              <Crown className="h-4 w-4" />
              {S.goUpgrade}
            </Link>
          </div>
        )}
        {errorText ? <p className="mt-2 text-xs text-red-600">{errorText}</p> : null}
      </div>
    </div>
  );
}
