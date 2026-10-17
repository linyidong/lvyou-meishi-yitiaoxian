'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { PLACE_TYPE, PLACE_TYPE_LABEL } from '@/config/enums';
import { ROUTES } from '@/config/routes';
import type { PlaceType } from '@/types';

export interface ResultPlace {
  name: string;
  type: PlaceType;
  address: string | null;
  note: string | null;
}

export interface ResultDay {
  /** 0 基天数下标 */
  dayIndex: number;
  places: ResultPlace[];
}

const cardCls = 'rounded-2xl border border-border bg-background p-5';
const typeBadgeCls = (type: PlaceType) =>
  `rounded-full px-2 py-0.5 text-[11px] ${
    type === PLACE_TYPE.FOOD ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700'
  }`;

/**
 * U09 路线结果：按天顺序列表展示。
 * 地图暂未实现，仅渲染说明块（不做伪造 SVG 地图）。
 */
export function RouteResultClient({
  routeId,
  title,
  cityName,
  days,
  transportLabel,
  originCity,
  intercityLabel,
  lodgingLabel,
  resultDays,
  totalPlaces,
}: {
  routeId: string;
  title: string;
  cityName: string | null;
  days: number;
  transportLabel: string;
  originCity: string | null;
  intercityLabel: string;
  lodgingLabel: string;
  resultDays: ResultDay[];
  totalPlaces: number;
}) {
  const [activeDay, setActiveDay] = useState(0);

  if (totalPlaces === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-background p-10 text-center">
          <p className="font-semibold">这条路线还没有地点</p>
          <p className="mt-1 text-sm text-muted-foreground">先导入地点并勾选生成，返回这里就能看到按天顺序。</p>
          <Link
            href={ROUTES.ROUTE_ADD(routeId)}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-6 font-semibold text-white hover:brightness-110"
          >
            去导入地点
          </Link>
        </div>
      </div>
    );
  }

  const currentPlaces = resultDays.find((d) => d.dayIndex === activeDay)?.places ?? [];

  return (
    <div className="space-y-5">
      {/* 顶部信息栏 */}
      <section className={cardCls}>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {cityName ?? '未指定城市'} · {days} 天 · 市内交通{transportLabel}
        </p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted px-4 py-3">
            <dt className="text-xs text-muted-foreground">出发城市</dt>
            <dd className="mt-0.5 text-sm font-medium">{originCity ?? '未填写'}</dd>
          </div>
          <div className="rounded-xl bg-muted px-4 py-3">
            <dt className="text-xs text-muted-foreground">城际交通 · 去程</dt>
            <dd className="mt-0.5 text-sm font-medium">{intercityLabel}</dd>
          </div>
          <div className="rounded-xl bg-muted px-4 py-3">
            <dt className="text-xs text-muted-foreground">终点住宿</dt>
            <dd className="mt-0.5 text-sm font-medium">{lodgingLabel}</dd>
          </div>
        </dl>
      </section>

      {/* 天切换 */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: days }, (_, i) => i).map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveDay(i)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              activeDay === i
                ? 'border-primary bg-primary/5 font-medium text-primary'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            第 {i + 1} 天
          </button>
        ))}
      </div>

      {/* 按天顺序列表 */}
      <section className={cardCls}>
        {currentPlaces.length === 0 ? (
          <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
            第 {activeDay + 1} 天还没有安排地点。
          </p>
        ) : (
          <ol className="space-y-3">
            {currentPlaces.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    <span className={typeBadgeCls(p.type)}>{PLACE_TYPE_LABEL[p.type]}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {p.address ?? '待定位'}
                  </p>
                  {p.note ? <p className="mt-1 text-xs text-muted-foreground">备注：{p.note}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-3 text-sm text-muted-foreground">
          <span>
            总地点数 <span className="font-semibold text-foreground">{totalPlaces}</span>
          </span>
          <span>
            天数 <span className="font-semibold text-foreground">{days}</span>
          </span>
        </div>
      </section>

      {/* 地图说明块：第一版不渲染地图 */}
      <section className="grid place-items-center rounded-2xl border border-dashed border-border bg-muted p-10 text-center">
        <p className="text-sm font-medium">地图渲染将在接入高德 JS API 后补充（待办）</p>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Link
          href={ROUTES.MY_ROUTES}
          className="flex h-11 items-center justify-center rounded-xl border border-border px-6 text-sm font-medium hover:bg-muted"
        >
          返回我的路线
        </Link>
        <Link
          href={ROUTES.ROUTE_EDIT(routeId)}
          className="flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-6 font-semibold text-white hover:brightness-110"
        >
          调整路线
        </Link>
      </div>

      <p className="text-xs text-muted-foreground">
        第一版以顺序列表展示，地图服务接口已就绪（/api/amap/route）。
      </p>
    </div>
  );
}
