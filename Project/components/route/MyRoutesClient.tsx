'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BedDouble, CloudOff, Footprints, Lock, Map, MapPin, MapPinPlus, Plus, Bike } from 'lucide-react';
import { TRANSPORT_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import type { Transport } from '@/types';

/** U03 卡片迷你路线图上的一个点（坐标为真实 lat/lng） */
export interface MyRoutePoint {
  /** 第几天（0 基） */
  day: number;
  lat: number;
  lng: number;
  /** 美食点与景点点用不同颜色 */
  food: boolean;
}

/** U03 路线卡片（服务端查好后传入） */
export interface MyRouteItem {
  id: string;
  title: string;
  cityName: string | null;
  days: number;
  /** 市内交通（决定卡片右上角图标） */
  transport: Transport;
  placeCount: number;
  /** 已勾选的美食地点数 */
  foodCount: number;
  createdAt: string;
  /** 出发城市，未填写时为 null */
  originCity: string | null;
  /** 住宿类型文案，未填写时为 null */
  lodgingLabel: string | null;
  lodgingNights: number | null;
  /** 迷你路线图坐标点，无坐标地点不参与 */
  points: MyRoutePoint[];
}

/** 按天配色（与原型一致的 5 色循环；第 1 天用主色起点色） */
const MAP_DAY_STROKES = [
  PRODUCT.COLOR_PRIMARY_FROM,
  '#0d9488',
  '#d97706',
  '#4f46e5',
  '#0284c7',
];

/** YYYY-MM-DD HH:mm */
function fmtTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 原型卡片头部的示意地图：真实坐标归一化到 100×70 画布，按天画虚线折线 */
function MiniMap({ points }: { points: MyRoutePoint[] }) {
  if (points.length === 0) return null;

  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const spanLng = maxLng - minLng || 1;
  const spanLat = maxLat - minLat || 1;
  const x = (lng: number) => 6 + ((lng - minLng) / spanLng) * 88;
  const y = (lat: number) => 62 - ((lat - minLat) / spanLat) * 50;

  const days = Array.from(new Set(points.map((p) => p.day))).sort((a, b) => a - b);

  return (
    <svg viewBox="0 0 100 70" className="h-full w-full">
      {days.map((day) => {
        const pts = points.filter((p) => p.day === day).map((p) => `${x(p.lng)},${y(p.lat)}`).join(' ');
        return (
          <polyline
            key={day}
            points={pts}
            fill="none"
            stroke={MAP_DAY_STROKES[day % MAP_DAY_STROKES.length]}
            strokeWidth={1.4}
            strokeDasharray="3 2"
          />
        );
      })}
      {points.map((p, i) => (
        <circle
          key={`${p.day}-${i}`}
          cx={x(p.lng)}
          cy={y(p.lat)}
          r={2.2}
          fill={p.food ? '#f59e0b' : '#14b8a6'}
          stroke="#fff"
          strokeWidth={0.6}
        />
      ))}
    </svg>
  );
}

/** U03 我的路线：只读列表 + 城市筛选 + 空态 / 失败重试 / 无权限，路线仅自己可见 */
export function MyRoutesClient({
  routes,
  error = false,
  denied = false,
}: {
  routes: MyRouteItem[];
  /** 服务端查询失败 */
  error?: boolean;
  /** 未登录兜底 */
  denied?: boolean;
}) {
  const M = MESSAGES.MY_ROUTES;
  const router = useRouter();
  const [city, setCity] = useState<string>(M.all);

  const cityTabs = useMemo(() => {
    const set = new Set<string>();
    for (const r of routes) {
      if (r.cityName) set.add(r.cityName);
    }
    return [M.all, ...Array.from(set)];
  }, [routes, M.all]);

  const filtered = useMemo(
    () => (city === M.all ? routes : routes.filter((r) => r.cityName === city)),
    [routes, city, M.all],
  );

  return (
    <>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 md:text-3xl">{M.title}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {denied || error ? M.headDesc : M.subtitle(routes.length)}
          </p>
        </div>
        <Link
          href={ROUTES.CITY}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-5 font-semibold text-white hover:brightness-110 md:w-auto"
        >
          <Plus className="h-4 w-4" />
          {M.create}
        </Link>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 py-16 text-center">
          <CloudOff className="mx-auto h-12 w-12 text-red-400" />
          <p className="mt-3 font-semibold text-red-700">{M.errorTitle}</p>
          <p className="mt-1 text-sm text-red-600">{M.errorDesc}</p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-4 h-10 rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-5 text-sm font-semibold text-white hover:brightness-110"
          >
            {M.retry}
          </button>
        </div>
      ) : denied ? (
        <div className="mt-6 rounded-2xl border border-stone-200 bg-white py-16 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-stone-100 text-stone-500">
            <Lock className="h-[34px] w-[34px]" />
          </span>
          <p className="mt-4 font-semibold">{M.deniedTitle}</p>
          <p className="mt-1 text-sm text-stone-500">{M.deniedDesc}</p>
          <div className="mt-5 flex flex-col justify-center gap-3 px-6 sm:flex-row">
            <Link
              href={`${ROUTES.LOGIN}?redirect=${ROUTES.MY_ROUTES}`}
              className="flex h-10 items-center justify-center rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-5 text-sm font-semibold text-white hover:brightness-110"
            >
              {M.login}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {cityTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCity(tab)}
                className={cn(
                  'h-9 shrink-0 rounded-full px-4 text-sm',
                  city === tab
                    ? 'bg-stone-900 text-white'
                    : 'border border-stone-200 bg-white text-stone-600',
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => {
              const TransportIcon = r.transport === 'bike' ? Bike : Footprints;
              return (
                <article
                  key={r.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white"
                >
                  <div
                    className="relative h-36 bg-teal-50"
                    style={{
                      backgroundImage:
                        'linear-gradient(#ccfbf1 1px,transparent 1px),linear-gradient(90deg,#ccfbf1 1px,transparent 1px)',
                      backgroundSize: '16px 16px',
                    }}
                  >
                    <MiniMap points={r.points} />
                    <span className="absolute left-3 top-3 rounded-lg bg-white/90 px-2 py-1 text-xs font-medium">
                      {r.cityName ?? MESSAGES.UNSPECIFIED_CITY}
                    </span>
                    <span className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-stone-900 px-2 py-1 text-xs text-white">
                      <TransportIcon className="h-4 w-4" />
                      {TRANSPORT_LABEL[r.transport]}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="font-semibold text-stone-900">{r.title}</h3>
                    <p className="mt-1 text-xs text-stone-500">
                      {M.meta(r.days, r.placeCount, r.foodCount, fmtTime(r.createdAt))}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-primary" />
                        {r.originCity ? M.originFrom(r.originCity) : M.originPending}
                      </span>
                      {r.lodgingLabel ? (
                        <span className="inline-flex items-center gap-1">
                          <BedDouble className="h-4 w-4 text-violet-500" />
                          {M.lodging(r.lodgingLabel, r.lodgingNights)}
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                      <Link
                        href={ROUTES.ROUTE_DETAIL(r.id)}
                        className="flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-primary-from to-primary-to text-sm font-medium text-white hover:brightness-110"
                      >
                        {M.view}
                      </Link>
                      <Link
                        href={ROUTES.ROUTE_EDIT(r.id)}
                        className="flex h-9 items-center justify-center rounded-lg border border-stone-300 text-sm hover:bg-stone-50"
                      >
                        {M.edit}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs text-stone-400">{M.footnote}</p>

          {filtered.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/5 text-primary">
                <Map className="h-[34px] w-[34px]" />
              </span>
              <p className="mt-4 font-semibold">{M.emptyTitle}</p>
              <p className="mt-1 text-sm text-stone-500">{M.emptyDesc}</p>
              <Link
                href={ROUTES.CITY}
                className="mt-5 inline-flex h-10 items-center gap-1 rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-5 text-sm font-semibold text-white hover:brightness-110"
              >
                <MapPinPlus className="h-4 w-4" />
                {M.emptyCta}
              </Link>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
