'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bike,
  Bus,
  Car,
  CircleAlert,
  Footprints,
  LoaderCircle,
  MapPinned,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { NAV_MODE, NAV_MODE_LABEL, NAV_MODE_VALUES, PLACE_TYPE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { AmapMap, type AmapPoint } from '@/components/map/AmapMap';
import { BUSINESS } from '@/config/business';
import { clearTryDraft, readTryDraft, type TryDraft } from '@/lib/draft';
import { cn } from '@/lib/utils';
import type { NavMode, PlaceType } from '@/types';

interface OrderPoint {
  name: string;
  type: PlaceType | null;
  isLodging: boolean;
  lat: number;
  lng: number;
}
interface OrderLeg {
  distanceMeters: number;
  durationSeconds: number;
}
interface OrderResult {
  mode: NavMode;
  lodgingResolved: boolean;
  lodging: { name: string; lat: number; lng: number } | null;
  points: OrderPoint[];
  legs: OrderLeg[];
  distanceMeters: number;
  durationSeconds: number;
  estimated: boolean;
}

const MODE_ICON: Record<NavMode, LucideIcon> = {
  [NAV_MODE.WALK]: Footprints,
  [NAV_MODE.BIKE]: Bike,
  [NAV_MODE.TRANSIT]: Bus,
  [NAV_MODE.DRIVE]: Car,
};

function modeChipCls(on: boolean) {
  return cn(
    'flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 px-3 text-sm font-medium',
    on ? 'border-primary bg-primary/5 text-primary' : 'border-stone-200 text-stone-600 hover:border-stone-300',
  );
}

function centerCard(children: React.ReactNode) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-stone-200 bg-white px-6 py-16 text-center">{children}</div>
    </div>
  );
}

