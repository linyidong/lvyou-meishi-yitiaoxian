'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bookmark,
  BookmarkMinus,
  Building2,
  Camera,
  ChevronDown,
  FilterX,
  Info,
  MapPin,
  MapPinPlus,
  Search,
  Share2,
  Sparkles,
  Utensils,
  X,
} from 'lucide-react';
import { EVENT_NAME, IMPORT_SOURCE_LABEL, PLACE_TYPE, PLACE_TYPE_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { trackEvent } from '@/lib/events';
import type { ImportSource, PlaceType } from '@/types';

const M = MESSAGES.COLLECTED;

/** U11 列表项（服务端查好后传入，避免客户端多次请求） */
export interface CollectedItem {
  id: string;
  name: string;
  type: PlaceType;
  cityName: string | null;
  address: string | null;
  source: ImportSource | null;
  note: string | null;
  createdAt: string;
}

/** 「加入路线」弹层可选的路线 */
export interface RouteOption {
  id: string;
  title: string;
  cityName: string | null;
  days: number;
}

type Filter = 'all' | PlaceType;
type Toast = { text: string; tone: 'ok' | 'info' | 'err' };

/** YYYY-MM-DD HH:mm */
function fmtTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function CollectedClient({
  items,
  routes,
  usedPlaceIds,
}: {
  items: CollectedItem[];
  routes: RouteOption[];
  /** 已出现在某条路线中的 place_id，用于卡片上显示「已在路线中」 */
  usedPlaceIds: string[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [keyword, setKeyword] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<CollectedItem | null>(null);
  /** 已收起的城市分组（默认全部展开），key 为城市名 */
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const usedSet = useMemo(() => new Set(usedPlaceIds), [usedPlaceIds]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return items.filter((it) => {
      if (filter !== 'all' && it.type !== filter) return false;
      if (!kw) return true;
      return [it.name, it.cityName, it.address, it.note].some((v) =>
        String(v ?? '')
          .toLowerCase()
          .includes(kw),
      );
    });
  }, [items, filter, keyword]);

  /**
   * 按城市分组：收藏地点先按城市归堆，点城市名可折叠 / 展开。
   * 排序规则：收藏多的城市在前；「未指定城市」永远排最后。
   */
  const groups = useMemo(() => {
    const map = new Map<string, CollectedItem[]>();
    for (const it of filtered) {
      const key = it.cityName ?? M.noCity;
      map.set(key, [...(map.get(key) ?? []), it]);
    }
    return [...map.entries()]
      .map(([city, list]) => ({ city, list }))
      .sort((a, b) => {
        const aNone = a.city === M.noCity ? 1 : 0;
        const bNone = b.city === M.noCity ? 1 : 0;
        if (aNone !== bNone) return aNone - bNone;
        if (a.list.length !== b.list.length) return b.list.length - a.list.length;
        return a.city.localeCompare(b.city, 'zh-Hans-CN');
      });
  }, [filtered]);

  function toggleGroup(city: string) {
    setCollapsed((prev) => ({ ...prev, [city]: !prev[city] }));
  }

  const spotCount = items.filter((it) => it.type === PLACE_TYPE.ATTRACTION).length;
  const foodCount = items.filter((it) => it.type === PLACE_TYPE.FOOD).length;

  function showToast(text: string, tone: Toast['tone'] = 'info') {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 2600);
  }

  async function removeOne(item: CollectedItem) {
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/collected?placeId=${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        showToast(M.toastRemoveFail, 'err');
        return;
      }
      await trackEvent(EVENT_NAME.COLLECT_REMOVE, { name: item.name });
      showToast(M.toastRemoved(item.name), 'ok');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function addToRoute(routeId: string) {
    if (!pending) return;
    setBusyId(pending.id);
    try {
      const res = await fetch('/api/collected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: pending.id, routeId }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        showToast(data.message ?? M.toastAddFail, 'err');
        return;
      }
      await trackEvent(EVENT_NAME.COLLECT_ADD_ROUTE, {
        name: pending.name,
        routeId,
      });
      showToast(M.toastAdded(pending.name), 'ok');
      setPending(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const tabCls = (on: boolean) =>
    on ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600';

  return (
    <>
      {/* 筛选 + 搜索 */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex w-full rounded-xl bg-stone-100 p-1 lg:w-fit">
            {(
              [
                ['all', M.filterAll],
                [PLACE_TYPE.ATTRACTION, PLACE_TYPE_LABEL[PLACE_TYPE.ATTRACTION]],
                [PLACE_TYPE.FOOD, PLACE_TYPE_LABEL[PLACE_TYPE.FOOD]],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold lg:flex-none ${tabCls(
                  filter === value,
                )}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={M.searchPlaceholder}
              className="h-11 w-full rounded-xl border border-stone-300 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <Link
            href={`${ROUTES.HOME}#importCollect`}
            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-5 text-sm font-semibold text-white hover:brightness-110"
          >
            <Sparkles className="h-4 w-4" />
            {M.importBtn}
          </Link>
        </div>

        <p className="mt-3 text-xs text-stone-500">
          {M.sum(items.length, spotCount, foodCount)}
          <span className="ml-3 text-stone-400">{M.groupHint}</span>
        </p>
      </div>

      {/* 列表 */}
      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/5 text-primary">
            <Bookmark className="h-8 w-8" />
          </span>
          <p className="mt-4 font-semibold text-stone-900">{M.emptyTitle}</p>
          <p className="mt-1 text-sm text-stone-500">{M.emptyDesc}</p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={`${ROUTES.HOME}#importCollect`}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-6 font-semibold text-white hover:brightness-110"
            >
              <Sparkles className="h-4 w-4" />
              {M.emptyImport}
            </Link>
            <Link
              href={ROUTES.ROUTE_NEW}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-stone-300 px-6 font-medium hover:bg-stone-50"
            >
              <MapPinPlus className="h-4 w-4" />
              {M.emptyNewRoute}
            </Link>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
          <FilterX className="mx-auto h-[34px] w-[34px] text-stone-300" />
          <p className="mt-2 font-semibold text-stone-800">{M.emptyFilterTitle}</p>
          <p className="mt-1 text-sm text-stone-500">{M.emptyFilterDesc}</p>
          <button
            type="button"
            onClick={() => {
              setFilter('all');
              setKeyword('');
            }}
            className="mt-4 h-10 rounded-xl border border-stone-300 px-5 text-sm font-medium hover:bg-stone-50"
          >
            {M.resetFilter}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {groups.map(({ city, list }) => {
            const isCollapsed = collapsed[city] ?? false;
            return (
              <section
                key={city}
                className="overflow-hidden rounded-2xl border border-stone-200 bg-white"
              >
                {/* 城市标题：点击折叠 / 展开 */}
                <button
                  type="button"
                  onClick={() => toggleGroup(city)}
                  aria-expanded={!isCollapsed}
                  aria-label={M.groupToggleAria(city, !isCollapsed)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-stone-50"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/5 text-primary">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <span className="font-semibold text-stone-900">{city}</span>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">
                    {M.groupCount(list.length)}
                  </span>
                  <ChevronDown
                    className={`ml-auto h-4 w-4 shrink-0 text-stone-400 transition-transform ${
                      isCollapsed ? '-rotate-90' : ''
                    }`}
                  />
                </button>

                {isCollapsed ? null : (
                  <div className="grid gap-3 border-t border-stone-100 p-4 md:grid-cols-2">
                    {list.map((it) => (
                      <CollectedCard
                        key={it.id}
                        item={it}
                        inRoute={usedSet.has(it.id)}
                        busy={busyId === it.id}
                        onAdd={() => setPending(it)}
                        onRemove={() => removeOne(it)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* 加入路线弹层 */}
      {pending ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/5 text-primary">
                <MapPinPlus className="h-5 w-5" />
              </span>
              <h2 className="font-bold text-stone-900">{M.modalTitle}</h2>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => setPending(null)}
                className="ml-auto grid h-8 w-8 place-items-center rounded-lg hover:bg-stone-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 text-sm text-stone-600">{M.modalDesc(pending.name)}</p>
            {routes.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">{M.modalNoRoutes}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {routes.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      disabled={busyId === pending.id}
                      onClick={() => addToRoute(r.id)}
                      className="flex w-full items-center justify-between rounded-xl border border-stone-200 px-4 py-3 text-left text-sm hover:bg-stone-50 disabled:opacity-50"
                    >
                      <span className="font-medium">{r.title}</span>
                      <span className="text-xs text-stone-500">
                        {r.cityName ?? M.noCity} · {r.days} 天
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                disabled={busyId === pending.id}
                onClick={() => setPending(null)}
                className="h-11 flex-1 rounded-xl border border-stone-300 font-medium hover:bg-stone-50 disabled:opacity-50"
              >
                {M.modalCancel}
              </button>
              {routes.length === 0 ? (
                <Link
                  href={ROUTES.ROUTE_NEW}
                  className="flex h-11 flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-primary-from to-primary-to font-semibold text-white hover:brightness-110"
                >
                  {M.modalGoNewRoute}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* 轻提示 */}
      {toast ? (
        <div
          className={`fixed left-1/2 top-20 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-white shadow-lg ${
            toast.tone === 'ok' ? 'bg-emerald-600' : toast.tone === 'err' ? 'bg-red-600' : 'bg-stone-800'
          }`}
        >
          <Info className="h-4 w-4" />
          {toast.text}
        </div>
      ) : null}
    </>
  );
}

/** U11 收藏地点卡片（按城市分组后由分组渲染） */
function CollectedCard({
  item,
  inRoute,
  busy,
  onAdd,
  onRemove,
}: {
  item: CollectedItem;
  /** 该地点已出现在某条路线中 */
  inRoute: boolean;
  busy: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const isFood = item.type === PLACE_TYPE.FOOD;
  return (
    <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
            isFood ? 'bg-amber-50 text-amber-600' : 'bg-teal-50 text-teal-600'
          }`}
        >
          {isFood ? (
            <Utensils className="h-[22px] w-[22px]" />
          ) : (
            <Camera className="h-[22px] w-[22px]" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-stone-900">{item.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                isFood ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700'
              }`}
            >
              {PLACE_TYPE_LABEL[item.type]}
            </span>
            {inRoute ? (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">
                {M.inRoute}
              </span>
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
            <span className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              {item.cityName ?? M.noCity}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {item.address ?? M.noAddress}
            </span>
            <span className="flex items-center gap-1">
              <Share2 className="h-3.5 w-3.5" />
              {item.source ? IMPORT_SOURCE_LABEL[item.source] : M.manualSource}
            </span>
          </p>
          <p className="mt-1 text-xs text-stone-400">
            {M.note(item.note ?? M.noteEmpty, fmtTime(item.createdAt))}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onAdd}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-4 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          <MapPinPlus className="h-4 w-4" />
          {M.addToRoute}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRemove}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-stone-300 px-4 text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
        >
          <BookmarkMinus className="h-4 w-4" />
          {M.remove}
        </button>
      </div>
    </div>
  );
}
