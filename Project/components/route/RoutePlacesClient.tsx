'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { PLACE_TYPE, PLACE_TYPE_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { buildRouteOrder } from '@/lib/route-order';
import type { PlaceType } from '@/types';

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
type Notice = { text: string; tone: 'ok' | 'err' };

const cardCls = 'rounded-2xl border border-border bg-background p-5';
const tabCls = (on: boolean) =>
  `flex-1 rounded-lg px-3 py-2 text-sm font-medium ${on ? 'bg-background shadow-sm' : 'text-muted-foreground'}`;
const typeBadgeCls = (type: PlaceType) =>
  `rounded-full px-2 py-0.5 text-[11px] ${
    type === PLACE_TYPE.FOOD ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700'
  }`;

/**
 * U07 勾选地点：勾选后按最近邻排序并均匀分配到每天，写库后进入 U08 编辑页。
 */
export function RoutePlacesClient({
  routeId,
  cityName,
  days,
  transportLabel,
  places,
  initialCheckedIds,
}: {
  routeId: string;
  cityName: string | null;
  days: number;
  transportLabel: string;
  places: RoutePlaceOption[];
  /** 已在当前路线中的 place_id，作为默认勾选 */
  initialCheckedIds: string[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<PlaceTab>('all');
  const [checked, setChecked] = useState<Set<string>>(() => new Set(initialCheckedIds));
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const visible = useMemo(
    () => places.filter((p) => (tab === 'all' ? true : p.type === tab)),
    [places, tab],
  );

  const selected = useMemo(() => places.filter((p) => checked.has(p.id)), [places, checked]);
  const checkedSpots = selected.filter((p) => p.type === PLACE_TYPE.ATTRACTION).length;
  const checkedFoods = selected.filter((p) => p.type === PLACE_TYPE.FOOD).length;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setNotice(null);
  }

  function selectAllVisible(on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      visible.forEach((p) => (on ? next.add(p.id) : next.delete(p.id)));
      return next;
    });
    setNotice(null);
  }

  async function generate() {
    if (selected.length < 2) {
      setNotice({ text: MESSAGES.ROUTE_MIN_PLACES, tone: 'err' });
      return;
    }
    if (selected.length > BUSINESS.MAX_PLACES_PER_ROUTE) {
      setNotice({ text: MESSAGES.ROUTE_PLACES_LIMIT_EXCEEDED, tone: 'err' });
      return;
    }
    const capacity = days === 1 ? BUSINESS.MAX_PLACES_PER_DAY : days * BUSINESS.MAX_PLACES_PER_DAY;
    if (selected.length > capacity) {
      setNotice({ text: MESSAGES.ROUTE_DAY_LIMIT_EXCEEDED, tone: 'err' });
      return;
    }

    setNotice(null);
    setGenerating(true);
    try {
      const items = buildRouteOrder(
        selected.map((p) => ({ placeId: p.id, lat: p.lat, lng: p.lng })),
        days,
      );
      const res = await fetch(`/api/routes/${routeId}/places`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setNotice({ text: data.message ?? MESSAGES.ROUTE_FAILED, tone: 'err' });
        return;
      }
      router.push(ROUTES.ROUTE_EDIT(routeId));
    } catch {
      setNotice({ text: MESSAGES.NETWORK_ERROR, tone: 'err' });
    } finally {
      setGenerating(false);
    }
  }

  if (places.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold">{cityName ?? '未指定城市'} · 已导入地点</h1>
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-background p-10 text-center">
          <p className="font-semibold">还没有导入任何地点</p>
          <p className="mt-1 text-sm text-muted-foreground">先粘贴分享文案或手动输入地点，再回到这里勾选。</p>
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

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{cityName ?? '未指定城市'} · 已导入地点</h1>
          <p className="mt-1 text-sm text-muted-foreground">勾选这次想去的地点，系统会按顺路顺序排好。</p>
        </div>
        <Link
          href={ROUTES.ROUTE_ADD(routeId)}
          className="flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted"
        >
          继续导入 / 添加
        </Link>
      </div>

      {notice ? (
        <p
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            notice.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
        <section className={cardCls}>
          <div className="flex rounded-xl bg-muted p-1">
            {(
              [
                ['all', '全部'],
                [PLACE_TYPE.ATTRACTION, PLACE_TYPE_LABEL[PLACE_TYPE.ATTRACTION]],
                [PLACE_TYPE.FOOD, PLACE_TYPE_LABEL[PLACE_TYPE.FOOD]],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setTab(value)} className={tabCls(tab === value)}>
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              共 {places.length} 个地点，已勾选 {selected.length} 个（景点 {checkedSpots} · 美食 {checkedFoods}）
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => selectAllVisible(true)}
                className="h-8 rounded-lg border border-border px-3 text-xs hover:bg-muted"
              >
                全选
              </button>
              <button
                type="button"
                onClick={() => selectAllVisible(false)}
                className="h-8 rounded-lg border border-border px-3 text-xs hover:bg-muted"
              >
                全不选
              </button>
            </div>
          </div>

          <ul className="mt-3 space-y-2">
            {visible.map((p) => {
              const on = checked.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${
                      on ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
                    }`}
                  >
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${
                        on ? 'border-primary bg-primary text-white' : 'border-border'
                      }`}
                    >
                      {on ? <Check className="h-3.5 w-3.5" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">{p.name}</span>
                        <span className={typeBadgeCls(p.type)}>{PLACE_TYPE_LABEL[p.type]}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {p.address ?? '待定位'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="space-y-5">
          <section className={cardCls}>
            <h2 className="text-sm font-semibold">路线设置</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">行程天数</dt>
                <dd className="font-medium">{days} 天</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">市内交通</dt>
                <dd className="font-medium">{transportLabel}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              天数和交通方式为只读展示，修改请到路线编辑页。
            </p>
            <Link
              href={ROUTES.ROUTE_EDIT(routeId)}
              className="mt-3 inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs hover:bg-muted"
            >
              去改路线设置
            </Link>

            <button
              type="button"
              disabled={generating || selected.length < 2}
              onClick={generate}
              className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              用 {selected.length} 个地点生成路线
            </button>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs text-amber-800">
            <p className="font-semibold">生成规则</p>
            <p className="mt-2">
              多日先按距离聚类，再均匀分配到每天；每天独立排顺序，不做时间优化。
            </p>
            <p className="mt-2">
              单日最多 {BUSINESS.MAX_PLACES_PER_DAY} 个地点，单条路线最多 {BUSINESS.MAX_PLACES_PER_ROUTE} 个地点。
            </p>
          </section>
        </aside>
      </div>

      {generating ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="rounded-2xl bg-background px-6 py-5 text-center">
            <p className="font-semibold">{MESSAGES.ROUTE_GENERATING}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              多日先按距离聚类，再均匀分配到每天
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
