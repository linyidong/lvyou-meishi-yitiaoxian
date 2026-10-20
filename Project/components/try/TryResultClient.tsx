'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Bike,
  Bus,
  Car,
  ChevronDown,
  ChevronUp,
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
import { clearTryDraft, readTryDraft, saveTryDraft, type TryDraft } from '@/lib/draft';
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

/** 地点在草稿与顺序结果里都没有 id，用「名称 + 坐标」作为排序标识（同一地点只有一份） */
function sortIdOf(point: OrderPoint): string {
  return `${point.name}@${point.lng},${point.lat}`;
}

function centerCard(children: React.ReactNode) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-stone-200 bg-white px-6 py-16 text-center">{children}</div>
    </div>
  );
}

/** 可拖动排序的地点行：序号角标即拖拽手柄，右侧上移 / 下移 / 移到第 N 位（与普通用户结果页同一套交互） */
function SortablePlaceRow({
  point,
  serial,
  sortId,
  count,
  canUp,
  canDown,
  reordering,
  moveOpen,
  onToggleMove,
  onStep,
  onMoveTo,
  legNode,
}: {
  point: OrderPoint;
  /** 左侧角标数字：住宿点是 0，其余从 1 连续计数 */
  serial: number;
  sortId: string;
  /** 可移动的地点数量（不含住宿），用于「移到第 N 位」面板 */
  count: number;
  canUp: boolean;
  canDown: boolean;
  /** 正在同步顺序时禁用全部移动操作，避免并发请求把顺序搞乱 */
  reordering: boolean;
  moveOpen: boolean;
  onToggleMove: (open: boolean) => void;
  onStep: (delta: -1 | 1) => void;
  onMoveTo: (to: number) => void;
  legNode: React.ReactNode;
}) {
  const R = MESSAGES.ROUTE_RESULT;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortId });
  const isFood = point.type === PLACE_TYPE.FOOD;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'relative z-30 opacity-90')}
    >
      <div className="relative flex items-center gap-3 py-1.5">
        {point.isLodging ? (
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
            {serial}
          </span>
        ) : (
          <span
            className={cn(
              'relative grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white',
              isFood ? 'bg-amber-500' : 'bg-teal-500',
            )}
          >
            {serial}
            <button
              type="button"
              aria-label={R.orderDrag}
              disabled={reordering}
              {...attributes}
              {...listeners}
              className="absolute inset-0 cursor-grab touch-none rounded-full disabled:cursor-not-allowed"
            />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-stone-900">{point.name}</span>
          {point.isLodging ? (
            <span className="text-[11px] text-violet-600">{MESSAGES.TRY.RESULT.lodgingFirstTip}</span>
          ) : point.type === PLACE_TYPE.FOOD ? (
            <span className="text-[11px] text-amber-600">{MESSAGES.ROUTE_RESULT.typeFood}</span>
          ) : null}
        </span>
        {point.isLodging ? null : (
          <span className="flex shrink-0 items-center">
            <button
              type="button"
              aria-label={R.orderUp}
              disabled={!canUp || reordering}
              onClick={() => onStep(-1)}
              className="grid h-7 w-7 place-items-center rounded-md text-stone-400 hover:bg-stone-100 disabled:opacity-30"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={R.orderDown}
              disabled={!canDown || reordering}
              onClick={() => onStep(1)}
              className="grid h-7 w-7 place-items-center rounded-md text-stone-400 hover:bg-stone-100 disabled:opacity-30"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={R.orderMove}
              onClick={() => onToggleMove(!moveOpen)}
              className={cn(
                'ml-1 grid h-7 place-items-center rounded-md border px-2 text-xs font-medium',
                moveOpen
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100',
              )}
            >
              {R.orderMoveBtn}
            </button>
          </span>
        )}

        {moveOpen ? (
          <>
            <button
              type="button"
              aria-label={R.moveToCancel}
              onClick={() => onToggleMove(false)}
              className="fixed inset-0 z-20 cursor-default"
            />
            <div className="absolute right-0 top-8 z-30 w-48 rounded-xl border border-stone-200 bg-white p-2 shadow-lg">
              <p className="px-1 pb-1.5 text-[11px] text-stone-500">{R.moveToTitle(count)}</p>
              <div className="grid grid-cols-6 gap-1">
                {Array.from({ length: count }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onMoveTo(i)}
                    className={cn(
                      'grid h-7 place-items-center rounded-md text-xs',
                      i === serial - 1
                        ? 'bg-gradient-to-r from-primary-from to-primary-to font-semibold text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
      {legNode}
    </li>
  );
}

/**
 * 游客试用第 3 步：按出行方式排好序的路线（地图 + 分段里程时间）；未登录保存跳登录，已登录调 /api/try/promote 落库。
 *
 * 与普通用户结果页保持一致的两点（2026-10-20 反馈）：
 * 1. 地图可拖动、可缩放（AmapMap 传 interactive）；
 * 2. 地点顺序可调整（拖序号 / ↑ ↓ / 移到第 N 位），改完按新顺序重算分段；
 *    住宿解析成功时固定在起点（序号 0），不参与移动。
 */
export function TryResultClient({ loggedIn }: { loggedIn: boolean }) {
  const M = MESSAGES.TRY.RESULT;
  const R = MESSAGES.ROUTE_RESULT;
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
  /** 正在按新顺序重算路段（此时禁用拖动与上下移动，避免并发改序） */
  const [reordering, setReordering] = useState(false);
  const [moveOpenId, setMoveOpenId] = useState<string | null>(null);
  /** 拖动/移动过程中的临时顺序：用于撤销（同步失败时回滚） */
  const orderReqRef = useRef(0);
  /** 最新草稿（手动调整顺序后会更新，用于「保存路线」落库当次看到的顺序） */
  const draftRef = useRef<TryDraft | null>(null);

  useEffect(() => {
    const d = readTryDraft();
    if (!d) {
      setStatus('noDraft');
      return;
    }
    draftRef.current = d;
    if (d.places.length < BUSINESS.GUEST_TRY_MIN_PLACES) {
      setDraft(d);
      setStatus('tooFew');
      return;
    }
    setDraft(d);
    setMode(d.transport);
  }, []);

  /** toast 自动消失，避免旧提示长时间挂在页面上 */
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  /** 交给 /api/try/order 的住宿参数（与首次请求同一份，服务端按落库缓存解析，不额外消耗额度） */
  const lodgingBody = useMemo(() => {
    if (!draft) return undefined;
    if (!draft.lodgingName && !draft.lodgingArea) return undefined;
    return {
      name: draft.lodgingName || null,
      area: draft.lodgingArea || null,
      city: draft.cityName,
    };
  }, [draft]);

  useEffect(() => {
    if (!draft) return;
    let cancelled = false;
    setStatus('loading');
    setMessage('');

    const points = draft.places.map((p) => ({ lat: p.lat, lng: p.lng, name: p.name, type: p.type }));

    void (async () => {
      try {
        const res = await fetch('/api/try/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points, mode, cityAdcode: draft.cityAdcode, lodging: lodgingBody }),
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
  }, [draft, mode, nonce, M.error, M.rateLimited, lodgingBody]);

  const points = result?.points ?? [];

  /** 住宿解析成功时固定在起点（序号 0）：可移动的下标范围从 headCount 开始 */
  const headCount = points.length > 0 && points[0].isLodging ? 1 : 0;
  const movableCount = Math.max(0, points.length - headCount);

  const numbered = useMemo(
    () =>
      points.map((point, i) => ({
        point,
        seq: point.isLodging ? 0 : i - headCount + 1,
      })),
    [points, headCount],
  );

  const mapPoints: AmapPoint[] = useMemo(
    () =>
      numbered.map(({ point, seq }) =>
        point.isLodging
          ? { lat: point.lat, lng: point.lng, label: point.name, lodging: true }
          : {
              lat: point.lat,
              lng: point.lng,
              order: seq,
              label: point.name,
              food: point.type === PLACE_TYPE.FOOD,
            },
      ),
    [numbered],
  );

  const mapLines = useMemo(
    () => (points.length >= 2 ? [{ path: points.map((p) => ({ lat: p.lat, lng: p.lng })) }] : []),
    [points],
  );

  /**
   * 手动调整顺序：先在本地按新顺序渲染（即时反馈），再把新顺序发给服务端重算分段。
   * manual=true 时服务端不重排（保持用户顺序），且走宽松的 reorder 限流桶。
   * 失败或超限 → 回滚到调整前的顺序并提示。
   */
  async function applyOrder(next: OrderPoint[]) {
    if (!result || !draft || reordering) return;
    const prev = result;
    const reqId = orderReqRef.current + 1;
    orderReqRef.current = reqId;

    setResult({ ...prev, points: next });
    setMoveOpenId(null);
    setReordering(true);

    try {
      const res = await fetch('/api/try/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // 住宿由服务端按 lodging 参数重新解析并固定在第 0 位，这里只送非住宿地点
          points: next
            .filter((p) => !p.isLodging)
            .map((p) => ({ lat: p.lat, lng: p.lng, name: p.name, type: p.type })),
          mode,
          cityAdcode: draft.cityAdcode,
          manual: true,
          lodging: lodgingBody,
        }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string } & Partial<OrderResult>;
      if (orderReqRef.current !== reqId) return;
      if (res.status === 429) {
        setResult(prev);
        setToast(M.reorderRateLimited);
        return;
      }
      if (!data.ok || !data.points || !data.legs) {
        setResult(prev);
        setToast(M.reorderFailed);
        return;
      }
      setResult({
        ...prev,
        points: data.points,
        legs: data.legs,
        distanceMeters: data.distanceMeters ?? 0,
        durationSeconds: data.durationSeconds ?? 0,
        estimated: Boolean(data.estimated),
        lodgingResolved: Boolean(data.lodgingResolved),
        lodging: data.lodging ?? null,
      });
      // 把新顺序写回草稿：这样「保存路线」落库的就是用户看到的顺序（住宿点不入草稿）。
      // 只写 sessionStorage 与 ref，不改 draft state —— 否则会触发上面的重新排序请求，把用户刚调好的顺序又冲掉。
      const rank = new Map(data.points.filter((p) => !p.isLodging).map((p, i) => [p.name, i]));
      const nextDraft: TryDraft = {
        ...draft,
        places: [...draft.places].sort(
          (a, b) => (rank.get(a.name) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.name) ?? Number.MAX_SAFE_INTEGER),
        ),
      };
      draftRef.current = nextDraft;
      saveTryDraft(nextDraft);
    } catch {
      if (orderReqRef.current !== reqId) return;
      setResult(prev);
      setToast(M.reorderFailed);
    } finally {
      if (orderReqRef.current === reqId) setReordering(false);
    }
  }

  /** 把第 from 位（0 基）移动到第 to 位（0 基，仅限可移动区间内） */
  function movePlace(from: number, to: number) {
    if (!result) return;
    if (to < headCount || to >= points.length || from < headCount || from === to) return;
    void applyOrder(arrayMove(points, from, to));
  }

  function kmText(meters: number) {
    return (meters / 1000).toFixed(1);
  }
  function minText(seconds: number) {
    return M.duration(Math.round(seconds / 60));
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const sortIds = points.map(sortIdOf);

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
    const latest = draftRef.current;
    if (!latest || saving) return;
    setSaveError('');
    setSaving(true);
    void (async () => {
      try {
        const res = await fetch('/api/try/promote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cityId: latest.cityId,
            cityName: latest.cityName,
            cityAdcode: latest.cityAdcode,
            title: latest.title,
            transport: latest.transport,
            lodgingName: latest.lodgingName,
            lodgingArea: latest.lodgingArea,
            places: latest.places.map((p) => ({
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

  const firstPlaceName = points.find((p) => !p.isLodging)?.name ?? '';

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

          {/* 地图：可拖动、可缩放（与普通用户结果页一致） */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <div className="h-[320px] w-full md:h-[380px]">
              <AmapMap points={mapPoints} lines={mapLines} interactive />
            </div>
            <p className="border-t border-stone-100 px-4 py-2 text-[11px] text-stone-400">{M.mapNote}</p>
          </div>

          {/* 顺序列表 + 分段 */}
          <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 md:p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-stone-900">{M.singleDay}</p>
              <p className="text-xs text-stone-500">{M.placesTotal(points.filter((p) => !p.isLodging).length)}</p>
            </div>
            <p className="mt-1 text-xs text-stone-500">{M.reorderTip}</p>
            {reordering ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-primary">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                {M.reorderBusy}
              </p>
            ) : null}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event: DragEndEvent) => {
                const { active, over } = event;
                if (!over || active.id === over.id) return;
                const from = sortIds.indexOf(String(active.id));
                const to = sortIds.indexOf(String(over.id));
                if (from >= 0 && to >= 0) movePlace(from, to);
              }}
            >
              <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
                <ol className="mt-3">
                  {numbered.map(({ point, seq }, i) => (
                    <SortablePlaceRow
                      key={sortIds[i]}
                      point={point}
                      serial={seq}
                      sortId={sortIds[i]}
                      count={movableCount}
                      canUp={i > headCount}
                      canDown={i >= headCount && i < points.length - 1}
                      reordering={reordering}
                      moveOpen={moveOpenId === sortIds[i]}
                      onToggleMove={(open) => setMoveOpenId(open ? sortIds[i] : null)}
                      onStep={(delta) => movePlace(i, i + delta)}
                      onMoveTo={(to) => movePlace(i, headCount + to)}
                      legNode={
                        i < points.length - 1 && result.legs[i] ? (
                          <div className="ml-[13px] flex items-center gap-2 border-l-2 border-dashed border-stone-200 py-1 pl-4 text-xs text-stone-500">
                            {M.legMeta(
                              NAV_MODE_LABEL[mode],
                              kmText(result.legs[i].distanceMeters),
                              minText(result.legs[i].durationSeconds),
                            )}
                          </div>
                        ) : null
                      }
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
            <p className="mt-4 rounded-xl bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-800">
              {M.totalMeta(kmText(result.distanceMeters), minText(result.durationSeconds))}
            </p>
            <p className="mt-2 text-[11px] text-stone-400">{M.lodgingFirstTip}</p>
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
