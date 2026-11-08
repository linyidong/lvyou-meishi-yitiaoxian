'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BedDouble,
  Bike,
  Bus,
  Car,
  CircleAlert,
  CloudOff,
  Footprints,
  Lock,
  Map,
  MapPin,
  MapPinPlus,
  Plus,
  RouteOff,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { cityLabel } from '@/config/cities';
import { TRANSPORT, TRANSPORT_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { ROUTES } from '@/config/routes';
import { AmapMap, type AmapLine } from '@/components/map/AmapMap';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
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
  /** T-041 分享导入来源 token；非空 = 由会员分享路线导入，归入「会员分享路线」模块 */
  importedFrom?: string | null;
}

/** 按天配色（与原型一致的 5 色循环；第 1 天用主色起点色） */
const MAP_DAY_STROKES = [
  PRODUCT.COLOR_PRIMARY_FROM,
  '#0d9488',
  '#d97706',
  '#4f46e5',
  '#0284c7',
];

/** 市内交通各方式的图标（与 TRANSPORT 取值一一对应） */
const TRANSPORT_ICON: Record<Transport, LucideIcon> = {
  [TRANSPORT.WALK]: Footprints,
  [TRANSPORT.BIKE]: Bike,
  [TRANSPORT.TRANSIT]: Bus,
  [TRANSPORT.DRIVE]: Car,
};

/** YYYY-MM-DD HH:mm */
function fmtTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 卡片头部的真实高德底图：坐标点按天拆成折线（颜色与原型一致），无坐标的点不参与 */
function toLines(points: MyRoutePoint[]): AmapLine[] {
  const days = Array.from(new Set(points.map((p) => p.day))).sort((a, b) => a - b);
  return days.flatMap((day) => {
    const path = points.filter((p) => p.day === day).map((p) => ({ lat: p.lat, lng: p.lng }));
    if (path.length < 2) return [];
    return [{ path, stroke: MAP_DAY_STROKES[day % MAP_DAY_STROKES.length] }];
  });
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
  /** T-067 删除交互：待确认的路线 id / 正在删除的路线 id / 失败提示（不静默） */
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  /** 已成功删除的 id：本地立即移除卡片，router.refresh() 兜底与服务端对齐 */
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const visible = useMemo(() => routes.filter((r) => !deletedIds.includes(r.id)), [routes, deletedIds]);

  const cityTabs = useMemo(() => {
    const set = new Set<string>();
    for (const r of visible) {
      if (r.cityName) set.add(r.cityName);
    }
    return [M.all, ...Array.from(set)];
  }, [visible, M.all]);

  /** T-067：删除某城市最后一条路线后，该 tab 会消失；用 activeCity 兜底回「全部」，避免列表空且无选中 tab */
  const activeCity = cityTabs.includes(city) ? city : M.all;

  const filtered = useMemo(
    () => (activeCity === M.all ? visible : visible.filter((r) => r.cityName === activeCity)),
    [visible, activeCity, M.all],
  );

  // T-041 拆两个模块：自建路线（importedFrom 为空）与由分享导入的路线（非空）
  const mine = useMemo(() => filtered.filter((r) => !r.importedFrom), [filtered]);
  const shared = useMemo(() => filtered.filter((r) => r.importedFrom), [filtered]);

  /** T-067 待删除的路线（仅用于确认框展示名称） */
  const confirmTarget = visible.find((r) => r.id === confirmId) ?? null;

  /**
   * T-067 二次确认后硬删除本人路线（DELETE /api/routes/[id]，数据库真删、级联清 route_places/route_shares）：
   * 成功 → 本地立即移除卡片 + router.refresh() 兜底；失败 → 页面顶部可见错误提示，绝不静默。
   */
  async function confirmDelete() {
    if (!confirmTarget || deletingId) return;
    const id = confirmTarget.id;
    setDeletingId(id);
    setDeleteError('');
    try {
      const res = await fetch(`/api/routes/${id}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!res.ok || !data?.ok) {
        setConfirmId(null);
        setDeleteError(data?.message ?? M.deleteFailed);
        return;
      }
      setConfirmId(null);
      setDeletedIds((prev) => [...prev, id]);
      router.refresh();
    } catch {
      setConfirmId(null);
      setDeleteError(M.deleteFailed);
    } finally {
      setDeletingId(null);
    }
  }

  const renderCard = (r: MyRouteItem) => {
    const TransportIcon = TRANSPORT_ICON[r.transport];
    return (
      <article
        key={r.id}
        className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white"
      >
        <div
          className="relative h-36 bg-teal-50"
          style={{
            backgroundImage:
              'linear-gradient(#ccfbf1 1px,transparent 1px),linear-gradient(90deg,#ccfbf1 1px,transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        >
          {r.placeCount === 0 ? (
            /* T-067 空路线缩略图：不再渲染高德空网格，改为明确空态（高度与有地图时一致） */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-stone-50 px-3 text-center">
              <RouteOff className="h-7 w-7 text-stone-400" />
              <p className="text-sm font-semibold text-stone-600">{M.emptyThumbTitle}</p>
              <p className="text-xs text-stone-500">{M.emptyThumbHint}</p>
            </div>
          ) : (
            <AmapMap
              className="absolute inset-0"
              points={r.points.map((p) => ({ lat: p.lat, lng: p.lng, food: p.food }))}
              lines={toLines(r.points)}
            />
          )}
          <span className="absolute left-3 top-3 rounded-lg bg-white/90 px-2 py-1 text-xs font-medium">
            {r.cityName ? cityLabel(r.cityName) : MESSAGES.UNSPECIFIED_CITY}
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
          {/* T-067 删除入口：操作按钮下方右对齐，红色弱化描边，触控高度 40px */}
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setDeleteError('');
                setConfirmId(r.id);
              }}
              disabled={deletingId === r.id}
              className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-red-200 px-4 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {deletingId === r.id ? M.deleting : M.delete}
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 md:text-3xl">{M.title}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {denied || error ? M.headDesc : M.subtitle(visible.length)}
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

      {/* T-067 删除失败提示：页面顶部可见横幅，不静默 */}
      {deleteError ? (
        <div
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
        >
          <CircleAlert className="h-4 w-4 shrink-0" />
          <span>{deleteError}</span>
        </div>
      ) : null}

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
                  activeCity === tab
                    ? 'bg-stone-900 text-white'
                    : 'border border-stone-200 bg-white text-stone-600',
                )}
              >
                {tab === M.all ? tab : cityLabel(tab)}
              </button>
            ))}
          </div>

          {/* T-041 「我的路线」模块：自建路线 */}
          {mine.length > 0 ? (
            <section className="mt-4">
              <h2 className="text-lg font-bold text-stone-900">{M.sectionMine}</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{mine.map(renderCard)}</div>
            </section>
          ) : null}

          {/* T-041 「会员分享路线」模块：由分享导入的路线，无数据时不显示 */}
          {shared.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-lg font-bold text-stone-900">{M.sectionShared}</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shared.map(renderCard)}</div>
            </section>
          ) : null}

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

      {/* T-067 删除二次确认：取消不发请求；确认才调 DELETE */}
      <ConfirmDialog
        open={!!confirmTarget}
        title={M.deleteTitle}
        description={confirmTarget ? M.deleteDesc(confirmTarget.title) : undefined}
        confirmText={M.deleteConfirm}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setConfirmId(null)}
      />
    </>
  );
}
