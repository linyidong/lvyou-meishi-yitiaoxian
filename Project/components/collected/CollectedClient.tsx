'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X } from 'lucide-react';
import { EVENT_NAME, IMPORT_SOURCE_LABEL, PLACE_TYPE, PLACE_TYPE_LABEL } from '@/config/enums';
import { ROUTES } from '@/config/routes';
import { trackEvent } from '@/lib/events';
import type { ImportSource, PlaceType } from '@/types';

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
        showToast('移除失败，请重试', 'err');
        return;
      }
      await trackEvent(EVENT_NAME.COLLECT_REMOVE, { name: item.name });
      showToast(`已移除收藏「${item.name}」`, 'ok');
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
        showToast(data.message ?? '加入失败，请重试', 'err');
        return;
      }
      await trackEvent(EVENT_NAME.COLLECT_ADD_ROUTE, {
        name: pending.name,
        routeId,
      });
      showToast(`「${pending.name}」已加入路线，可在勾选地点里确认`, 'ok');
      setPending(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const tabCls = (on: boolean) =>
    on
      ? 'bg-background text-foreground shadow-sm'
      : 'text-muted-foreground';

  return (
    <>
      {/* 筛选 + 搜索 */}
      <div className="rounded-2xl border border-border bg-background p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex w-full rounded-xl bg-muted p-1 lg:w-fit">
            {(
              [
                ['all', '全部'],
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

          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索名称、城市、地址或备注"
            className="h-11 flex-1 rounded-xl border border-border px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />

          <Link
            href={ROUTES.HOME}
            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-5 text-sm font-semibold text-white hover:brightness-110"
          >
            导入文案收藏
          </Link>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          共 {items.length} 个收藏 · 景点 {spotCount} · 美食 {foodCount}
        </p>
      </div>

      {/* 列表 */}
      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-background p-10 text-center">
          <p className="font-semibold">还没有收藏地点，先去导入文案</p>
          <p className="mt-1 text-sm text-muted-foreground">
            粘贴小红书 / 抖音的分享文案，AI 提取地点后就能存进收藏库，暂时不用建路线。
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={ROUTES.HOME}
              className="flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-6 font-semibold text-white hover:brightness-110"
            >
              去导入文案
            </Link>
            <Link
              href={ROUTES.ROUTE_NEW}
              className="flex h-11 items-center justify-center rounded-xl border border-border px-6 font-medium hover:bg-muted"
            >
              直接新建路线
            </Link>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-background p-8 text-center">
          <p className="font-semibold">没有符合条件的地点</p>
          <p className="mt-1 text-sm text-muted-foreground">换个关键词，或切回「全部」看看。</p>
          <button
            type="button"
            onClick={() => {
              setFilter('all');
              setKeyword('');
            }}
            className="mt-4 h-10 rounded-xl border border-border px-5 text-sm font-medium hover:bg-muted"
          >
            重置筛选
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {filtered.map((it) => {
            const isFood = it.type === PLACE_TYPE.FOOD;
            const inRoute = usedSet.has(it.id);
            return (
              <div key={it.id} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg ${
                      isFood ? 'bg-amber-50 text-amber-600' : 'bg-teal-50 text-teal-600'
                    }`}
                  >
                    {isFood ? '🍜' : '📷'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{it.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          isFood ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700'
                        }`}
                      >
                        {PLACE_TYPE_LABEL[it.type]}
                      </span>
                      {inRoute ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          已在路线中
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{it.cityName ?? '未指定城市'}</span>
                      <span>{it.address ?? '待定位'}</span>
                      <span>{it.source ? IMPORT_SOURCE_LABEL[it.source] : '手动添加'}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/80">
                      备注：{it.note ?? '—'} · 收藏于 {fmtTime(it.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === it.id}
                    onClick={() => setPending(it)}
                    className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50"
                  >
                    {inRoute ? '再加入其他路线' : '加入路线'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === it.id}
                    onClick={() => removeOne(it)}
                    className="h-9 rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    移除收藏
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 加入路线弹层 */}
      {pending ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-background p-5">
            <div className="flex items-center gap-2">
              <h2 className="font-bold">把「{pending.name}」加入哪条路线？</h2>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => setPending(null)}
                className="ml-auto grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {routes.length === 0 ? (
              <div className="mt-4 text-sm text-muted-foreground">
                <p>你还没有路线。需要先去选城市并新建路线，再把收藏的地点加入。</p>
                <Link
                  href={ROUTES.ROUTE_NEW}
                  className="mt-4 flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-primary-from to-primary-to font-semibold text-white hover:brightness-110"
                >
                  去新建路线
                </Link>
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {routes.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      disabled={busyId === pending.id}
                      onClick={() => addToRoute(r.id)}
                      className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left text-sm hover:bg-muted disabled:opacity-50"
                    >
                      <span className="font-medium">{r.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.cityName ?? '未指定城市'} · {r.days} 天
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {/* 轻提示 */}
      {toast ? (
        <div
          className={`fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm text-white shadow-lg ${
            toast.tone === 'ok' ? 'bg-emerald-600' : toast.tone === 'err' ? 'bg-red-600' : 'bg-foreground'
          }`}
        >
          {toast.text}
        </div>
      ) : null}
    </>
  );
}