/** 游客试用第 3 步：按出行方式排好序的路线（地图 + 分段里程时间）；未登录保存跳登录，已登录调 /api/try/promote 落库 */
export function TryResultClient({ loggedIn }: { loggedIn: boolean }) {
  const M = MESSAGES.TRY.RESULT;
  const router = useRouter();

  const [draft, setDraft] = useState<TryDraft | null>(null);
  const [mode, setMode] = useState<NavMode>(NAV_MODE.WALK);
  const [status, setStatus] = useState<'init' | 'loading' | 'ready' | 'error' | 'noDraft' | 'tooFew'>(
    'init',
  );
  const [result, setResult] = useState<OrderResult | null>(null);
  const [message, setMessage] = useState('');
  const [nonce, setNonce] = useState(0);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const d = readTryDraft();
    if (!d) {
      setStatus('noDraft');
      return;
    }
    if (d.places.length < BUSINESS.GUEST_TRY_MIN_PLACES) {
      setDraft(d);
      setStatus('tooFew');
      return;
    }
    setDraft(d);
    setMode(d.transport);
  }, []);

  useEffect(() => {
    if (!draft) return;
    let cancelled = false;
    setStatus('loading');
    setMessage('');

    const points = draft.places.map((p) => ({ lat: p.lat, lng: p.lng, name: p.name, type: p.type }));
    const lodging =
      draft.lodgingName || draft.lodgingArea
        ? { name: draft.lodgingName || null, area: draft.lodgingArea || null, city: draft.cityName }
        : undefined;

    void (async () => {
      try {
        const res = await fetch('/api/try/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points, mode, cityAdcode: draft.cityAdcode, lodging }),
        });
        const data = (await res.json()) as { ok: boolean; message?: string } & Partial<OrderResult>;
        if (cancelled) return;
        if (res.status === 429) {
          setMessage(M.rateLimited);
          setStatus('error');
          return;
        }
        if (!data.ok || !data.points || !data.legs) {
          setMessage(data.message ?? M.error);
          setStatus('error');
          return;
        }
        setResult(data as OrderResult);
        setStatus('ready');
      } catch {
        if (!cancelled) {
          setMessage(M.error);
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [draft, mode, nonce, M.error, M.rateLimited]);

  const numbered = useMemo(() => {
    if (!result) return [] as { point: OrderPoint; seq: number }[];
    let seq = 0;
    return result.points.map((point) => {
      if (point.isLodging) return { point, seq: 0 };
      seq += 1;
      return { point, seq };
    });
  }, [result]);

  const mapPoints: AmapPoint[] = useMemo(() => {
    if (!result) return [];
    return numbered.map(({ point, seq }) =>
      point.isLodging
        ? { lat: point.lat, lng: point.lng, label: point.name, lodging: true }
        : {
            lat: point.lat,
            lng: point.lng,
            order: seq,
            label: point.name,
            food: point.type === PLACE_TYPE.FOOD,
          },
    );
  }, [result, numbered]);

  const mapLines = useMemo(
    () => (result ? [{ path: result.points.map((p) => ({ lat: p.lat, lng: p.lng })) }] : []),
    [result],
  );

  function kmText(meters: number) {
    return (meters / 1000).toFixed(1);
  }
  function minText(seconds: number) {
    return M.duration(Math.round(seconds / 60));
  }

  function goSave() {
    // 未登录：保持现状，跳登录并带 redirect 回到本页
    if (!loggedIn) {
      setToast(M.saveTip);
      setTimeout(() => {
        router.push(`${ROUTES.LOGIN}?redirect=${encodeURIComponent(ROUTES.TRY_RESULT)}`);
      }, 700);
      return;
    }
    // 已登录：把草稿落库成当前账号的真实路线（busy 防重复点击）
    if (!draft || saving) return;
    setSaveError('');
    setSaving(true);
    void (async () => {
      try {
        const res = await fetch('/api/try/promote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cityId: draft.cityId,
            cityName: draft.cityName,
            cityAdcode: draft.cityAdcode,
            title: draft.title,
            transport: draft.transport,
            lodgingName: draft.lodgingName,
            lodgingArea: draft.lodgingArea,
            places: draft.places.map((p) => ({
              name: p.name,
              type: p.type,
              lat: p.lat,
              lng: p.lng,
              address: p.address,
              imageUrl: p.imageUrl,
            })),
          }),
        });
        const data = (await res.json()) as { ok: boolean; routeId?: string; message?: string };
        if (!data.ok || !data.routeId) {
          setSaveError(data.message ?? M.saveFailed);
          setSaving(false);
          return;
        }
        setToast(M.saveSuccess);
        clearTryDraft();
        router.push(ROUTES.ROUTE_DETAIL(data.routeId));
      } catch {
        setSaveError(M.saveFailed);
        setSaving(false);
      }
    })();
  }

  if (status === 'noDraft') {
    return centerCard(
      <>
        <MapPinned className="mx-auto h-12 w-12 text-stone-300" />
        <p className="mt-3 font-semibold text-stone-900">{M.noDraftTitle}</p>
        <p className="mt-1 text-sm text-stone-500">{M.noDraftDesc}</p>
        <Link
          href={ROUTES.TRY_NEW}
          className="mt-4 inline-flex h-10 items-center rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-5 text-sm font-semibold text-white hover:brightness-110"
        >
          {M.noDraftGo}
        </Link>
      </>,
    );
  }

  if (status === 'tooFew') {
    return centerCard(
      <>
        <TriangleAlert className="mx-auto h-12 w-12 text-amber-400" />
        <p className="mt-3 font-semibold text-stone-900">{M.tooFewTitle}</p>
        <p className="mt-1 text-sm text-stone-500">{M.tooFewDesc}</p>
        <Link
          href={ROUTES.TRY_PICK}
          className="mt-4 inline-flex h-10 items-center rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-5 text-sm font-semibold text-white hover:brightness-110"
        >
          {M.tooFewGo}
        </Link>
      </>,
    );
  }

  const firstPlaceName = result?.points.find((p) => !p.isLodging)?.name ?? '';

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
          {MESSAGES.TRY.guestBadge}
        </span>
        <span className="text-xs text-stone-400">
          {MESSAGES.TRY.stepNew} · {MESSAGES.TRY.stepPick} · {MESSAGES.TRY.stepResult}
        </span>
      </div>
      <h1 className="mt-2 text-2xl font-bold text-stone-900 md:text-3xl">{M.title}</h1>
      <p className="mt-2 text-sm text-stone-500">{M.desc}</p>

      {toast ? (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}

      {status === 'loading' ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-stone-400">
          <LoaderCircle className="h-8 w-8 animate-spin" />
          <p className="text-sm">{M.loading}</p>
        </div>
      ) : status === 'error' ? (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          <p className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{message}</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setNonce((n) => n + 1)}
              className="h-9 rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-4 text-sm font-semibold text-white hover:brightness-110"
            >
              {M.retry}
            </button>
            <Link href={ROUTES.TRY_PICK} className="flex h-9 items-center rounded-lg border border-stone-300 px-4">
              {M.back}
            </Link>
          </div>
        </div>
      ) : result ? (
        <>
          {/* 出行方式切换 */}
          <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 md:p-5">
            <p className="text-sm font-semibold text-stone-900">{M.transportLabel}</p>
            <p className="mt-1 text-xs text-stone-500">{M.transportHint}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {NAV_MODE_VALUES.map((m) => {
                const Icon = MODE_ICON[m];
                return (
                  <button key={m} type="button" onClick={() => setMode(m)} className={modeChipCls(mode === m)}>
                    <Icon className="h-5 w-5" />
                    {NAV_MODE_LABEL[m]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 起点提示 */}
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
            <MapPinned className="h-4 w-4 shrink-0 text-primary" />
            {result.lodgingResolved && result.lodging ? (
              <span>{M.startLodging(result.lodging.name)}</span>
            ) : (
              <span>{M.startPlaces(firstPlaceName)}</span>
            )}
            {result.lodgingResolved ? (
              <span className="text-xs text-emerald-600">{M.lodgingResolvedHint}</span>
            ) : draft?.lodgingName || draft?.lodgingArea ? (
              <span className="flex w-full items-start gap-1 text-xs text-amber-600">
                <TriangleAlert className="mt-px h-4 w-4 shrink-0" />
                {M.startFallback(firstPlaceName)}
              </span>
            ) : null}
            {result.estimated ? <span className="text-xs text-amber-600">{M.estimatedTip}</span> : null}
          </div>

          {/* 地图 */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <div className="h-[320px] w-full md:h-[380px]">
              <AmapMap points={mapPoints} lines={mapLines} />
            </div>
            <p className="border-t border-stone-100 px-4 py-2 text-[11px] text-stone-400">{M.mapNote}</p>
          </div>

          {/* 顺序列表 + 分段 */}
          <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-stone-900">
                {MESSAGES.TRY.RESULT.singleDay}
              </p>
              <p className="text-xs text-stone-500">{M.placesTotal(numbered.filter((n) => !n.point.isLodging).length)}</p>
            </div>
            <ol className="mt-3">
              {numbered.map(({ point, seq }, i) => (
                <li key={`${point.name}-${i}`}>
                  <div className="flex items-center gap-3 py-1.5">
                    {point.isLodging ? (
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-600 text-xs font-bold text-white">
                        {M.lodgingBadge}
                      </span>
                    ) : (
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-r from-primary-from to-primary-to text-xs font-bold text-white">
                        {seq}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-stone-900">{point.name}</span>
                      {!point.isLodging && point.type === PLACE_TYPE.FOOD ? (
                        <span className="text-[11px] text-amber-600">{MESSAGES.ROUTE_RESULT.typeFood}</span>
                      ) : null}
                    </span>
                  </div>
                  {i < numbered.length - 1 && result.legs[i] ? (
                    <div className="ml-[13px] flex items-center gap-2 border-l-2 border-dashed border-stone-200 py-1 pl-4 text-xs text-stone-500">
                      {M.legMeta(NAV_MODE_LABEL[mode], kmText(result.legs[i].distanceMeters), minText(result.legs[i].durationSeconds))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-xl bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-800">
              {M.totalMeta(kmText(result.distanceMeters), minText(result.durationSeconds))}
            </p>
          </div>

          {/* 操作：保存路线（需登录，不写库） */}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Link
              href={ROUTES.TRY_PICK}
              className="flex h-12 items-center justify-center rounded-xl border border-stone-300 px-6 text-sm font-medium hover:bg-stone-50"
            >
              {M.back}
            </Link>
            <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
              <button
                type="button"
                onClick={goSave}
                disabled={saving}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-7 font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {saving ? M.saving : loggedIn ? M.saveLoggedIn : M.save}
              </button>
              <p className="text-xs text-stone-500 sm:text-right">
                {loggedIn ? M.saveLoggedInTip : M.saveTip}
              </p>
              {saveError ? (
                <p className="flex items-start gap-1 text-xs text-red-600 sm:justify-end">
                  <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
                  <span className="sm:text-right">{saveError}</span>
                </p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
