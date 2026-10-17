/**
 * U07 地点排序：把勾选地点排成「按天 + 当天顺序」的最终列表。
 * 纯函数，不依赖数据库与 DOM，便于单独验证。
 */

/** 待排序的地点（坐标可为空，空 = 尚未做高德匹配） */
export interface RouteOrderPoint {
  placeId: string;
  lat: number | null;
  lng: number | null;
}

/** 排序结果，day_index / order_index 均为 0 基，与 route_places 列一致 */
export interface RouteOrderItem {
  placeId: string;
  dayIndex: number;
  orderIndex: number;
}

function hasCoord(p: RouteOrderPoint): boolean {
  return typeof p.lat === 'number' && typeof p.lng === 'number';
}

/** 直线距离的平方（只用于比大小，无需开方） */
function dist2(a: RouteOrderPoint, b: RouteOrderPoint): number {
  const dLat = (a.lat as number) - (b.lat as number);
  const dLng = (a.lng as number) - (b.lng as number);
  return dLat * dLat + dLng * dLng;
}

/**
 * 最近邻排序：从第一个有坐标的点出发，每次挑离当前点最近的未访问点。
 * 没有坐标的点无法参与距离计算，保持原勾选顺序并追加在有坐标点之后。
 */
function orderByNearest(points: RouteOrderPoint[]): RouteOrderPoint[] {
  const withCoord = points.filter(hasCoord);
  const withoutCoord = points.filter((p) => !hasCoord(p));
  if (withCoord.length <= 1) return [...withCoord, ...withoutCoord];

  const remaining = [...withCoord];
  const ordered: RouteOrderPoint[] = [remaining.shift() as RouteOrderPoint];
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let bestIdx = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    remaining.forEach((p, i) => {
      const d = dist2(last, p);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }
  return [...ordered, ...withoutCoord];
}

/**
 * 生成路线顺序：
 * 1. 有坐标按最近邻排序，无坐标保持原顺序；
 * 2. 多日路线把有序列表均匀切成 days 段，依次分配到 day_index 0..days-1；
 * 3. 每段内 order_index 从 0 递增。
 */
export function buildRouteOrder(points: RouteOrderPoint[], days: number): RouteOrderItem[] {
  if (points.length === 0) return [];

  const dayCount = Math.max(1, Math.floor(days) || 1);
  const ordered = orderByNearest(points);

  const base = Math.floor(ordered.length / dayCount);
  const remainder = ordered.length % dayCount;

  const items: RouteOrderItem[] = [];
  let cursor = 0;
  for (let day = 0; day < dayCount; day += 1) {
    const size = base + (day < remainder ? 1 : 0);
    for (let order = 0; order < size; order += 1) {
      items.push({ placeId: ordered[cursor].placeId, dayIndex: day, orderIndex: order });
      cursor += 1;
    }
  }
  return items;
}
