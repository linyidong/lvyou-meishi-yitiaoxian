'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  Bike,
  Bus,
  Car,
  Footprints,
  BedDouble,
  CheckCircle2,
  ListChecks,
  Loader2,
  MapPin,
  MapPinCheck,
  RefreshCw,
  Route as RouteIcon,
  Save,
  SquarePen,
  TrainFront,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import { BUSINESS } from '@/config/business';
import {
  INTERCITY_MODE,
  INTERCITY_MODE_LABEL,
  LODGING_TYPE_LABEL,
  PLACE_TYPE,
  PLACE_TYPE_LABEL,
  TRANSPORT,
  TRANSPORT_LABEL,
} from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { buildRouteOrder } from '@/lib/route-order';
import type { IntercityMode, LodgingType, PlaceType, Transport } from '@/types';

/** 已写入 route_places 的点位（dayIndex / orderIndex 为 0 基） */
export interface RouteEditPlace {
  placeId: string;
  name: string;
  type: PlaceType;
  address: string | null;
  lat: number | null;
  lng: number | null;
  dayIndex: number;
  orderIndex: number;
}

type Toast = { text: string; tone: 'ok' | 'err' };

const M = MESSAGES.ROUTE_EDIT;
/** 每天的分组标签底色（原型为 rose/teal/amber/indigo/sky 循环，产品色位改用 primary token） */
const DAY_COLORS = ['bg-primary', 'bg-teal-600', 'bg-amber-500', 'bg-indigo-600', 'bg-sky-600'];

/** 市内交通各方式的图标（与 TRANSPORT 取值一一对应） */
const TRANSPORT_ICON: Record<Transport, LucideIcon> = {
  [TRANSPORT.WALK]: Footprints,
  [TRANSPORT.BIKE]: Bike,
  [TRANSPORT.TRANSIT]: Bus,
  [TRANSPORT.DRIVE]: Car,
};

/** 市内交通各方式的时间估算速度（km/h，取自 BUSINESS） */
const TRANSPORT_SPEED_KMH: Record<Transport, number> = {
  [TRANSPORT.WALK]: BUSINESS.WALK_SPEED_KMH,
  [TRANSPORT.BIKE]: BUSINESS.BIKE_SPEED_KMH,
  [TRANSPORT.TRANSIT]: BUSINESS.TRANSIT_SPEED_KMH,
  [TRANSPORT.DRIVE]: BUSINESS.DRIVE_SPEED_KMH,
};

