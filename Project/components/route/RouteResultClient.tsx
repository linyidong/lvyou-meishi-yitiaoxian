'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft,
  BedDouble,
  Bike,
  Bus,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Footprints,
  Loader2,
  Lock,
  Map as MapIcon,
  MapPin,
  Navigation,
  Pencil,
  Route,
  Save,
  Smartphone,
  TrainFront,
  type LucideIcon,
} from 'lucide-react';
import { BUSINESS } from '@/config/business';
import {
  NAV_MODE,
  NAV_MODE_LABEL,
  NAV_MODE_VALUES,
  PLACE_TYPE,
  PLACE_TYPE_LABEL,
} from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { ROUTES } from '@/config/routes';
import { AmapMap, type AmapLandmark, type AmapLine, type AmapPoint } from '@/components/map/AmapMap';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { RouteShareButton } from '@/components/route/RouteShareButton';
import type { AMapInstance } from '@/lib/amap-loader';
import { cn } from '@/lib/utils';
import type { AmapLeg, LodgingCoords } from '@/lib/amap';
import { straightDist2 } from '@/lib/route-order';
import {
  buildAmapAppUri,
  detectAmapPlatform,
  type AmapNavPoint,
  type AmapPlatform,
} from '@/lib/amap-uri';
import type { NavMode, PlaceType, Transport } from '@/types';

export interface ResultPlace {
  /** places 主键，调整顺序后按它回写 route_places */
  id: string;
  name: string;
  type: PlaceType;
  address: string | null;
  note: string | null;
  lat: number | null;
  lng: number | null;
  /** 高德 POI 照片地址，空 = 用色块 + 首字代替 */
  imageUrl: string | null;
}

export interface ResultDay {
  /** 0 基天数下标 */
  dayIndex: number;
  places: ResultPlace[];
}

const M = MESSAGES.ROUTE_RESULT;

/** 原型按天轮换的线路颜色（DAY_HEX） */
const DAY_HEX = ['#e11d48', '#0d9488', '#d97706', '#4f46e5', '#0284c7'] as const;

/** 回住宿虚线的颜色：与地图上的住宿方标记同色，一眼能对上 */
const RETURN_LINE_HEX = '#7c3aed';
/** 回住宿默认方式：一天逛完多数人打车 / 坐公交地铁回去 */
const DEFAULT_RETURN_MODE = NAV_MODE.TRANSIT;

/** 每种出行方式对应的图标与直线估算速度（算不出真实路线时用它兜底） */
const MODE_ICON: Record<NavMode, LucideIcon> = {
  [NAV_MODE.WALK]: Footprints,
  [NAV_MODE.BIKE]: Bike,
  [NAV_MODE.TRANSIT]: Bus,
  [NAV_MODE.DRIVE]: Car,
};
const MODE_SPEED_KMH: Record<NavMode, number> = {
  [NAV_MODE.WALK]: BUSINESS.WALK_SPEED_KMH,
  [NAV_MODE.BIKE]: BUSINESS.BIKE_SPEED_KMH,
  [NAV_MODE.TRANSIT]: BUSINESS.TRANSIT_SPEED_KMH,
  [NAV_MODE.DRIVE]: BUSINESS.DRIVE_SPEED_KMH,
};

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

/** 一段路：公里 + 分钟；null = 缺坐标算不出来 */
interface LegInfo {
  km: number;
  min: number;
}

/**
 * 一天各段的距离与时间：有高德真实算路结果优先用真实值，
 * 没有（还没算 / 算不出）时用直线距离 × 该方式速度估算。
 * 返回数组下标 i 对应「第 i 个点 → 第 i+1 个点」。
 */
function dayLegInfos(day: ResultDay, legs: AmapLeg[] | undefined, mode: NavMode): (LegInfo | null)[] {
  const out: (LegInfo | null)[] = [];
  for (let i = 1; i < day.places.length; i += 1) {
    const real = legs?.[i - 1];
    if (real && real.distanceMeters > 0) {
      out.push({ km: real.distanceMeters / 1000, min: Math.round(real.durationSeconds / 60) });
      continue;
    }
    const km = legKm(day.places[i - 1], day.places[i]);
    out.push(km === null ? null : { km, min: Math.round((km / MODE_SPEED_KMH[mode]) * 60) });
  }
  return out;
}

/** 一天里带坐标的站点（序号为天内的顺序），无坐标的点不参与地图绘制 */
interface MapStation {
  lat: number;
  lng: number;
  order: number;
  dayIndex: number;
  place: ResultPlace;
}

/** 收集可见天里所有带坐标的站点（无坐标返回空） */
function collectStations(days: ResultDay[]): MapStation[] {
  return days.flatMap((day) =>
    day.places.flatMap((place, i) =>
      place.lat === null || place.lng === null
        ? []
        : [{ lat: place.lat, lng: place.lng, order: i + 1, dayIndex: day.dayIndex, place }],
    ),
  );
}

/** 一天的 'lng,lat' 数组；只要有一个点缺坐标就返回 null（无法参与算路与重排） */
function dayCoordPoints(day: ResultDay): string[] | null {
  return coordsOf(day.places);
}

/** 地点数组的 'lng,lat' 数组；有一点缺坐标就返回 null */
function coordsOf(places: ResultPlace[]): string[] | null {
  const coords = places.map((place) =>
    place.lat === null || place.lng === null ? null : `${place.lng},${place.lat}`,
  );
  return coords.some((c) => c === null) ? null : (coords as string[]);
}

/** 两个坐标是否是同一个点（约 10 米内视为同一个，避免浮点误差） */
function isSamePoint(a: { lng: number; lat: number }, b: { lng: number; lat: number }): boolean {
  return Math.abs(a.lng - b.lng) < 1e-4 && Math.abs(a.lat - b.lat) < 1e-4;
}

/** 一天里最后一个带坐标的地点（回住宿的起点），没有则返回 null */
function lastStationOf(day: ResultDay): ResultPlace | null {
  for (let i = day.places.length - 1; i >= 0; i -= 1) {
    const place = day.places[i];
    if (place.lat !== null && place.lng !== null) return place;
  }
  return null;
}

/** 地点是否就是住宿：名称互相包含，或坐标在 300 米内（同一个 POI 的两种写法） */
function matchesLodging(place: ResultPlace, lodging: LodgingCoords): boolean {
  const a = place.name.trim();
  const b = lodging.name.trim();
  if (a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a))) return true;
  if (place.lat === null || place.lng === null) return false;
  // straightDist2 返回「度」的平方，开方后 × 111.32 换成公里
  const km = Math.sqrt(straightDist2({ lat: place.lat, lng: place.lng }, lodging)) * 111.32;
  return km <= 0.3;
}

/**
 * 默认出发点 = 住宿所在地点：把与住宿对得上的那个地点挪到当天第 1 行。
 * 第 1 行是出发点行、不占序号；用户不想从住宿出发时，在列表里点「修改出发点」换一个。
 */
function promoteLodgingStart(days: ResultDay[], lodging: LodgingCoords | null): ResultDay[] {
  if (!lodging) return days;
  return days.map((day) => {
    const from = day.places.findIndex((place) => matchesLodging(place, lodging));
    return from > 0 ? { ...day, places: arrayMove(day.places, from, 0) } : day;
  });
}

/** 住宿的 'lng,lat' */
function lodgingPoint(lodging: LodgingCoords): string {
  return `${lodging.lng},${lodging.lat}`;
}

/**
 * 这一天是不是「住宿不在名单里」：住宿要当成当天的第 0 个点单独传进去一起排序
 * （与列表顶部单画一行住宿是同一个口径）。用户自己指定了出发点时就不需要了。
 */
function needsLodgingHead(
  places: ResultPlace[],
  lodging: LodgingCoords | null,
  hasCustomStart: boolean,
): boolean {
  if (!lodging || hasCustomStart) return false;
  return !places.some((place) => matchesLodging(place, lodging));
}

/** 一天的排序请求 */
interface DayOrderRequest {
  points: string[];
  /** 固定为起点的下标：0 = 从住宿 / 用户选的出发点出发，-1 = 逐个起点试算取最短路 */
  startIndex: number;
  /** points[0] 是额外插进来的住宿点：返回的顺序要跳过第 0 位，路段也要去掉第 1 段 */
  dropHead: boolean;
}

