'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bike,
  Bus,
  Camera,
  Car,
  Footprints,
  Loader2,
  MapPinOff,
  MapPinPlus,
  Plus,
  Route as RouteIcon,
  Utensils,
  X,
  type LucideIcon,
} from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { PLACE_TYPE, PLACE_TYPE_LABEL, TRANSPORT_LABEL, TRANSPORT } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import type { LodgingCoords } from '@/lib/amap';
import { distributeByDays, orderByStraightLine, straightDist2 } from '@/lib/route-order';
import type { NavMode, PlaceType, Transport } from '@/types';

/** 当前城市的已导入地点 */
export interface RoutePlaceOption {
  id: string;
  name: string;
  type: PlaceType;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

type PlaceTab = 'all' | PlaceType;

const M = MESSAGES.ROUTE_PLACES;

/** 起点选择里代表「从离住宿最近的地点出发」的哨兵值 */
const START_FROM_LODGING = 'lodging';

const filterTabCls = (on: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm ${on ? 'bg-white shadow-sm font-semibold text-stone-900' : 'text-stone-500'}`;
const pickCls = (on: boolean) =>
  `h-10 rounded-lg border text-sm flex items-center justify-center gap-1 ${
    on ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
  }`;
const typeIconCls = (type: PlaceType) =>
  `w-10 h-10 rounded-xl grid place-items-center shrink-0 ${
    type === PLACE_TYPE.FOOD ? 'bg-amber-50 text-amber-600' : 'bg-teal-50 text-teal-600'
  }`;
/** 市内交通各方式的图标（与 TRANSPORT 取值一一对应） */
const TRANSPORT_ICON: Record<Transport, LucideIcon> = {
  [TRANSPORT.WALK]: Footprints,
  [TRANSPORT.BIKE]: Bike,
  [TRANSPORT.TRANSIT]: Bus,
  [TRANSPORT.DRIVE]: Car,
};

/**
 * U07 勾选地点（六步流程第 4 步）：勾选后按顺路顺序排路线，写库后进入 U08 调整。
 */
export function RoutePlacesClient({
  routeId,
  cityName,
  days,
  transport,
  places,
  initialCheckedIds,
  lodging,
  placesPerDay,
}: {
  routeId: string;
  cityName: string | null;
  days: number;
  transport: Transport;
  places: RoutePlaceOption[];
  /** 已在当前路线中的 place_id，作为默认勾选 */
  initialCheckedIds: string[];
  /** 终点城市的住宿（已解析坐标），用于「起点默认离住宿最近」与地图标记 */
  lodging: LodgingCoords | null;
  /** 当前档位单日地点上限（免费 6 / 会员 12 / 管理员按单条上限兜底），用于勾选前本地校验与提示 */
  placesPerDay: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<PlaceTab>('all');
  const [checked, setChecked] = useState<Set<string>>(() => new Set(initialCheckedIds));
  const [generating, setGenerating] = useState(false);
  const [genErr, setGenErr] = useState('');
  const [failed, setFailed] = useState(false);
  const [delTarget, setDelTarget] = useState<RoutePlaceOption | null>(null);
  const [toastText, setToastText] = useState('');
  /** 起点：'' = 不指定（服务端自动挑），START_FROM_LODGING = 离住宿最近的点，其余为 place id */
  const [startAt, setStartAt] = useState(lodging ? START_FROM_LODGING : '');

  const visible = useMemo(
    () => places.filter((p) => (tab === 'all' ? true : p.type === tab)),
    [places, tab],
  );

  const selected = useMemo(() => places.filter((p) => checked.has(p.id)), [places, checked]);
  const checkedSpots = selected.filter((p) => p.type === PLACE_TYPE.ATTRACTION).length;
  const checkedFoods = selected.filter((p) => p.type === PLACE_TYPE.FOOD).length;
  /** 已勾选且已有坐标的点：只有它们能参与真实路网排序与算路 */
  const selectedWithCoord = useMemo(
    () => selected.filter((p) => p.lat !== null && p.lng !== null),
    [selected],
  );

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function checkAllVisible(on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      visible.forEach((p) => (on ? next.add(p.id) : next.delete(p.id)));
      return next;
    });
  }

  /** 调一次「只排序」接口（按该方式的高德距离矩阵排），失败返回 null */
  async function postOrder(points: string[], startIndex: number): Promise<number[] | null> {
    try {
      const res = await fetch('/api/amap/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points, mode: transport as NavMode, startIndex }),
      });
      const data = (await res.json()) as { ok?: boolean; order?: number[] };
      if (!data.ok || !Array.isArray(data.order)) return null;
      return data.order;
    } catch {
      return null;
    }
  }

  /** 起点在 selectedWithCoord 里的下标；-1 = 不指定，交给服务端自动挑最顺的起点 */
  function resolveStartIndex(): number {
    if (startAt === START_FROM_LODGING && lodging) {
      let best = -1;
      let bestDist = Number.POSITIVE_INFINITY;
      selectedWithCoord.forEach((p, i) => {
        const d = straightDist2({ lat: p.lat as number, lng: p.lng as number }, lodging);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      return best;
    }
    if (startAt) {
      const idx = selectedWithCoord.findIndex((p) => p.id === startAt);
      return idx >= 0 ? idx : -1;
    }
    return -1;
  }

  /**
   * 排好所选地点的顺序：优先用高德真实路网矩阵（最近邻 + 2-opt 去交叉），
   * 拿不到矩阵（额度用尽 / 网络异常）时退回 cos 纬度校正后的直线距离。
   */
  async function orderSelected(): Promise<string[]> {
    const tail = selected.filter((p) => p.lat === null || p.lng === null).map((p) => p.id);
    if (selectedWithCoord.length >= 3) {
      const order = await postOrder(
        selectedWithCoord.map((p) => `${p.lng},${p.lat}`),
        resolveStartIndex(),
      );
      if (order) return [...order.map((i) => selectedWithCoord[i].id), ...tail];
    }
    return orderByStraightLine(selected.map((p) => ({ placeId: p.id, lat: p.lat, lng: p.lng })));
  }

  async function generate() {
    if (selected.length < 2) {
      setGenErr(MESSAGES.ROUTE_MIN_PLACES);
      return;
    }
    if (days > selected.length) {
      setGenErr(M.dayMinPlaces(days));
      return;
    }
    if (Math.ceil(selected.length / days) > placesPerDay) {
      setGenErr(MESSAGES.ROUTE_DAY_LIMIT_EXCEEDED(placesPerDay));
      return;
    }
    if (selected.length > BUSINESS.MAX_PLACES_PER_ROUTE) {
      setGenErr(MESSAGES.ROUTE_PLACES_LIMIT_EXCEEDED);
      return;
    }

    setGenErr('');
    setGenerating(true);
    try {
      const items = distributeByDays(await orderSelected(), days);
      const res = await fetch(`/api/routes/${routeId}/places`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) {
        setFailed(true);
        return;
      }
      router.push(ROUTES.ROUTE_EDIT(routeId));
    } catch {
      setFailed(true);
    } finally {
      setGenerating(false);
    }
  }

  function removePlace() {
    if (!delTarget) return;
    const name = delTarget.name;
    const id = delTarget.id;
    setChecked((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setDelTarget(null);
    setToastText(M.toastRemoved(name));
    setTimeout(() => setToastText(''), 2600);
  }

  const header = (
    <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-stone-900">
          {cityName ?? M.noCity} {M.titleSuffix}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {places.length > 0 && !failed
            ? M.sum(places.length, selected.length, checkedSpots, checkedFoods)
            : M.subtitle}
        </p>
      </div>
      <Link
        href={ROUTES.ROUTE_ADD(routeId)}
        className="h-10 px-4 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-sm font-medium flex items-center justify-center gap-1.5"
      >
        <Plus className="h-4 w-4" />
        {M.continueAdd}
      </Link>
    </div>
  );

  if (failed) {
    return (
      <div>
        {header}
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 py-16 text-center">
          <MapPinOff className="mx-auto h-12 w-12 text-red-400" />
          <p className="mt-3 font-semibold text-red-700">{M.errorTitle}</p>
          <p className="mt-1 text-sm text-red-600 px-6">{M.errorDesc}</p>
          <button
            type="button"
            onClick={() => setFailed(false)}
            className="mt-4 h-10 px-5 rounded-lg bg-primary hover:brightness-110 text-white text-sm font-semibold"
          >
            {M.errorBack}
          </button>
        </div>
      </div>
    );
  }

  if (places.length === 0) {
    return (
      <div>
        {header}
        <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
          <span className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-500 grid place-items-center">
            <MapPinPlus className="h-[34px] w-[34px]" />
          </span>
          <p className="mt-4 font-semibold">{M.emptyTitle}</p>
          <p className="mt-1 text-sm text-stone-500">{M.emptyDesc}</p>
          <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center px-6">
            <Link
              href={ROUTES.ROUTE_ADD(routeId)}
              className="h-10 px-5 rounded-lg bg-gradient-to-r from-primary-from to-primary-to hover:brightness-110 text-white text-sm font-semibold flex items-center justify-center"
            >
              {M.emptyGo}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}

      <div className="mt-6 grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 rounded-2xl bg-white border border-stone-200">
          <div className="p-4 border-b border-stone-100 flex flex-wrap items-center gap-2">
            <div className="flex bg-stone-100 rounded-xl p-1">
              {(
                [
                  ['all', M.tabAll],
                  [PLACE_TYPE.ATTRACTION, PLACE_TYPE_LABEL[PLACE_TYPE.ATTRACTION]],
                  [PLACE_TYPE.FOOD, PLACE_TYPE_LABEL[PLACE_TYPE.FOOD]],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={filterTabCls(tab === value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <button type="button" onClick={() => checkAllVisible(true)} className="text-primary hover:underline">
                {M.checkAll}
              </button>
              <button
                type="button"
                onClick={() => checkAllVisible(false)}
                className="text-stone-500 hover:underline"
              >
                {M.checkNone}
              </button>
            </div>
          </div>

          <ul className="divide-y divide-stone-100">
            {visible.map((p) => {
              const on = checked.has(p.id);
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
                  <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(p.id)}
                      className="w-5 h-5 accent-primary shrink-0"
                    />
                    <span className={typeIconCls(p.type)}>
                      {p.type === PLACE_TYPE.FOOD ? (
                        <Utensils className="h-5 w-5" />
                      ) : (
                        <Camera className="h-5 w-5" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block font-medium truncate ${on ? 'text-stone-900' : 'text-stone-400'}`}
                      >
                        {p.name}
                      </span>
                      <span className="block text-xs text-stone-500 mt-0.5">
                        {PLACE_TYPE_LABEL[p.type]} · {p.address ?? M.noAddress}
                      </span>
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setDelTarget(p)}
                    aria-label="移除"
                    className="w-9 h-9 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 grid place-items-center shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          {visible.length === 0 ? (
            <div className="p-10 text-center text-sm text-stone-500">{M.filterEmpty}</div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl bg-white border border-stone-200 p-5">
            <h3 className="font-semibold">{M.settingsTitle}</h3>
            <p className="mt-3 text-xs font-medium text-stone-500">{M.daysLabel}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" disabled className={`h-10 rounded-lg border text-sm ${
                days === 1 ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-stone-200 text-stone-600'
              }`}>
                {M.single}
              </button>
              <button type="button" disabled className={`h-10 rounded-lg border text-sm ${
                days > 1 ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-stone-200 text-stone-600'
              }`}>
                {M.many}
              </button>
            </div>
            {days > 1 ? (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2">
                <span className="text-sm text-stone-600">{M.daysUnitPre}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled
                    aria-label={M.daysMinus}
                    className="w-8 h-8 rounded-lg bg-white border border-stone-200"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-semibold">{days}</span>
                  <button
                    type="button"
                    disabled
                    aria-label={M.daysPlus}
                    className="w-8 h-8 rounded-lg bg-white border border-stone-200"
                  >
                    +
                  </button>
                </div>
              </div>
            ) : null}
            <p className="mt-1 text-[11px] text-stone-400">{M.daysNote}</p>
            <p className="mt-1 text-[11px] text-stone-400">{M.limitNote(placesPerDay)}</p>
            <p className="mt-4 text-xs font-medium text-stone-500">{M.transportLabel}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {Object.values(TRANSPORT).map((m) => {
                const Icon = TRANSPORT_ICON[m];
                return (
                  <button key={m} type="button" disabled className={pickCls(transport === m)}>
                    <Icon className="h-4 w-4" />
                    {TRANSPORT_LABEL[m]}
                  </button>
                );
              })}
            </div>
            {selectedWithCoord.length >= 2 ? (
              <div className="mt-4">
                <p className="text-xs font-medium text-stone-500">{M.startLabel}</p>
                <select
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  aria-label={M.startLabel}
                  className="mt-2 h-10 w-full rounded-lg border border-stone-200 bg-white px-2 text-sm text-stone-700"
                >
                  {lodging ? (
                    <option value={START_FROM_LODGING}>{M.startFromLodging(lodging.name)}</option>
                  ) : null}
                  <option value="">{M.startAuto}</option>
                  {selectedWithCoord.map((p) => (
                    <option key={p.id} value={p.id}>
                      {M.startFrom(p.name)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-stone-400">{M.startNote}</p>
              </div>
            ) : null}
            {genErr ? (
              <div className="mt-4 rounded-lg bg-red-50 text-red-700 text-xs px-3 py-2">{genErr}</div>
            ) : null}
            <button
              type="button"
              onClick={generate}
              className="mt-5 w-full h-12 rounded-xl bg-gradient-to-r from-primary-from to-primary-to hover:brightness-110 text-white font-semibold flex items-center justify-center gap-2"
            >
              <RouteIcon className="h-5 w-5" />
              <span>{M.generateCount(selected.length)}</span>
            </button>
          </div>
        </aside>
      </div>

      {generating ? (
        <div className="fixed inset-0 z-50 bg-stone-900/50 items-center justify-center p-4 flex">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p className="mt-3 font-semibold">{MESSAGES.ROUTE_GENERATING}</p>
            <p className="mt-1 text-xs text-stone-500">{M.genMaskDesc}</p>
          </div>
        </div>
      ) : null}

      {delTarget ? (
        <div className="fixed inset-0 z-50 bg-stone-900/50 items-center justify-center p-4 flex">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold">{M.delTitle}</h3>
            <p className="mt-2 text-sm text-stone-600">
              {M.delPre}
              <span>{delTarget.name}</span>
              {M.delPost}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDelTarget(null)}
                className="h-11 rounded-xl border border-stone-300 text-sm"
              >
                {M.delCancel}
              </button>
              <button
                type="button"
                onClick={removePlace}
                className="h-11 rounded-xl bg-red-600 text-white text-sm font-semibold"
              >
                {M.delConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toastText ? (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-xl bg-foreground px-4 py-2.5 text-sm text-white shadow-lg">
          {toastText}
        </div>
      ) : null}
    </div>
  );
}
