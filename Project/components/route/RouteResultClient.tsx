'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BedDouble,
  Bike,
  CheckCircle2,
  Footprints,
  Map as MapIcon,
  MapPin,
  Pencil,
  Route,
  Save,
  Smartphone,
  TrainFront,
} from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { PLACE_TYPE, PLACE_TYPE_LABEL, TRANSPORT, TRANSPORT_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { ROUTES } from '@/config/routes';
import type { PlaceType, Transport } from '@/types';

export interface ResultPlace {
  name: string;
  type: PlaceType;
  address: string | null;
  note: string | null;
  lat: number | null;
  lng: number | null;
}

export interface ResultDay {
  /** 0 基天数下标 */
  dayIndex: number;
  places: ResultPlace[];
}

const M = MESSAGES.ROUTE_RESULT;

/** 原型按天轮换的线路颜色（DAY_HEX） */
const DAY_HEX = ['#e11d48', '#0d9488', '#d97706', '#4f46e5', '#0284c7'] as const;

/** YYYY-MM-DD HH:mm */
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 两点坐标间直线距离（公里），缺坐标返回 null */
function legKm(a: ResultPlace, b: ResultPlace): number | null {
  if (a.lat === null || a.lng === null || b.lat === null || b.lng === null) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** 距离对应的在途时间文案 */
function fmtMin(km: number, transport: Transport): string {
  const speed = transport === TRANSPORT.BIKE ? BUSINESS.BIKE_SPEED_KMH : BUSINESS.WALK_SPEED_KMH;
  return M.duration(Math.round((km / speed) * 60));
}

interface Pt {
  x: number;
  y: number;
  place: ResultPlace;
  order: number;
  color: string;
}

/** 把带坐标的地点按包围盒投影到 0-100 的画布坐标系（无坐标返回空） */
function projectPoints(days: ResultDay[]): Pt[] {
  const withCoords = days.flatMap((d) =>
    d.places
      .map((p, i) => ({ place: p, i, dayIndex: d.dayIndex }))
      .filter((x): x is { place: ResultPlace; i: number; dayIndex: number } =>
        Boolean(x.place.lat !== null && x.place.lng !== null),
      ),
  );
  if (withCoords.length === 0) return [];

  const lats = withCoords.map((x) => x.place.lat as number);
  const lngs = withCoords.map((x) => x.place.lng as number);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const spanLat = maxLat - minLat || 1;
  const spanLng = maxLng - minLng || 1;

  return withCoords.map((x) => ({
    x: 8 + (((x.place.lng as number) - minLng) / spanLng) * 84,
    y: 8 + ((maxLat - (x.place.lat as number)) / spanLat) * 84,
    place: x.place,
    order: x.i + 1,
    color: x.place.type === PLACE_TYPE.FOOD ? '#f59e0b' : '#14b8a6',
  }));
}

/**
 * U09 路线结果：按天顺序列表 + 示意地图（原型 SVG 示意）。
 * 地图与站点间距离依赖真实经纬度（lat/lng），缺坐标时只渲染底图，不画站点与线段。
 */
export function RouteResultClient({
  routeId,
  title,
  cityName,
  days,
  transport,
  originCity,
  intercityLabel,
  lodgingLabel,
  resultDays,
  totalPlaces,
  createdAt,
}: {
  routeId: string;
  title: string;
  cityName: string | null;
  days: number;
  transport: Transport;
  originCity: string | null;
  intercityLabel: string;
  lodgingLabel: string;
  resultDays: ResultDay[];
  totalPlaces: number;
  createdAt: string;
}) {
  const [activeDay, setActiveDay] = useState(-1);
  const [shot, setShot] = useState(false);
  const [saved, setSaved] = useState(false);

  if (totalPlaces === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-stone-100 text-stone-400">
          <MapIcon className="h-[34px] w-[34px]" />
        </span>
        <p className="mt-4 font-semibold">{M.emptyTitle}</p>
        <p className="mt-1 text-sm text-stone-500">{M.emptyDesc}</p>
        <Link
          href={ROUTES.ROUTE_PLACES(routeId)}
          className="mt-5 inline-flex h-10 items-center rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-5 text-sm font-semibold text-white hover:brightness-110"
        >
          {M.emptyGo}
        </Link>
      </div>
    );
  }

  const many = days > 1;
  const meta = `${cityName ?? M.noCity} · ${many ? M.metaDays(days) : M.metaSingle} · ${M.metaCount(
    totalPlaces,
  )} · ${TRANSPORT_LABEL[transport]}`;

  const visibleDays = activeDay === -1 ? resultDays : resultDays.filter((d) => d.dayIndex === activeDay);
  const TransIcon = transport === TRANSPORT.BIKE ? Bike : Footprints;

  let totalKm = 0;
  const dayTotals = new Map<number, number>();
  for (const day of resultDays) {
    let km = 0;
    for (let i = 1; i < day.places.length; i += 1) {
      const leg = legKm(day.places[i - 1], day.places[i]);
      if (leg !== null) km += leg;
    }
    dayTotals.set(day.dayIndex, km);
    totalKm += km;
  }

  const points = projectPoints(visibleDays);

  return (
    <>
      {/* 工具条 */}
      {shot ? null : (
        <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <Link
              href={ROUTES.ROUTE_EDIT(routeId)}
              aria-label={M.backAria}
              className="grid h-9 w-9 place-items-center rounded-lg border border-stone-200 bg-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs text-emerald-700">
              {M.savedBadge(fmtDateTime(createdAt))}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 md:flex">
            <Link
              href={ROUTES.ROUTE_EDIT(routeId)}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 text-sm"
            >
              <Pencil className="h-4 w-4" />
              {M.adjust}
            </Link>
            <button
              type="button"
              onClick={() => setShot(true)}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 text-sm"
            >
              <Smartphone className="h-4 w-4" />
              {M.shotMode}
            </button>
            <button
              type="button"
              onClick={() => setSaved(true)}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-4 text-sm font-semibold text-white hover:brightness-110"
            >
              <Save className="h-4 w-4" />
              {M.save}
            </button>
          </div>
        </div>
      )}

      {/* 保存成功提示（展示层，点击「保存路线」后出现） */}
      {saved ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {M.savedBanner}
          <Link href={ROUTES.MY_ROUTES} className="ml-auto font-semibold underline">
            {M.savedBannerGo}
          </Link>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 md:px-6 md:pt-6">
          <div>
            <p className="flex items-center gap-1 text-xs font-semibold text-primary">
              <Route className="h-4 w-4" />
              {PRODUCT.NAME}
            </p>
            <h1 className="mt-1 text-xl font-bold text-stone-900 md:text-2xl">{title}</h1>
            <p className="mt-1 text-sm text-stone-500">{meta}</p>
          </div>
          <div className="flex shrink-0 gap-3 pt-1 text-xs">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
              {M.legendSpot}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              {M.legendFood}
            </span>
          </div>
        </div>

        {/* 天切换（多日时显示） */}
        {many ? (
          <div className="mt-4 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:px-6 [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setActiveDay(-1)}
              className={`h-8 shrink-0 rounded-full px-3 text-xs ${
                activeDay === -1 ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
              }`}
            >
              {M.allDays}
            </button>
            {resultDays.map((d) => (
              <button
                key={d.dayIndex}
                type="button"
                onClick={() => setActiveDay(d.dayIndex)}
                className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs ${
                  activeDay === d.dayIndex ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: DAY_HEX[d.dayIndex % 5] }}
                />
                {M.dayLabel(d.dayIndex + 1)}
              </button>
            ))}
          </div>
        ) : null}

        {/* 行程信息条 */}
        <div className="mx-5 mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 md:mx-6">
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <p className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <span className="shrink-0 text-stone-500">{M.originLabel}</span>
              <span className="truncate font-semibold text-stone-900">
                {originCity ?? M.originNone}
              </span>
            </p>
            <p className="flex items-center gap-1.5">
              <TrainFront className="h-4 w-4 shrink-0 text-primary" />
              <span className="shrink-0 text-stone-500">{M.intercityLabel}</span>
              <span className="truncate font-semibold text-stone-900">{intercityLabel}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <BedDouble className="h-4 w-4 shrink-0 text-primary" />
              <span className="shrink-0 text-stone-500">{M.lodgingLabel}</span>
              <span className="truncate font-semibold text-stone-900">{lodgingLabel}</span>
            </p>
          </div>
          <p className="mt-2 text-[11px] text-stone-400">{M.tripNote}</p>
        </div>

        <div className="mt-4 grid lg:grid-cols-5">
          {/* 顺序列表 */}
          <div className="order-2 px-5 pb-6 md:px-6 lg:order-1 lg:col-span-2 lg:border-r lg:border-stone-100">
            <ol className="relative">
              {visibleDays.map((day) =>
                day.places.length === 0 ? null : (
                  <Fragment key={`day-${day.dayIndex}`}>
                    {many ? (
                      <li className="mb-2 mt-4 flex items-center gap-2 text-sm font-semibold first:mt-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: DAY_HEX[day.dayIndex % 5] }}
                        />
                        {M.dayLabel(day.dayIndex + 1)}
                        {(dayTotals.get(day.dayIndex) ?? 0) > 0 ? (
                          <span className="text-xs font-normal text-stone-400">
                            {M.dayMeta(
                              (dayTotals.get(day.dayIndex) ?? 0).toFixed(1),
                              fmtMin(dayTotals.get(day.dayIndex) ?? 0, transport),
                            )}
                          </span>
                        ) : null}
                      </li>
                    ) : null}
                    {day.places.map((p, i) => {
                      const isFood = p.type === PLACE_TYPE.FOOD;
                      const next = day.places[i + 1];
                      const leg = next ? legKm(p, next) : null;
                      return (
                        <li key={`${day.dayIndex}-${p.name}-${i}`}>
                          <div className="flex items-center gap-3">
                            <span
                              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${
                                isFood ? 'bg-amber-500' : 'bg-teal-500'
                              }`}
                            >
                              {i + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{p.name}</p>
                              <p className="text-xs text-stone-500">
                                {PLACE_TYPE_LABEL[p.type]} · {p.address ?? M.noAddress}
                              </p>
                            </div>
                          </div>
                          {leg !== null ? (
                            <p className="flex items-center gap-1 py-1 pl-11 text-[11px] text-stone-400">
                              <TransIcon className="h-3.5 w-3.5" />
                              {M.legMeta(leg.toFixed(1), fmtMin(leg, transport))}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </Fragment>
                ),
              )}
            </ol>
          </div>

          {/* 示意地图 */}
          <div className="order-1 px-5 pb-5 md:px-6 lg:order-2 lg:col-span-3 lg:pb-6 lg:pl-0">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#eef3ec] lg:aspect-auto lg:h-full lg:min-h-[420px]">
              <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" viewBox="0 0 100 100">
                <rect fill="#eef3ec" height="100" width="100" x="0" y="0" />
                <path
                  d="M0 60 C 20 55, 35 72, 55 64 S 85 70, 100 58"
                  fill="none"
                  stroke="#bfdbfe"
                  strokeWidth="3"
                />
                <path
                  d="M10 0 L 18 100 M 48 0 L 52 100 M 80 0 L 76 100 M 0 30 L 100 26 M 0 82 L 100 86"
                  stroke="#ffffff"
                  strokeWidth="1.6"
                />
                <rect fill="#d9f99d" height="7" opacity=".8" rx="1" width="8" x="36" y="44" />
                <rect fill="#d9f99d" height="8" opacity=".8" rx="1" width="10" x="34" y="62" />
                <g>
                  {visibleDays.map((day) => {
                    const dayPts = points.filter(
                      (pt) => day.places.indexOf(pt.place) > -1,
                    );
                    if (dayPts.length < 2) return null;
                    return (
                      <polyline
                        key={`line-${day.dayIndex}`}
                        points={dayPts.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                        fill="none"
                        stroke={DAY_HEX[day.dayIndex % 5]}
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                        strokeDasharray="2.5 1.5"
                      />
                    );
                  })}
                  {points.map((pt, idx) => (
                    <g key={`marker-${pt.place.name}-${idx}`}>
                      <circle cx={pt.x} cy={pt.y} r="3.4" fill={pt.color} stroke="#fff" strokeWidth=".8" />
                      <text
                        x={pt.x}
                        y={pt.y + 1.3}
                        fontSize="3.4"
                        fontWeight="700"
                        fill="#fff"
                        textAnchor="middle"
                      >
                        {pt.order}
                      </text>
                      <text
                        x={pt.x}
                        y={pt.y - 4.8}
                        fontSize="2.8"
                        fill="#44403c"
                        textAnchor="middle"
                        stroke="#fff"
                        strokeWidth=".7"
                        paintOrder="stroke"
                      >
                        {pt.place.name}
                      </text>
                    </g>
                  ))}
                </g>
              </svg>
              <div className="absolute bottom-3 left-3 rounded bg-white/80 px-2 py-1 text-[10px] text-stone-500">
                {M.mapNote}
              </div>
              <div className="absolute right-3 top-3 flex flex-col gap-1">
                <button
                  type="button"
                  aria-label={M.zoomIn}
                  className="h-8 w-8 rounded-lg bg-white text-stone-600 shadow"
                >
                  +
                </button>
                <button
                  type="button"
                  aria-label={M.zoomOut}
                  className="h-8 w-8 rounded-lg bg-white text-stone-600 shadow"
                >
                  −
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50 px-5 py-3 text-xs text-stone-500 md:px-6">
          <span>
            {totalKm > 0
              ? M.total(totalKm.toFixed(1), fmtMin(totalKm, transport))
              : M.totalPlaces(totalPlaces)}
          </span>
          <span>
            {M.generatedAt} {fmtDateTime(createdAt).slice(0, 10)}
          </span>
        </div>
      </section>

      {/* 截图模式提示 */}
      {shot ? (
        <div className="mt-4 text-center">
          <p className="text-sm text-stone-500">{M.shotTip}</p>
          <button
            type="button"
            onClick={() => setShot(false)}
            className="mt-3 h-10 rounded-lg bg-stone-900 px-5 text-sm text-white"
          >
            {M.exitShotMode}
          </button>
        </div>
      ) : null}
    </>
  );
}