/**
 * 组装一天的排序请求（只在天需要重排时用）：
 * - 需要时把住宿插到第 0 位当起点（dropHead），其余地点按最小绕路排；
 * - 当天名单里就有住宿、或用户自己指定了出发点：第 0 位固定，只重排后面的地点；
 * - 没有住宿：逐个起点试算，取全程最短的一条。
 */
function dayOrderRequest(
  places: ResultPlace[],
  lodging: LodgingCoords | null,
  headIsLodging: boolean,
): DayOrderRequest | null {
  const points = coordsOf(places);
  if (!points || points.length < 2) return null;
  if (lodging && headIsLodging) {
    return { points: [lodgingPoint(lodging), ...points], startIndex: 0, dropHead: true };
  }
  return { points, startIndex: lodging ? 0 : -1, dropHead: false };
}

/** 按接口返回的顺序重排地点（dropHead 时跳过第 0 位的住宿点） */
function applyOrder(places: ResultPlace[], order: number[], dropHead: boolean): ResultPlace[] {
  const indices = dropHead ? order.filter((i) => i > 0).map((i) => i - 1) : order;
  return indices.map((i) => places[i]);
}

/** 顺序签名：每天 dayIndex + 当天各地点 id 按序；用于「一键复位」的脏比对（F-50） */
function orderKeyOf(days: ResultDay[]): string {
  return days.map((d) => `${d.dayIndex}:${d.places.map((p) => p.id).join(',')}`).join('|');
}

/** 调一次高德路线接口，失败返回 null（不打断界面） */
async function postRoute(body: {
  points: string[];
  mode: NavMode;
  cityAdcode: string | null;
  reorder: boolean;
  /** reorder 时把第 startIndex 个点固定为起点（0 = 从住宿出发，-1 = 自由试算） */
  startIndex?: number;
}): Promise<{ order: number[]; legs: AmapLeg[]; estimated: boolean } | null> {
  try {
    const res = await fetch('/api/amap/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      order?: number[];
      legs?: AmapLeg[];
      estimated?: boolean;
    };
    if (!data.ok || !Array.isArray(data.order) || !Array.isArray(data.legs)) return null;
    return { order: data.order, legs: data.legs, estimated: Boolean(data.estimated) };
  } catch {
    return null;
  }
}

/** 左起的站点序号：既是角标，也是拖拽手柄（用户口中的「5 号春熙路」） */
function OrderBadge({
  position,
  isFood,
  dragProps,
}: {
  position: number;
  isFood: boolean;
  dragProps: ReactNode;
}) {
  return (
    <span
      className={cn(
        'relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white',
        isFood ? 'bg-amber-500' : 'bg-teal-500',
      )}
    >
      {position}
      {dragProps}
    </span>
  );
}

/** 缩略图：有高德照片就用照片，没有（或加载失败）用类型色块 + 首字 */
function PlaceThumb({ place }: { place: ResultPlace }) {
  const [broken, setBroken] = useState(false);
  const isFood = place.type === PLACE_TYPE.FOOD;
  if (!place.imageUrl || broken) {
    return (
      <span
        className={cn(
          'grid h-11 w-11 shrink-0 place-items-center rounded-xl text-base font-semibold text-white',
          isFood ? 'bg-amber-500' : 'bg-teal-500',
        )}
      >
        {place.name.slice(0, 1)}
      </span>
    );
  }
  return (
    // 高德图片来自外部 CDN，加载失败自动退回色块，不留破图
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={place.imageUrl}
      alt={M.thumbAlt(place.name)}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-11 w-11 shrink-0 rounded-xl object-cover"
    />
  );
}

/** 出发点可选项：第 0 项固定是当前的出发点（默认就是住宿） */
interface StartOption {
  name: string;
  /** 这一项是住宿所在地点：名称后带一个紫色「住」 */
  isLodging: boolean;
}

/**
 * 「修改出发点」选择面板：列出当天的出发点可选项（第 0 项 = 当前出发点），
 * 点第 i 项就把它挪到当天第 1 行（序号 0）。序号与列表左侧角标保持一致。
 */