/** 两点间直线距离（公里），无坐标按 0 处理 */
function legKm(a: RouteEditPlace | undefined, b: RouteEditPlace): number {
  if (!a || a.lat === null || a.lng === null || b.lat === null || b.lng === null) return 0;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * U08 调整路线（六步流程第 5 步）：按天展示顺路顺序，用上下按钮微调，保存后进入 U09 路线图。
 */
export function RouteEditClient({
  routeId,
  routeTitle,
  cityName,
  days,
  transport,
  originCity,
  intercityMode,
  lodgingType,
  lodgingArea,
  lodgingNights,
  places,
}: {
  routeId: string;
  routeTitle: string;
  cityName: string | null;
  days: number;
  transport: Transport;
  originCity: string | null;
  intercityMode: IntercityMode | null;
  lodgingType: LodgingType | null;
  lodgingArea: string | null;
  lodgingNights: number | null;
  places: RouteEditPlace[];
}) {
  /** 按天分组的生效顺序（placeId） */
  const [plan, setPlan] = useState<string[][]>(() => {
    const groups: string[][] = Array.from({ length: Math.max(1, days) }, () => []);
    [...places]
      .sort((a, b) => (a.dayIndex - b.dayIndex) || (a.orderIndex - b.orderIndex))
      .forEach((p) => {
        const day = Math.min(Math.max(0, p.dayIndex), groups.length - 1);
        groups[day].push(p.placeId);
      });
    return groups;
  });
  const [adjusted, setAdjusted] = useState(false);
  const [mode, setMode] = useState<Transport>(transport);
  const [regenOpen, setRegenOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const byId = useMemo(() => {
    const map = new Map<string, RouteEditPlace>();
    places.forEach((p) => map.set(p.placeId, p));
    return map;
  }, [places]);

  function showToast(text: string, tone: Toast['tone']) {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 2600);
  }

  /** 时间估算：km ÷ 速度换算为分钟，≥60 分钟折成「X 小时 Y 分」 */
  function fmtMin(km: number): string {
    const speed = TRANSPORT_SPEED_KMH[mode];
    const minutes = Math.round((km / speed) * 60);
    if (minutes >= 60) return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`;
    return `${minutes} 分钟`;
  }

  function move(day: number, index: number, offset: number) {
    setPlan((prev) => {
      const next = prev.map((d) => [...d]);
      const target = index + offset;
      if (target < 0 || target >= next[day].length) return prev;
      const tmp = next[day][index];
      next[day][index] = next[day][target];
      next[day][target] = tmp;
      return next;
    });
    setAdjusted(true);
  }

  function moveDay(day: number, index: number, to: number) {
    if (to === day) return;
    if (plan[day].length <= 1) {
      showToast(M.minOneKeepDay, 'err');
      return;
    }
    setPlan((prev) => {
      const next = prev.map((d) => [...d]);
      const id = next[day].splice(index, 1)[0];
      next[to].push(id);
      return next;
    });
    setAdjusted(true);
    showToast(M.movedToDay(to + 1), 'ok');
  }

  function regenerate() {
    const items = buildRouteOrder(
      places.map((p) => ({ placeId: p.placeId, lat: p.lat, lng: p.lng })),
      days,
    );
    const groups: string[][] = Array.from({ length: Math.max(1, days) }, () => []);
    items.forEach((it) => {
      const day = Math.min(Math.max(0, it.dayIndex), groups.length - 1);
      groups[day].push(it.placeId);
    });
    setPlan(groups);
    setAdjusted(false);
    setRegenOpen(false);
    showToast(M.regenDone, 'ok');
  }

  async function save() {
    setSaving(true);
    try {
      const items = plan.flatMap((day, dayIndex) =>
        day.map((placeId, orderIndex) => ({ placeId, dayIndex, orderIndex })),
      );
      const res = await fetch(`/api/routes/${routeId}/places`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) {
        showToast(MESSAGES.NETWORK_ERROR, 'err');
        return;
      }
      showToast(M.saveOk, 'ok');
    } catch {
      showToast(MESSAGES.NETWORK_ERROR, 'err');
    } finally {
      setSaving(false);
    }
  }

  const city = cityName ?? '';
  const many = plan.length > 1;
  const totalCount = plan.reduce((sum, day) => sum + day.length, 0);
  /** 当前市内交通方式的图标（用于路段行） */
  const ModeIcon = TRANSPORT_ICON[mode];

  /** 每天内的里程（公里），下标与 plan 一致 */
  const dayKms = useMemo(
    () =>
      plan.map((day) => {
        let km = 0;
        for (let i = 1; i < day.length; i += 1) {
          km += legKm(byId.get(day[i - 1]), byId.get(day[i]) as RouteEditPlace);
        }
        return km;
      }),
    [plan, byId],
  );
  const totalKm = dayKms.reduce((a, b) => a + b, 0);

  const intercityText = (() => {
    if (intercityMode && intercityMode !== INTERCITY_MODE.NONE) {
      return M.intercityRoute(
        INTERCITY_MODE_LABEL[intercityMode],
        originCity ?? M.originLabel,
        city,
      );
    }
    if (originCity && city && originCity === city) return M.intercitySame;
    return M.intercityNone;
  })();

  const lodgingText = lodgingType
    ? M.lodgingValue(LODGING_TYPE_LABEL[lodgingType], lodgingArea, lodgingNights)
    : M.lodgingNone;

  // 无权限由服务端拦截；这里只剩空态（未生成顺序）
  if (places.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
        <span className="w-16 h-16 mx-auto rounded-2xl bg-stone-100 text-stone-400 grid place-items-center">
          <RouteIcon className="h-[34px] w-[34px]" />
        </span>
        <p className="mt-4 font-semibold">{M.emptyTitle}</p>
        <p className="mt-1 text-sm text-stone-500">{M.emptyDesc}</p>
        <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center px-6">
          <Link
            href={ROUTES.ROUTE_PLACES(routeId)}
            className="h-10 px-5 rounded-lg bg-gradient-to-r from-primary-from to-primary-to hover:brightness-110 text-white text-sm font-semibold flex items-center justify-center"
          >
            {M.emptyGo}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {!adjusted ? (
        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {M.banner}
        </div>
      ) : null}

      {/* 出行设置（本页只读） */}
      <div className="mb-4 rounded-2xl bg-white border border-stone-200 p-4 md:p-5">
        <div className="flex items-center gap-2 justify-between flex-wrap">
          <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
            <TrainFront className="h-4 w-4 text-primary" />
            {M.settingsTitle}
          </h2>
          <Link
            href={ROUTES.ROUTE_NEW}
            className="h-8 px-3 rounded-lg border border-stone-300 bg-white text-xs flex items-center gap-1"
          >
            <SquarePen className="h-3.5 w-3.5" />
            {M.editSettings}
          </Link>
        </div>
        <div className="mt-3 grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-stone-50 p-3">
            <p className="text-xs text-stone-500 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              {M.originLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-stone-900">{originCity ?? M.originNone}</p>
          </div>
          <div className="rounded-xl bg-stone-50 p-3">
            <p className="text-xs text-stone-500 flex items-center gap-1">
              <Waypoints className="h-3.5 w-3.5 text-primary" />
              {M.intercityLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-stone-900">{intercityText}</p>
          </div>
          <div className="rounded-xl bg-stone-50 p-3">
            <p className="text-xs text-stone-500 flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5 text-primary" />
              {M.lodgingLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-stone-900">{lodgingText}</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-stone-400">{M.settingsNote}</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-stone-900 flex items-center gap-2 flex-wrap">
            <span>{routeTitle}</span>
            {adjusted ? (
              <span className="text-xs font-medium px-2 py-1 rounded-lg bg-amber-100 text-amber-700">
                {M.adjTag}
              </span>
            ) : null}
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            {M.routeMeta(
              city,
              many ? M.daysPartMany(plan.length) : M.daysPartSingle,
              totalCount,
              TRANSPORT_LABEL[mode],
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={ROUTES.ROUTE_PLACES(routeId)}
            className="h-10 px-4 rounded-xl border border-stone-300 bg-white text-sm flex items-center gap-1.5"
          >
            <ListChecks className="h-4 w-4" />
            {M.editPlaces}
          </Link>
          <button
            type="button"
            onClick={() => setRegenOpen(true)}
            className="h-10 px-4 rounded-xl border border-stone-300 bg-white text-sm flex items-center gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            {M.regen}
          </button>
        </div>
      </div>

      <div className="mt-6 grid lg:grid-cols-3 gap-6">
        <section className="min-w-0 lg:col-span-2 space-y-4">
          {plan.map((day, d) => {
            const dayKm = dayKms[d];
            return (
              <div key={`day-${d}`} className="rounded-2xl bg-stone-100/70 p-3 md:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-white text-xs font-semibold ${
                      DAY_COLORS[d % DAY_COLORS.length]
                    }`}
                  >
                    {many ? M.dayLabel(d + 1) : M.dayAll}
                  </span>
                  <span className="text-xs text-stone-500">
                    {M.dayMeta(day.length, dayKm.toFixed(1), fmtMin(dayKm))}
                  </span>
                </div>
                {day.map((id, i) => {
                  const place = byId.get(id);
                  if (!place) return null;
                  const km = i > 0 ? legKm(byId.get(day[i - 1]), place) : 0;
                  return (
                    <div key={id}>
                      {i > 0 ? (
                        <div className="pl-[46px] py-1 text-[11px] text-stone-400 flex items-center gap-1">
                          <ModeIcon className="h-3.5 w-3.5" />
                          {M.legMeta(km.toFixed(1), fmtMin(km))}
                        </div>
                      ) : null}
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-stone-200">
                        <span
                          className={`w-8 h-8 rounded-full text-white text-sm font-bold grid place-items-center shrink-0 ${
                            place.type === PLACE_TYPE.FOOD ? 'bg-amber-500' : 'bg-teal-500'
                          }`}
                        >
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{place.name}</p>
                          <p className="text-xs text-stone-500">
                            {PLACE_TYPE_LABEL[place.type]} · {place.address ?? ''}
                          </p>
                        </div>
                        {many ? (
                          <select
                            value={d}
                            onChange={(e) => moveDay(d, i, Number(e.target.value))}
                            aria-label={M.moveDayAria}
                            className="h-8 px-1 rounded-lg border border-stone-200 text-xs bg-white"
                          >
                            {plan.map((_, k) => (
                              <option key={`opt-${k}`} value={k}>
                                {M.moveDayOption(k + 1)}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => move(d, i, -1)}
                            disabled={i === 0}
                            aria-label={M.moveUp}
                            className="w-8 h-8 rounded-lg border border-stone-200 grid place-items-center hover:bg-stone-50 disabled:opacity-30"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => move(d, i, 1)}
                            disabled={i === day.length - 1}
                            aria-label={M.moveDown}
                            className="w-8 h-8 rounded-lg border border-stone-200 grid place-items-center hover:bg-stone-50 disabled:opacity-30"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </section>

        <aside className="min-w-0 space-y-4">
          <div className="rounded-2xl bg-white border border-stone-200 p-5 lg:sticky lg:top-24">
            <h3 className="font-semibold">{M.transportTitle}</h3>
            <p className="mt-1 text-[11px] text-stone-400">{M.transportNote}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {Object.values(TRANSPORT).map((m) => {
                const Icon = TRANSPORT_ICON[m];
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`h-10 rounded-lg border text-sm flex items-center justify-center gap-1 ${
                      mode === m
                        ? 'border-primary bg-primary/5 text-primary font-semibold'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {TRANSPORT_LABEL[m]}
                  </button>
                );
              })}
            </div>
            <div className="mt-5 rounded-xl bg-stone-50 p-4 grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-xs text-stone-500">{M.totalKmLabel}</p>
                <p className="text-xl font-bold text-stone-900">{totalKm.toFixed(1)} km</p>
              </div>
              <div>
                <p className="text-xs text-stone-500">{M.totalMinLabel}</p>
                <p className="text-xl font-bold text-stone-900">{fmtMin(totalKm)}</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-stone-400">{M.estimateNote}</p>
            <Link
              href={ROUTES.ROUTE_DETAIL(routeId)}
              className="mt-5 w-full h-12 rounded-xl bg-gradient-to-r from-primary-from to-primary-to hover:brightness-110 text-white font-semibold flex items-center justify-center gap-2"
            >
              <MapPinCheck className="h-4 w-4" />
              {M.done}
            </Link>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="mt-2 w-full h-11 rounded-xl border border-stone-300 hover:bg-stone-50 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {M.save}
            </button>
            <p className="mt-3 text-[11px] text-stone-400">{M.reorderNote}</p>
          </div>
        </aside>
      </div>

      {regenOpen ? (
        <div className="fixed inset-0 z-50 bg-stone-900/50 items-center justify-center p-4 flex">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <span className="w-12 h-12 rounded-xl bg-primary/5 text-primary grid place-items-center">
              <RefreshCw className="h-6 w-6" />
            </span>
            <h3 className="mt-4 text-lg font-semibold">{M.regenTitle}</h3>
            <p className="mt-2 text-sm text-stone-600">{M.regenDesc}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRegenOpen(false)}
                className="h-11 rounded-xl border border-stone-300 text-sm"
              >
                {M.regenCancel}
              </button>
              <button
                type="button"
                onClick={regenerate}
                className="h-11 rounded-xl bg-gradient-to-r from-primary-from to-primary-to text-white text-sm font-semibold flex items-center justify-center gap-1"
              >
                {M.regenConfirm}
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
    </div>
  );
}