function StartPicker({
  open,
  options,
  backToLodging,
  onBackToLodging,
  onClose,
  onPick,
}: {
  open: boolean;
  options: StartOption[];
  /** 住宿不在当天名单里时，面板底部给一个「改回从住宿出发」的入口 */
  backToLodging?: string;
  onBackToLodging?: () => void;
  onClose: () => void;
  onPick: (to: number) => void;
}) {
  if (!open || options.length <= 0) return null;
  return (
    <>
      <button
        type="button"
        aria-label={M.startChange}
        onClick={onClose}
        className="fixed inset-0 z-20 cursor-default"
      />
      <div className="absolute right-0 top-9 z-30 w-60 rounded-xl border border-violet-200 bg-white p-2 shadow-lg">
        <p className="px-1 pb-1.5 text-xs text-stone-500">
          {M.startChangeTitle(options.length)}
        </p>
        <div className="max-h-56 overflow-y-auto">
          {options.map((item, i) => (
            <button
              key={`${item.name}-${i}`}
              type="button"
              onClick={() => onPick(i)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs',
                i === 0
                  ? 'bg-violet-50 font-semibold text-violet-700'
                  : 'text-stone-600 hover:bg-stone-100',
              )}
            >
              <span className="w-4 shrink-0 text-xs text-stone-400">{i}</span>
              <span className="truncate">{item.name}</span>
              {item.isLodging ? (
                <span className="shrink-0 rounded-[4px] bg-violet-600 px-1 py-0.5 text-xs font-bold leading-none text-white">
                  {M.lodgingBadge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        {backToLodging && onBackToLodging ? (
          <button
            type="button"
            onClick={onBackToLodging}
            className="mt-1 flex w-full items-center gap-2 rounded-md border border-violet-200 px-2 py-1.5 text-left text-xs text-violet-600 hover:bg-violet-50"
          >
            <span className="shrink-0 rounded-[4px] bg-violet-600 px-1 py-0.5 text-xs font-bold leading-none text-white">
              {M.lodgingBadge}
            </span>
            <span className="truncate">{backToLodging}</span>
            <span className="ml-auto shrink-0 text-xs text-stone-400">{M.startBack}</span>
          </button>
        ) : null}
      </div>
    </>
  );
}

/**
 * 行程列表里的一行：可拖拽排序，右侧有上移 / 下移与「移动到第 N 位」。
 * 拖拽手柄就是左侧序号角标，与用户说的「点 5 号改成 4 号」位置一致。
 */
function SortablePlaceRow({
  place,
  position,
  count,
  sortId,
  legNode,
  moveOpen,
  onToggleMove,
  onStep,
  onMoveTo,
  serial,
  isStart,
  isLodging,
  canUp,
  canDown,
  serials,
  startOptions,
  backToLodging,
  onBackToLodging,
  startOpen,
  onToggleStart,
  onPickStart,
}: {
  place: ResultPlace;
  /** 1 基序号（用于上下移动与「移动到第 N 位」的下标） */
  position: number;
  count: number;
  sortId: string;
  legNode: ReactNode;
  moveOpen: boolean;
  onToggleMove: (open: boolean) => void;
  onStep: (delta: -1 | 1) => void;
  onMoveTo: (to: number) => void;
  /** 左侧角标上显示的数字：出发点行是 0，其余是 1、2…（由父组件算好） */
  serial: number;
  /** 当天第 1 行 = 出发点行：名称右侧挂「修改出发点」 */
  isStart?: boolean;
  /** 这一行就是住宿所在地点：名称右侧标一个醒目的紫色「住」 */
  isLodging?: boolean;
  /** 是否还能上移 / 下移 */
  canUp: boolean;
  canDown: boolean;
  /** 当天各地点对应的角标数字，供「移到第 N 位」面板显示同样的编号 */
  serials: number[];
  /** 当天出发点可选项（第 0 项 = 当前出发点） */
  startOptions: StartOption[];
  /** 住宿不在当天名单里时：面板底部给一个把出发点改回住宿的入口 */
  backToLodging?: string;
  onBackToLodging?: () => void;
  startOpen?: boolean;
  onToggleStart?: (open: boolean) => void;
  onPickStart?: (to: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortId,
  });
  const isFood = place.type === PLACE_TYPE.FOOD;
  const canChangeStart = isStart === true && startOptions.length > 1;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'relative z-30 opacity-90')}
    >
      <div className="relative flex items-center gap-3.5 py-2.5 md:gap-3 md:py-0">
        <OrderBadge
          position={serial}
          isFood={isFood}
          dragProps={
            <button
              type="button"
              aria-label={M.orderDrag}
              {...attributes}
              {...listeners}
              className="absolute inset-0 cursor-grab touch-none rounded-full"
            />
          }
        />
        <PlaceThumb place={place} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5">
            <span className="truncate font-medium">{place.name}</span>
            {isLodging ? (
              <span
                title={M.lodgingHint}
                className="shrink-0 rounded-[4px] bg-violet-600 px-1.5 py-0.5 text-xs font-bold leading-none text-white"
              >
                {M.lodgingBadge}
              </span>
            ) : null}
          </p>
          <p className="truncate text-xs text-stone-500">
            {PLACE_TYPE_LABEL[place.type]} · {place.address ?? M.noAddress}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          {canChangeStart ? (
            <button
              type="button"
              aria-label={M.startChange}
              onClick={() => onToggleStart?.(!startOpen)}
              className={cn(
                'mr-1.5 grid h-7 place-items-center rounded-md border px-2.5 text-sm font-medium leading-none',
                startOpen
                  ? 'border-violet-500 bg-violet-50 text-violet-700'
                  : 'border-violet-200 bg-white text-violet-600 hover:bg-violet-50',
              )}
            >
              {M.startChange}
            </button>
          ) : null}
          <button
            type="button"
            aria-label={M.orderUp}
            disabled={!canUp}
            onClick={() => onStep(-1)}
            className="grid h-7 w-7 place-items-center rounded-md text-stone-400 hover:bg-stone-100 disabled:opacity-30"
          >
            <ChevronUp className="h-[18px] w-[18px] md:h-4 md:w-4" />
          </button>
          <button
            type="button"
            aria-label={M.orderDown}
            disabled={!canDown}
            onClick={() => onStep(1)}
            className="grid h-7 w-7 place-items-center rounded-md text-stone-400 hover:bg-stone-100 disabled:opacity-30"
          >
            <ChevronDown className="h-[18px] w-[18px] md:h-4 md:w-4" />
          </button>
          <button
            type="button"
            aria-label={M.orderMove}
            onClick={() => onToggleMove(!moveOpen)}
            className={cn(
              'ml-1 grid h-7 place-items-center rounded-md border px-2 text-xs font-medium',
              moveOpen
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100',
            )}
          >
            {M.orderMoveBtn}
          </button>
        </div>

        <StartPicker
          open={Boolean(startOpen) && canChangeStart}
          options={startOptions}
          backToLodging={backToLodging}
          onBackToLodging={onBackToLodging}
          onClose={() => onToggleStart?.(false)}
          onPick={(to) => onPickStart?.(to)}
        />

        {moveOpen ? (
          <>
            <button
              type="button"
              aria-label={M.moveToCancel}
              onClick={() => onToggleMove(false)}
              className="fixed inset-0 z-20 cursor-default"
            />
            <div className="absolute right-0 top-8 z-30 w-48 rounded-xl border border-stone-200 bg-white p-2 shadow-lg">
              <p className="px-1 pb-1.5 text-xs text-stone-500">{M.moveToTitle(count)}</p>
              <div className="grid grid-cols-6 gap-1">
                {serials.map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onMoveTo(i)}
                    className={cn(
                      'grid h-7 place-items-center rounded-md text-xs',
                      i === position - 1
                        ? 'bg-gradient-to-r from-primary-from to-primary-to font-semibold text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
                    )}
                  >
                    {item}
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
 * U09 路线结果：按天顺序列表 + 真实高德底图。
 * 地图与站点间距离依赖真实经纬度（lat/lng），缺坐标时只渲染底图，不画站点与线段。
 *
 * 本页包含四件事（2026-10-18 需求）：
 * 1. 出行方式可切换（步行 / 骑行 / 公交地铁 / 驾车）：切换后按该方式重排当天顺序并重算路段；
 * 2. 地图上淡淡地标出周边知名地点（高德评分前 8 的商场 / 商业街 / 景点）；
 * 3. 每个站点显示高德照片缩略图，没有照片用类型色块 + 首字；
 * 4. 顺序可拖动、上下移动、直接移动到第 N 位，改动即时回写数据库并同步地图。
 */
export function RouteResultClient({
  routeId,
  title,
  cityName,
  cityAdcode,
  days,
  transport,
  originCity,
  intercityLabel,
  lodgingLabel,
  lodging,
  resultDays,
  totalPlaces,
  createdAt,
  canUseAmapNav,
  canExport,
}: {
  routeId: string;
  title: string;
  cityName: string | null;
  /** 城市 adcode，公交地铁算路需要（如成都 510100） */
  cityAdcode: string | null;
  days: number;
  transport: Transport;
  originCity: string | null;
  intercityLabel: string;
  lodgingLabel: string;
  /** 住宿坐标（服务端用住宿名称搜高德解析）；null = 没住宿或没解析出坐标，就不画住宿与回程 */
  lodging: LodgingCoords | null;
  resultDays: ResultDay[];
  totalPlaces: number;
  createdAt: string;
  /** 「手机高德导航」是否可用（会员 / 管理员为 true；游客 false 时按钮转锁定态并弹升级引导） */
  canUseAmapNav: boolean;
  /** 「导出长图 / 分享」是否可用（会员 / 管理员为 true；游客 false 时按钮转锁定态） */
  canExport: boolean;
}) {
  const [activeDay, setActiveDay] = useState(-1);
  const [shot, setShot] = useState(false);
  const [saved, setSaved] = useState(false);
  /** 「手机高德导航」为会员功能：游客点击锁定态按钮时弹升级引导 */
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const router = useRouter();
  const [mapApi, setMapApi] = useState<AMapInstance | null>(null);
  /** 出行方式，默认用路线保存时的市内交通方式（步行 / 骑行） */
  const [mode, setMode] = useState<NavMode>(transport);
  const [navBusy, setNavBusy] = useState(false);
  const [estimated, setEstimated] = useState(false);
  /** 当前展示顺序（本地可变，拖拽 / 上下移动直接改它）；首次进页面先把住宿所在地点挪到当天第 1 行 */
  const [localDays, setLocalDays] = useState<ResultDay[]>(() =>
    promoteLodgingStart(resultDays, lodging),
  );
  /** 每个天的高德真实路段结果，下标 i 对应该天第 i → i+1 段 */
  const [dayLegs, setDayLegs] = useState<Record<number, AmapLeg[]>>({});
  /** 周边知名地点：按天懒加载（键为 day_index），默认不查，用户点某天的按钮才查该天 */
  const [landmarkByDay, setLandmarkByDay] = useState<Record<number, AmapLandmark[]>>({});
  /** 正在查询周边知名地点的那一天（null = 没有在查） */
  const [landmarkLoadingDay, setLandmarkLoadingDay] = useState<number | null>(null);
  /** 服务端因高德配额紧张（熔断降级）没返回周边 POI 时的提示标记 */
  const [landmarkQuotaTip, setLandmarkQuotaTip] = useState(false);
  const [orderState, setOrderState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [moveOpenId, setMoveOpenId] = useState<string | null>(null);
  /** 哪一天打开了「修改出发点」选择器（null = 没开） */
  const [startOpenDay, setStartOpenDay] = useState<number | null>(null);
  /** 用户手动指定的每天出发点（地点 id）；没有条目 = 默认从住宿所在地点出发 */
  const [customStartIds, setCustomStartIds] = useState<Record<number, string>>({});
  /** 「住宿 → 当天第一个地点」那段路：只在当天没有住宿所在地点（顶部单画一行住宿）时才需要 */
  const [headLegs, setHeadLegs] = useState<Record<number, AmapLeg>>({});
  /** 回住宿用的交通方式（与当天行程方式相互独立，用户可自行改选） */
  const [returnMode, setReturnMode] = useState<NavMode>(DEFAULT_RETURN_MODE);
  /** 每天「最后一个地点 → 住宿」这一段，键为 day_index */
  const [returnLegs, setReturnLegs] = useState<Record<number, AmapLeg>>({});
  const [returnBusy, setReturnBusy] = useState(false);
  const [returnFailed, setReturnFailed] = useState(false);

  /** 副作用里读最新值：定时器等异步回调不能用闭包旧值 */
  const daysRef = useRef(localDays);
  daysRef.current = localDays;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const dayLegsRef = useRef(dayLegs);
  dayLegsRef.current = dayLegs;
  /** 系统推荐顺序快照：仅在 syncRoute(reorder=true) 竞态守卫通过后写入（进页 / 切出行方式）；手动调序不更新；「一键复位」还原到这里（F-50） */
  const initialOrderRef = useRef<{
    days: ResultDay[];
    legs: Record<number, AmapLeg[]>;
    startIds: Record<number, string>;
    estimated: boolean;
  } | null>(null);
  /** 切换方式的请求序号：只应用最后一次，避免连点后旧结果覆盖新结果 */
  const reqRef = useRef(0);
  const legTimerRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 把当前顺序整体回写 route_places（防抖 600ms，拖完再存） */
  const saveOrder = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setOrderState('saving');
    saveTimerRef.current = setTimeout(() => {
      const items = daysRef.current.flatMap((day) =>
        day.places.map((place, i) => ({
          placeId: place.id,
          dayIndex: day.dayIndex,
          orderIndex: i,
        })),
      );
      // 保存接口是「先删后插」，一旦写进去的清单少了地点，那个地点就从路线里永久消失。
      // 因此页面渲染出的地点数与 route_places 记录数不一致时（例如某条地点详情没取回来）拒绝回写。
      if (items.length !== totalPlaces) {
        console.warn(
          '[RouteResultClient] 跳过顺序回写：页面地点数与路线地点数不一致',
          items.length,
          totalPlaces,
        );
        setOrderState('failed');
        return;
      }
      void fetch(`/api/routes/${routeId}/places`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
        .then((res) => res.json())
        .then((data: { ok?: boolean }) => setOrderState(data.ok ? 'saved' : 'failed'))
        .catch(() => setOrderState('failed'));
    }, 600);
  }, [routeId, totalPlaces]);

  /** 只重算某一天的路段（顺序已被用户改动，不再重排） */
  const recomputeDay = useCallback((dayIndex: number) => {
    if (legTimerRef.current[dayIndex]) clearTimeout(legTimerRef.current[dayIndex]);
    legTimerRef.current[dayIndex] = setTimeout(() => {
      const day = daysRef.current.find((d) => d.dayIndex === dayIndex);
      if (!day) return;
      const points = dayCoordPoints(day);
      if (!points || points.length < 2) {
        setDayLegs((prev) => {
          const next = { ...prev };
          delete next[dayIndex];
          return next;
        });
        return;
      }
      void postRoute({
        points,
        mode: modeRef.current,
        cityAdcode,
        reorder: false,
      }).then((res) => {
        if (res) setDayLegs((prev) => ({ ...prev, [dayIndex]: res.legs }));
      });
    }, 400);
  }, [cityAdcode]);

  /** 用户改动顺序：先本地立即生效（地图随之重画），再防抖重算路段 + 回写顺序 */
  const movePlace = useCallback(
    (dayIndex: number, from: number, to: number) => {
      if (from === to) return;
      setLocalDays((prev) =>
        prev.map((day) =>
          day.dayIndex === dayIndex ? { ...day, places: arrayMove(day.places, from, to) } : day,
        ),
      );
      recomputeDay(dayIndex);
      saveOrder();
    },
    [recomputeDay, saveOrder],
  );

  /**
   * 只把某一天按「起点约束」重排 + 重算路段，并写回库。
   * 起点固定在第 0 位：默认就是住宿（住宿不在名单里时把住宿插进去当第 0 个点），
   * 用户指定过出发点时那就用它的那一行当第 0 位，其余地点按高德矩阵 + 最近邻 + 2-opt 排成不绕路的一条线。
   */
  const optimizeDay = useCallback(
    async (dayIndex: number, places: ResultPlace[], headIsLodging: boolean) => {
      const req = dayOrderRequest(places, lodging, headIsLodging);
      if (!req) return;
      const res = await postRoute({
        points: req.points,
        mode: modeRef.current,
        cityAdcode,
        reorder: req.points.length >= 3,
        startIndex: req.startIndex,
      });
      if (!res) return;
      setLocalDays((prev) =>
        prev.map((day) =>
          day.dayIndex === dayIndex
            ? { ...day, places: applyOrder(places, res.order, req.dropHead) }
            : day,
        ),
      );
      // dropHead 时第 1 段是「住宿 → 首站」，不属于当天列表里的路段
      setDayLegs((prev) => ({
        ...prev,
        [dayIndex]: req.dropHead ? res.legs.slice(1) : res.legs,
      }));
      saveOrder();
    },
    [lodging, cityAdcode, saveOrder],
  );

  /**
   * 用户在「修改出发点」里选了别的地点：记下这一天的出发点，把它挪到当天第 1 行（序号 0），
   * 再把当天剩下的地点按「就近不绕路」重排一遍（起点固定为这个新出发点）。
   */
  const pickStart = useCallback(
    (dayIndex: number, from: number, placeId: string) => {
      setStartOpenDay(null);
      setCustomStartIds((prev) => ({ ...prev, [dayIndex]: placeId }));
      const day = daysRef.current.find((d) => d.dayIndex === dayIndex);
      if (!day || from <= 0) return;
      const places = arrayMove(day.places, from, 0);
      setLocalDays((prev) =>
        prev.map((d) => (d.dayIndex === dayIndex ? { ...d, places } : d)),
      );
      void optimizeDay(dayIndex, places, false);
    },
    [optimizeDay],
  );

  /** 出发点改回住宿（住宿不在当天名单里时，顶部那行住宿重新回到第 1 行，并重排当天剩余地点） */
  const pickLodgingStart = useCallback(
    (dayIndex: number) => {
      setStartOpenDay(null);
      setCustomStartIds((prev) => {
        if (!(dayIndex in prev)) return prev;
        const next = { ...prev };
        delete next[dayIndex];
        return next;
      });
      const day = daysRef.current.find((d) => d.dayIndex === dayIndex);
      if (day && lodging) void optimizeDay(dayIndex, day.places, true);
    },
    [lodging, optimizeDay],
  );

  /**
   * 按某个出行方式重算全部路段。
   * reorder = true（首次进页面 / 用户切方式）：按该方式的两两距离矩阵（高德矩阵）重排当天顺序——
   * 起点固定（住宿或用户指定的出发点），其余地点最近邻打底 + 2-opt 去交叉；
   * reorder = false（只改了顺序）：尊重用户手改的顺序，只把路段换成真实值。
   */
  const syncRoute = useCallback(
    async (next: NavMode, reorder: boolean) => {
      const snapshot = daysRef.current;
      const reqId = reqRef.current + 1;
      reqRef.current = reqId;
      setNavBusy(true);
      setMoveOpenId(null);

      const results = await Promise.all(
        snapshot.map(async (day) => {
          const headIsLodging =
            reorder && needsLodgingHead(day.places, lodging, Boolean(customStartIds[day.dayIndex]));
          const req = reorder
            ? dayOrderRequest(day.places, lodging, headIsLodging)
            : dayOrderRequest(day.places, null, false);
          if (!req) return null;
          const res = await postRoute({
            points: req.points,
            mode: next,
            cityAdcode,
            reorder: reorder && req.points.length >= 3,
            startIndex: req.startIndex,
          });
          return res ? { dayIndex: day.dayIndex, res, req } : null;
        }),
      );

      if (reqRef.current !== reqId) return;

      setMode(next);
      const nextDays = snapshot.map((day) => {
        const hit = results.find((r) => r?.dayIndex === day.dayIndex);
        if (!hit) return day;
        // 没重排（点太少 / 距离矩阵不可用）时接口返回的就是原顺序，照样能对上
        return reorder ? { ...day, places: applyOrder(day.places, hit.res.order, hit.req.dropHead) } : day;
      });
      setLocalDays(nextDays);
      setDayLegs((prev) => {
        const updated = { ...prev };
        for (const hit of results) {
          if (!hit) continue;
          // dropHead 时第 1 段是「住宿 → 首站」，不属于当天列表里的路段
          updated[hit.dayIndex] = hit.req.dropHead ? hit.res.legs.slice(1) : hit.res.legs;
        }
        return updated;
      });
      const nextEstimated = results.some((r) => r?.res.estimated);
      setEstimated(nextEstimated);
      if (reorder) {
        // 系统重排完成（进页 / 切方式）：更新「一键复位」快照；手动调序不走这里（F-50）
        const snapLegs = { ...dayLegsRef.current };
        for (const hit of results) {
          if (hit) snapLegs[hit.dayIndex] = hit.req.dropHead ? hit.res.legs.slice(1) : hit.res.legs;
        }
        initialOrderRef.current = {
          days: nextDays,
          legs: snapLegs,
          startIds: { ...customStartIds },
          estimated: nextEstimated,
        };
      }
      setNavBusy(false);
    },
    [cityAdcode, lodging, customStartIds],
  );

  /**
   * 首次进页面：按「起点约束」用高德矩阵把每天的路线重排一遍（最近邻 + 2-opt 去交叉），
   * 再算真实路段，然后把结果写回库——保证进来看到的就是就近不绕路的一条线。
   */
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    void syncRoute(modeRef.current, true).then(() => saveOrder());
  }, [syncRoute, saveOrder]);

  const visibleDays = activeDay === -1 ? localDays : localDays.filter((d) => d.dayIndex === activeDay);
  const stations = collectStations(visibleDays);

  /**
   * 哪些地点就是住宿：名称互相包含，或坐标在 300 米内（同一个 POI 的两种写法）。
   * 都对不上（住宿是名单外的一家酒店）时不标，免得把无关地点标成住宿。
   */
  const lodgingMatchIds = useMemo(() => {
    const ids = new Set<string>();
    if (!lodging) return ids;
    for (const day of localDays) {
      for (const place of day.places) {
        if (matchesLodging(place, lodging)) ids.add(place.id);
      }
    }
    return ids;
  }, [lodging, localDays]);

  /**
   * 哪些天要在列表顶部单画一行「住宿出发点行」。
   * 当天有与住宿对得上的地点（会被挪到第 1 行当出发点），或用户自己指定过出发点时，用那一行地点当出发点；
   * 都没有（住宿是名单外的一家酒店）时才单画住宿行——住宿不属于当天地点，所以它也不占序号。
   */
  const syntheticHeadDays = useMemo(() => {
    const days = new Set<number>();
    for (const day of localDays) {
      if (day.places.length === 0) continue;
      if (needsLodgingHead(day.places, lodging, Boolean(customStartIds[day.dayIndex]))) {
        days.add(day.dayIndex);
      }
    }
    return days;
  }, [lodging, localDays, customStartIds]);

  /** 只用来决定拼 ios 还是 android 的 scheme，不做拦截（UA 判断不可靠） */
  const [amapPlatform, setAmapPlatform] = useState<AmapPlatform>('desktop');
  const [navTip, setNavTip] = useState('');
  const navTipTimer = useRef<number | null>(null);
  /** 「点了却没唤起」的兜底计时器 */
  const navFallbackTimer = useRef<number | null>(null);

  useEffect(() => {
    setAmapPlatform(detectAmapPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0));
    return () => {
      if (navTipTimer.current) window.clearTimeout(navTipTimer.current);
      if (navFallbackTimer.current) window.clearTimeout(navFallbackTimer.current);
    };
  }, []);

  const showNavTip = useCallback((message: string) => {
    setNavTip(message);
    if (navTipTimer.current) window.clearTimeout(navTipTimer.current);
    navTipTimer.current = window.setTimeout(() => setNavTip(''), 4000);
  }, []);

  /** 当前顺序是否已偏离系统推荐快照（渲染期派生，不加 state；F-50） */
  const orderDirty =
    !!initialOrderRef.current && orderKeyOf(localDays) !== orderKeyOf(initialOrderRef.current.days);

  /**
   * 一键复位（F-50 · 方案 B）：还原进页面时的系统顺序快照（顺序 / 路段 / 出发点 / 降级标记），
   * 再经既有 saveOrder 防抖 PUT 落库一次。不新增 fetch、不调 syncRoute、不触发系统重排。
   */
  function resetOrder() {
    const snap = initialOrderRef.current;
    if (!snap || navBusy || orderState === 'saving' || !orderDirty) return;
    reqRef.current += 1; // 防御：作废可能仍在途的 syncRoute 响应，避免覆盖复位结果
    setLocalDays(snap.days);
    setDayLegs(snap.legs);
    setCustomStartIds(snap.startIds);
    setEstimated(snap.estimated);
    saveOrder();
    showNavTip(MESSAGES.TRY.RESULT.resetDone);
  }

  /**
   * 某一天交给高德导航的点：住宿在名单外时以住宿行开头，缺坐标的点跳过（无法导航）；
   * 末尾把住宿再作为终点追加，形成「住宿 → 各地点 → 回住宿」的闭环。
   * 依据：当天行程本身就是闭环（列表底部也有回住宿段），用户玩完最后一个地点常会直接导航回住宿。
   */
  const dayNavPoints = useCallback(
    (day: ResultDay): AmapNavPoint[] => {
      const head = syntheticHeadDays.has(day.dayIndex) && lodging ? [lodging] : [];
      const points: AmapNavPoint[] = [...head, ...day.places].flatMap((item) =>
        item.lat === null || item.lng === null
          ? []
          : [{ name: item.name, lng: item.lng, lat: item.lat }],
      );
      // 最后一个地点本身就是住宿时不再追加，免得起点终点重合又没有可算的路段
      if (lodging && points.length > 0 && !isSamePoint(points[points.length - 1], lodging)) {
        points.push({ name: lodging.name, lng: lodging.lng, lat: lodging.lat });
      }
      return points;
    },
    [lodging, syntheticHeadDays],
  );

  /**
   * 「手机高德导航」：不做 UA 拦截，直接把 App scheme 交给系统（装了高德就唤起，没装则无反应）。
   * 1.5 秒后还停在本页，说明没唤起成功（桌面浏览器 / 微信等内置浏览器 / 未安装），此时才给提示。
   * 之所以不再提前拦截：手机浏览器开「请求桌面版网站」、iPadOS、微信内置浏览器都会报桌面 UA，
   * 一旦据此拦下，真机上就永远点不动了。
   */
  const openAmapNav = useCallback(
    (day: ResultDay) => {
      const uri = buildAmapAppUri(
        dayNavPoints(day),
        mode,
        amapPlatform === 'ios' ? 'ios' : 'android',
      );
      if (!uri) {
        showNavTip(M.amapNavFailed);
        return;
      }
      window.location.href = uri;
      if (navFallbackTimer.current) window.clearTimeout(navFallbackTimer.current);
      navFallbackTimer.current = window.setTimeout(() => showNavTip(M.amapNavNoOpen), 1500);
    },
    [amapPlatform, dayNavPoints, mode, showNavTip],
  );

  /** 地图标记：序号用天内顺序，美食点橙色、景点青绿；住宿单独用一个方形「住」标记 */
  const mapPoints: AmapPoint[] = [
    ...stations.map((s) => ({
      lat: s.lat,
      lng: s.lng,
      order: s.order,
      label: s.place.name,
      food: s.place.type === PLACE_TYPE.FOOD,
    })),
    ...(lodging
      ? [{ lat: lodging.lat, lng: lodging.lng, lodging: true, label: lodging.name }]
      : []),
  ];

  /**
   * 地图折线：一天一条，颜色与列表里的天数标签一致；
   * 住宿不在当天地点名单里时，再补一条「住宿 → 当天第一个地点」的紫色虚线（与住宿标记同色）；
   * 住宿存在时补一条「末站 → 住宿」的虚线，走完了照着回就行。
   */
  const mapLines: AmapLine[] = [
    ...visibleDays.flatMap((day) => {
      const path = stations
        .filter((s) => s.dayIndex === day.dayIndex)
        .map((s) => ({ lat: s.lat, lng: s.lng }));
      if (path.length < 2) return [];
      return [{ path, stroke: DAY_HEX[day.dayIndex % DAY_HEX.length] }];
    }),
    ...(lodging
      ? visibleDays.flatMap((day) => {
          if (!syntheticHeadDays.has(day.dayIndex)) return [];
          const first = stations.find((s) => s.dayIndex === day.dayIndex);
          if (!first) return [];
          return [
            {
              path: [
                { lat: lodging.lat, lng: lodging.lng },
                { lat: first.lat, lng: first.lng },
              ],
              stroke: RETURN_LINE_HEX,
              dashed: true,
            },
          ];
        })
      : []),
    ...(lodging
      ? visibleDays.flatMap((day) => {
          const dayStations = stations.filter((s) => s.dayIndex === day.dayIndex);
          const last = dayStations[dayStations.length - 1];
          if (!last) return [];
          return [
            {
              path: [
                { lat: last.lat, lng: last.lng },
                { lat: lodging.lat, lng: lodging.lng },
              ],
              stroke: RETURN_LINE_HEX,
              dashed: true,
            },
          ];
        })
      : []),
  ];

  /**
   * 周边知名地点：默认不查询（省高德配额），用户点某天的「查看周边知名地点」按钮才查该天。
   * 查询结果按天存进 landmarkByDay；服务端在配额紧张（熔断降级）时会带回 quotaCritical 标记。
   */
  const loadDayLandmarks = useCallback((dayIndex: number) => {
    const day = daysRef.current.find((d) => d.dayIndex === dayIndex);
    if (!day) return;
    const dayStations = collectStations([day]);
    if (dayStations.length === 0) return;

    setLandmarkLoadingDay(dayIndex);
    setLandmarkQuotaTip(false);
    void fetch('/api/amap/landmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: dayStations.map((s) => ({ lat: s.lat, lng: s.lng })),
        excludeNames: dayStations.map((s) => s.place.name),
      }),
    })
      .then((res) => res.json())
      .then(
        (data: {
          ok?: boolean;
          quotaCritical?: boolean;
          items?: { lat: number; lng: number; name: string }[];
        }) => {
          if (data.quotaCritical) {
            setLandmarkQuotaTip(true);
            return;
          }
          const items = (data.items ?? []).map((it) => ({
            lat: it.lat,
            lng: it.lng,
            name: it.name,
          }));
          setLandmarkByDay((prev) => ({ ...prev, [dayIndex]: items }));
        },
      )
      .catch(() => {
        // 周边地点只是锦上添花，取不到不报错
      })
      .finally(() => {
        setLandmarkLoadingDay((cur) => (cur === dayIndex ? null : cur));
      });
  }, []);

  /** 地图上展示的周边知名地点：当前可见天里已查询过的那些，按名称 + 坐标去重 */
  const landmarks = useMemo<AmapLandmark[]>(() => {
    const seen = new Set<string>();
    const out: AmapLandmark[] = [];
    for (const day of visibleDays) {
      for (const item of landmarkByDay[day.dayIndex] ?? []) {
        const key = `${item.lng},${item.lat},${item.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
      }
    }
    return out;
  }, [landmarkByDay, visibleDays]);

  /**
   * 回住宿路段签名：方式 + 住宿坐标 + 每天末站坐标。
   * 用户改了当天顺序的末端、或改了回住宿方式时才会重算，避免频繁消耗高德额度。
   */
  const returnKey = useMemo(() => {
    if (!lodging) return '';
    return [
      returnMode,
      `${lodging.lng},${lodging.lat}`,
      ...localDays.map((day) => {
        const last = lastStationOf(day);
        return `${day.dayIndex}:${last ? `${last.lng},${last.lat}` : ''}`;
      }),
    ].join('|');
  }, [lodging, returnMode, localDays]);

  /**
   * 每天「末站 → 住宿」这一段：按用户选的回住宿方式算真实路线。
   * 用户口径是「玩完了可以直接选择交通方式回住宿的地点」，所以这一段用独立方式，
   * 不跟随当天的市内交通方式，也不参与当天行程的排顺序。
   */
  useEffect(() => {
    if (!lodging || !returnKey) {
      setReturnLegs({});
      return;
    }
    let cancelled = false;
    const lodgingPoint = `${lodging.lng},${lodging.lat}`;
    setReturnBusy(true);
    setReturnFailed(false);

    void Promise.all(
      daysRef.current.map(async (day) => {
        const last = lastStationOf(day);
        if (!last) return null;
        const res = await postRoute({
          points: [`${last.lng},${last.lat}`, lodgingPoint],
          mode: returnMode,
          cityAdcode,
          reorder: false,
        });
        const leg = res?.legs[0];
        return leg ? { dayIndex: day.dayIndex, leg } : null;
      }),
    ).then((results) => {
      if (cancelled) return;
      const next: Record<number, AmapLeg> = {};
      for (const hit of results) {
        if (hit) next[hit.dayIndex] = hit.leg;
      }
      setReturnLegs(next);
      setReturnFailed(results.length > 0 && results.every((r) => r === null));
      setReturnBusy(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 依赖用 returnKey（已含方式与每天末站坐标）
  }, [returnKey, cityAdcode, lodging]);

  /**
   * 顶部「住宿出发点行」到当天第一个地点的路段签名：方式 + 住宿坐标 + 每天第一个地点坐标。
   * 只有单画住宿行的那几天需要算（其余天出发点本身就是当天第 1 个地点，路段已含在当天行程里）。
   */
  const headKey = useMemo(() => {
    if (!lodging) return '';
    const parts: string[] = [];
    for (const day of localDays) {
      if (!syntheticHeadDays.has(day.dayIndex)) continue;
      const first = day.places[0];
      if (!first || first.lat === null || first.lng === null) continue;
      parts.push(`${day.dayIndex}:${first.lng},${first.lat}`);
    }
    return parts.length === 0 ? '' : `${mode}|${parts.join('|')}`;
  }, [lodging, localDays, syntheticHeadDays, mode]);

  useEffect(() => {
    if (!lodging || !headKey) {
      setHeadLegs({});
      return;
    }
    let cancelled = false;
    const lodgingPoint = `${lodging.lng},${lodging.lat}`;
    const targets = headKey
      .slice(headKey.indexOf('|') + 1)
      .split('|')
      .map((item) => {
        const [dayIndex, point] = item.split(':');
        return { dayIndex: Number(dayIndex), point };
      });

    void Promise.all(
      targets.map(async (target) => {
        const res = await postRoute({
          points: [lodgingPoint, target.point],
          mode,
          cityAdcode,
          reorder: false,
        });
        const leg = res?.legs[0];
        return leg ? { dayIndex: target.dayIndex, leg } : null;
      }),
    ).then((results) => {
      if (cancelled) return;
      const next: Record<number, AmapLeg> = {};
      for (const hit of results) {
        if (hit) next[hit.dayIndex] = hit.leg;
      }
      setHeadLegs(next);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 依赖用 headKey（已含方式与每天首个地点坐标）
  }, [headKey, cityAdcode, lodging]);

  useEffect(
    () => () => {
      for (const timer of Object.values(legTimerRef.current)) clearTimeout(timer);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    [],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  /**
   * 顺序与路段总数：先按天算出每段（真实值优先、直线估算兜底），
   * 再汇总成全程距离与在途时间。
   */
  const dayLegsMap = useMemo(() => {
    const map = new Map<number, (LegInfo | null)[]>();
    for (const day of localDays) {
      map.set(day.dayIndex, dayLegInfos(day, dayLegs[day.dayIndex], mode));
    }
    return map;
  }, [localDays, dayLegs, mode]);

  const { totalKm, totalMin } = useMemo(() => {
    let km = 0;
    let min = 0;
    for (const infos of dayLegsMap.values()) {
      for (const info of infos) {
        if (info) {
          km += info.km;
          min += info.min;
        }
      }
    }
    // 住宿不在当天名单里的天：顶部那行住宿到当天第一个地点的一段也算进全程
    for (const leg of Object.values(headLegs)) {
      km += leg.distanceMeters / 1000;
      min += Math.round(leg.durationSeconds / 60);
    }
    return { totalKm: km, totalMin: min };
  }, [dayLegsMap, headLegs]);

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
  )} · ${NAV_MODE_LABEL[mode]}`;
  const OrderIcon = MODE_ICON[mode];
  const orderStateText =
    orderState === 'saving'
      ? M.orderSaving
      : orderState === 'saved'
        ? M.orderSaved
        : orderState === 'failed'
          ? M.orderFailed
          : null;

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
          <div className="grid grid-cols-2 gap-2 md:flex">
            <Link
              href={ROUTES.ROUTE_EDIT(routeId)}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 text-sm"
            >
              <Pencil className="h-[18px] w-[18px] md:h-4 md:w-4" />
              {M.adjust}
            </Link>
            <button
              type="button"
              onClick={() => setShot(true)}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 text-sm"
            >
              <Smartphone className="h-[18px] w-[18px] md:h-4 md:w-4" />
              {M.shotMode}
            </button>
            <RouteShareButton routeId={routeId} canExport={canExport} />
            <button
              type="button"
              onClick={() => setSaved(true)}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-4 text-sm font-semibold text-white hover:brightness-110"
            >
              <Save className="h-[18px] w-[18px] md:h-4 md:w-4" />
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
          <div className="flex shrink-0 flex-wrap justify-end gap-3 pt-1 text-xs">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
              {M.legendSpot}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              {M.legendFood}
            </span>
            {lodging ? (
              <span className="flex items-center gap-1">
                <span
                  className="h-2.5 w-2.5 rounded-[3px]"
                  style={{ background: RETURN_LINE_HEX }}
                />
                {M.legendLodging}
              </span>
            ) : null}
            <span className="flex items-center gap-1 text-stone-400">
              <span className="h-2 w-2 rounded-full bg-stone-300" />
              {MESSAGES.MAP.LANDMARK_LEGEND}
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
            {localDays.map((d) => (
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
          <p className="mt-2 text-xs text-stone-400">{M.tripNote}</p>
        </div>

        {/* 出行方式切换：切换后按该方式重排当天顺序并重算路段 */}
        <div className="mx-5 mt-4 md:mx-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-stone-500">{M.navTitle}</span>
            {NAV_MODE_VALUES.map((item) => {
              const Icon = MODE_ICON[item];
              const active = mode === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    if (item !== mode) void syncRoute(item, true);
                  }}
                  className={cn(
                    'flex h-8 items-center gap-1.5 rounded-full px-3 text-xs transition',
                    active
                      ? 'bg-gradient-to-r from-primary-from to-primary-to font-semibold text-white'
                      : 'border border-stone-200 bg-white text-stone-600 hover:border-stone-300',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {NAV_MODE_LABEL[item]}
                </button>
              );
            })}
            {navBusy ? (
              <span className="flex items-center gap-1 text-xs text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {M.navLoading}
              </span>
            ) : null}
            {estimated && !navBusy ? (
              <span className="text-xs text-stone-400">{M.navEstimate}</span>
            ) : null}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-stone-400">{M.navHint}</p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-teal-700">{M.amapNavHint}</p>
          {landmarkQuotaTip ? (
            <p className="mt-1.5 text-xs font-medium text-amber-600">{M.landmarkQuotaTip}</p>
          ) : null}
          {navTip ? (
            <p className="mt-1.5 text-xs font-medium text-primary">{navTip}</p>
          ) : null}
        </div>

        <div className="mt-4 grid lg:grid-cols-5">
          {/* 顺序列表 */}
          <div className="order-2 min-w-0 px-5 pb-6 md:px-6 lg:order-1 lg:col-span-2 lg:border-r lg:border-stone-100">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-stone-700">{M.orderTitle}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetOrder}
                  disabled={!orderDirty || navBusy || orderState === 'saving' || !initialOrderRef.current}
                  className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {MESSAGES.TRY.RESULT.resetBtn}
                </button>
                {orderStateText ? (
                  <span
                    className={cn(
                      'text-xs',
                      orderState === 'failed' ? 'text-red-500' : 'text-stone-400',
                    )}
                  >
                    {orderStateText}
                  </span>
                ) : null}
              </div>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-stone-400">{M.orderHint}</p>

            <ol className="relative">
              {visibleDays.map((day) => {
                const infos = dayLegsMap.get(day.dayIndex) ?? [];
                /** 这一天是否要在顶部单画一行住宿（住宿是名单外的一家酒店） */
                const synthetic = syntheticHeadDays.has(day.dayIndex);
                const headLeg = synthetic ? headLegs[day.dayIndex] : undefined;
                const headInfo = headLeg
                  ? {
                      km: headLeg.distanceMeters / 1000,
                      min: Math.round(headLeg.durationSeconds / 60),
                    }
                  : null;
                const dayKm =
                  infos.reduce((sum, info) => sum + (info?.km ?? 0), 0) + (headInfo?.km ?? 0);
                const dayMin =
                  infos.reduce((sum, info) => sum + (info?.min ?? 0), 0) + (headInfo?.min ?? 0);
                const sortIds = day.places.map((p, i) => `${day.dayIndex}:${i}:${p.id}`);
                return day.places.length === 0 ? null : (
                  <Fragment key={`day-${day.dayIndex}`}>
                    <li className="mb-2 mt-4 flex items-center gap-2 text-sm font-semibold first:mt-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: DAY_HEX[day.dayIndex % 5] }}
                      />
                      {many ? M.dayLabel(day.dayIndex + 1) : M.singleDayLabel}
                      {dayKm > 0 ? (
                        <span className="min-w-0 truncate text-xs font-normal text-stone-400">
                          {M.dayMeta(dayKm.toFixed(1), M.duration(dayMin))}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => loadDayLandmarks(day.dayIndex)}
                        disabled={landmarkLoadingDay === day.dayIndex}
                        className="ml-auto flex h-7 shrink-0 items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 disabled:opacity-60"
                      >
                        {landmarkLoadingDay === day.dayIndex ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <MapIcon className="h-3.5 w-3.5" />
                        )}
                        {landmarkLoadingDay === day.dayIndex ? M.landmarkLoading : M.landmarkShow}
                      </button>
                      {canUseAmapNav ? (
                        <button
                          type="button"
                          title={M.amapNavTitle}
                          onClick={() => openAmapNav(day)}
                          className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-2.5 text-xs font-semibold text-white shadow-sm transition hover:from-emerald-600 hover:to-green-700 hover:shadow"
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          {M.amapNav}
                        </button>
                      ) : (
                        // 游客（非会员）锁定态：保留按钮位置与绿色渐变语境，加锁图标 + 「会员可用」小字
                        <button
                          type="button"
                          title={M.amapNavLockedTitle}
                          onClick={() => setUpgradeOpen(true)}
                          className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500/70 to-green-600/70 px-2.5 text-xs font-semibold text-white shadow-sm transition hover:from-emerald-600/80 hover:to-green-700/80"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          {M.amapNav}
                          <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-xs font-medium leading-none">
                            {M.amapNavLocked}
                          </span>
                        </button>
                      )}
                    </li>
                    {/* 住宿出发点行：住宿不在当天名单里时单画一行，序号固定为 0（它就是当天的出发点） */}
                    {synthetic && lodging ? (
                      <li className="mb-2">
                        <div className="relative flex items-center gap-3 rounded-xl border border-dashed border-violet-300 bg-violet-50/60 px-2.5 py-2">
                          <OrderBadge position={0} isFood={false} dragProps={null} />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5">
                              <span className="truncate font-medium">{lodging.name}</span>
                              <span
                                title={M.lodgingHint}
                                className="shrink-0 rounded-[4px] bg-violet-600 px-1.5 py-0.5 text-xs font-bold leading-none text-white"
                              >
                                {M.lodgingBadge}
                              </span>
                            </p>
                            <p className="truncate text-xs text-violet-700/70">{M.startHint}</p>
                          </div>
                          <div className="flex shrink-0 items-center">
                            {day.places.length > 0 ? (
                              <button
                                type="button"
                                aria-label={M.startChange}
                                onClick={() => {
                                  setMoveOpenId(null);
                                  setStartOpenDay(
                                    startOpenDay === day.dayIndex ? null : day.dayIndex,
                                  );
                                }}
                                className={cn(
                                  'grid h-7 place-items-center rounded-md border px-2.5 text-sm font-medium leading-none',
                                  startOpenDay === day.dayIndex
                                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                                    : 'border-violet-200 bg-white text-violet-600 hover:bg-violet-50',
                                )}
                              >
                                {M.startChange}
                              </button>
                            ) : null}
                          </div>
                          <StartPicker
                            open={startOpenDay === day.dayIndex}
                            options={[
                              { name: lodging.name, isLodging: true },
                              ...day.places.map((item) => ({
                                name: item.name,
                                isLodging: lodgingMatchIds.has(item.id),
                              })),
                            ]}
                            onClose={() => setStartOpenDay(null)}
                            onPick={(to) => {
                              if (to === 0) {
                                pickLodgingStart(day.dayIndex);
                                return;
                              }
                              const index = to - 1;
                              pickStart(day.dayIndex, index, day.places[index].id);
                            }}
                          />
                        </div>
                        {headInfo ? (
                          <p className="flex items-center gap-1 py-1 pl-11 text-xs text-stone-500">
                            <OrderIcon className="h-3.5 w-3.5 text-stone-400" />
                            {M.legMeta(
                              NAV_MODE_LABEL[mode],
                              headInfo.km.toFixed(1),
                              M.duration(headInfo.min),
                            )}
                          </p>
                        ) : null}
                      </li>
                    ) : null}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event: DragEndEvent) => {
                        const { active, over } = event;
                        if (!over || active.id === over.id) return;
                        const from = sortIds.indexOf(String(active.id));
                        const to = sortIds.indexOf(String(over.id));
                        if (from >= 0 && to >= 0) movePlace(day.dayIndex, from, to);
                      }}
                    >
                      <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
                        {day.places.map((place, i) => {
                          const info = i < infos.length ? infos[i] : null;
                          const sortId = sortIds[i];
                          return (
                            <SortablePlaceRow
                              key={sortId}
                              sortId={sortId}
                              place={place}
                              position={i + 1}
                              count={day.places.length}
                              serial={synthetic ? i + 1 : i}
                              isStart={!synthetic && i === 0}
                              isLodging={lodgingMatchIds.has(place.id)}
                              canUp={synthetic ? true : i > 0}
                              canDown={i < day.places.length - 1}
                              serials={day.places.map((_, index) => (synthetic ? index + 1 : index))}
                              startOptions={day.places.map((item) => ({
                                name: item.name,
                                isLodging: lodgingMatchIds.has(item.id),
                              }))}
                              backToLodging={
                                lodging && !day.places.some((item) => lodgingMatchIds.has(item.id))
                                  ? lodging.name
                                  : undefined
                              }
                              onBackToLodging={() => pickLodgingStart(day.dayIndex)}
                              startOpen={startOpenDay === day.dayIndex}
                              onToggleStart={(open) => {
                                setMoveOpenId(null);
                                setStartOpenDay(open ? day.dayIndex : null);
                              }}
                              moveOpen={moveOpenId === sortId}
                              onToggleMove={(open) => {
                                setStartOpenDay(null);
                                setMoveOpenId(open ? sortId : null);
                              }}
                              onStep={(delta) => {
                                // 顶部是住宿行（住宿不在当天名单里）时，第一个地点往上挪 = 把它设为当天出发点
                                if (synthetic && i === 0 && delta === -1) {
                                  pickStart(day.dayIndex, 0, place.id);
                                  return;
                                }
                                movePlace(day.dayIndex, i, i + delta);
                              }}
                              onMoveTo={(to) => {
                                setMoveOpenId(null);
                                movePlace(day.dayIndex, i, to);
                              }}
                              onPickStart={(to) => pickStart(day.dayIndex, to, day.places[to].id)}
                              legNode={
                                info ? (
                                  <p className="flex items-center gap-1 py-1 pl-11 text-xs text-stone-500">
                                    <OrderIcon className="h-3.5 w-3.5 text-stone-400" />
                                    {M.legMeta(
                                      NAV_MODE_LABEL[mode],
                                      info.km.toFixed(1),
                                      M.duration(info.min),
                                    )}
                                  </p>
                                ) : null
                              }
                            />
                          );
                        })}
                      </SortableContext>
                    </DndContext>
                    {lodging ? (
                      <li className="mt-1 flex items-center gap-1.5 border-l-2 border-dashed border-violet-300 py-1 pl-3 text-xs text-violet-700">
                        <BedDouble className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {returnLegs[day.dayIndex]
                            ? M.returnLeg(
                                lodging.name,
                                (returnLegs[day.dayIndex].distanceMeters / 1000).toFixed(1),
                                M.duration(Math.round(returnLegs[day.dayIndex].durationSeconds / 60)),
                              )
                            : returnBusy
                              ? M.returnLegLoading
                              : M.returnLegFailed}
                        </span>
                      </li>
                    ) : null}
                  </Fragment>
                );
              })}
            </ol>

            {/* 回住宿方式：紧跟在最下面那条紫色「返回住宿」信息之后，玩完了直接点这里换交通方式 */}
            {lodging ? (
              <div className="mt-3 rounded-xl border border-dashed border-violet-300 bg-violet-50/60 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <BedDouble className="h-3.5 w-3.5 shrink-0 text-violet-600" />
                  <span className="text-xs font-medium text-violet-700">{M.returnTitle}</span>
                  {NAV_MODE_VALUES.map((item) => {
                    const Icon = MODE_ICON[item];
                    const active = returnMode === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        aria-label={`${M.returnTitle}：${NAV_MODE_LABEL[item]}`}
                        onClick={() => setReturnMode(item)}
                        className={cn(
                          'flex h-7 items-center gap-1 rounded-full px-2.5 text-xs transition',
                          active
                            ? 'bg-violet-600 font-semibold text-white'
                            : 'border border-violet-200 bg-white text-violet-700 hover:bg-violet-100',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {NAV_MODE_LABEL[item]}
                      </button>
                    );
                  })}
                  {returnBusy ? (
                    <span className="flex items-center gap-1 text-xs text-violet-600">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {M.returnLegLoading}
                    </span>
                  ) : null}
                  {returnFailed && !returnBusy ? (
                    <span className="text-xs text-violet-700/70">{M.returnLegFailed}</span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-violet-700/70">
                  {M.returnHint}
                </p>
              </div>
            ) : null}
          </div>

          {/* 真实高德地图 */}
          <div className="order-1 min-w-0 px-5 pb-5 md:px-6 lg:order-2 lg:col-span-3 lg:pb-6 lg:pl-0">
            {/* 手机端限制高度，避免地图占满整屏（桌面端仍铺满右栏） */}
            <div className="relative h-[45vh] min-h-[300px] max-h-[560px] overflow-hidden rounded-2xl bg-[#eef3ec] lg:h-full lg:max-h-none lg:min-h-[420px]">
              <AmapMap
                className="absolute inset-0"
                points={mapPoints}
                lines={mapLines}
                landmarks={landmarks}
                interactive
                onReady={setMapApi}
              />
              <div className="absolute bottom-3 left-3 rounded bg-white/80 px-2 py-1 text-xs text-stone-500">
                {M.mapNote}
              </div>
              <div className="absolute right-3 top-3 flex flex-col gap-1">
                <button
                  type="button"
                  aria-label={M.zoomIn}
                  onClick={() => mapApi?.zoomIn()}
                  className="h-8 w-8 rounded-lg bg-white text-stone-600 shadow"
                >
                  +
                </button>
                <button
                  type="button"
                  aria-label={M.zoomOut}
                  onClick={() => mapApi?.zoomOut()}
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
            {totalKm > 0 ? M.total(totalKm.toFixed(1), M.duration(totalMin)) : M.totalPlaces(totalPlaces)}
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

      {/* 游客点「手机高德导航」锁定态按钮 → 升级引导（跳现有个人中心会员入口 R10 /profile） */}
      <ConfirmDialog
        open={upgradeOpen}
        title={M.upgradeNavTitle}
        description={M.upgradeNavDesc}
        confirmText={M.upgradeNavGo}
        cancelText={M.upgradeNavCancel}
        onConfirm={() => {
          setUpgradeOpen(false);
          router.push(ROUTES.PROFILE);
        }}
        onCancel={() => setUpgradeOpen(false)}
      />
    </>
  );
}
