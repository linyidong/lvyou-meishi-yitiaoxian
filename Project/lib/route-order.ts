/**
 * U07 / U09 地点排序：把勾选地点排成「按天 + 当天顺序」的最终列表。
 * 纯函数，不依赖数据库与 DOM，便于单独验证。
 *
 * 排序口径（用户要求）：就近 + 不绕路。
 * - 就近：最近邻打底打分；
 * - 不绕路：2-opt 反复反转一段，消掉折线里的自交叉；
 * - 两者都在高德真实路网距离矩阵上做（矩阵来自 /api/amap/order 与 /api/amap/route）；
 * - 没有矩阵时退回「cos 纬度校正后的直线距离」——直接把经纬度当平面坐标会把经度
 *   方向算长（成都北纬 30° 一带约多算 15%），校正后东西向与南北向的比例才正确。
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

/** 2-opt 最多迭代轮数：正常数据两三轮到顶，留上限防止病态矩阵里打转 */
const TWO_OPT_MAX_ROUNDS = 20;

function hasCoord(p: RouteOrderPoint): boolean {
  return typeof p.lat === 'number' && typeof p.lng === 'number';
}

/**
 * 两点直线距离的平方（只用于比大小，无需开方）。
 * 经度差按所在纬度打折：cos(平均纬度)，纬度越高东西向越短。
 */
export function straightDist2(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = a.lat - b.lat;
  const cos = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const dLng = (a.lng - b.lng) * cos;
  return dLat * dLat + dLng * dLng;
}

function dist2(a: RouteOrderPoint, b: RouteOrderPoint): number {
  return straightDist2(
    { lat: a.lat as number, lng: a.lng as number },
    { lat: b.lat as number, lng: b.lng as number },
  );
}

/**
 * 最近邻排序（直线兜底用）：从第一个有坐标的点出发，每次挑离当前点最近的未访问点。
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

/** 无矩阵时的兜底顺序：带 cos 校正的直线最近邻，返回 placeId 顺序（无坐标点排在最后） */
export function orderByStraightLine(points: RouteOrderPoint[]): string[] {
  return orderByNearest(points).map((p) => p.placeId);
}

/** 矩阵是否完整可用（方阵、每个元素都是有限数） */
function isCompleteMatrix(cost: number[][]): boolean {
  const n = cost.length;
  for (let i = 0; i < n; i += 1) {
    if (!Array.isArray(cost[i]) || cost[i].length !== n) return false;
    for (let j = 0; j < n; j += 1) {
      if (!Number.isFinite(cost[i][j])) return false;
    }
  }
  return true;
}

/** 一条开放路径的总代价（不回到起点） */
function pathCost(order: number[], cost: number[][]): number {
  let sum = 0;
  for (let i = 0; i < order.length - 1; i += 1) {
    sum += cost[order[i]][order[i + 1]];
  }
  return sum;
}

/** 最近邻：从 start 出发，每次挑离当前点最近的未访问点，返回下标顺序 */
function nearestFrom(cost: number[][], start: number): number[] {
  const n = cost.length;
  const remaining: number[] = [];
  for (let i = 0; i < n; i += 1) {
    if (i !== start) remaining.push(i);
  }
  const ordered = [start];
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let bestIdx = 0;
    let bestCost = Number.POSITIVE_INFINITY;
    remaining.forEach((point, i) => {
      const value = cost[last][point];
      if (value < bestCost) {
        bestCost = value;
        bestIdx = i;
      }
    });
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }
  return ordered;
}

/**
 * 2-opt 去交叉（开放路径版）：反复把某一段整段反转，只要全程代价下降就接受。
 * 开放路径做整段反转不会动首尾端点，正好保留「起点 / 终点」语义；
 * 折线上出现交叉时（第 i 段与第 k 段相交，i < k），反转中间那段就能消掉交叉。
 */
function twoOpt(order: number[], cost: number[][]): number[] {
  const n = order.length;
  if (n < 4) return order;
  let best = order.slice();
  let bestCost = pathCost(best, cost);

  for (let round = 0; round < TWO_OPT_MAX_ROUNDS; round += 1) {
    let improved = false;
    for (let i = 1; i < n - 1; i += 1) {
      for (let k = i + 1; k < n; k += 1) {
        const candidate = best.slice();
        for (let a = i, b = k; a < b; a += 1, b -= 1) {
          const tmp = candidate[a];
          candidate[a] = candidate[b];
          candidate[b] = tmp;
        }
        const value = pathCost(candidate, cost);
        if (value + 1e-9 < bestCost) {
          best = candidate;
          bestCost = value;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return best;
}

/**
 * 按真实距离矩阵排序：最近邻打底 + 2-opt 去交叉。
 * - startIndex >= 0：指定起点（如「从离住宿最近的地点出发」），由它起步；
 * - startIndex < 0：不指定起点，每个点都当一次起点各算一遍，取全程代价最小的那条
 *   （对应「系统默认按就近又不绕路排好顺序」）。
 * 矩阵不完整时原样返回下标顺序，由调用方决定怎么兜底。
 */
export function orderByMatrix(cost: number[][], startIndex = -1): number[] {
  const n = cost.length;
  const identity = Array.from({ length: n }, (_, i) => i);
  if (n <= 1) return identity;
  if (!isCompleteMatrix(cost)) return identity;

  if (startIndex >= 0 && startIndex < n) {
    return twoOpt(nearestFrom(cost, startIndex), cost);
  }

  let best = identity;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let start = 0; start < n; start += 1) {
    const candidate = twoOpt(nearestFrom(cost, start), cost);
    const value = pathCost(candidate, cost);
    if (value < bestCost) {
      bestCost = value;
      best = candidate;
    }
  }
  return best;
}

/** 把已排好的有序 placeId 列表按天数均匀切分，分配 day_index / order_index（均 0 基） */
export function distributeByDays(placeIds: string[], days: number): RouteOrderItem[] {
  if (placeIds.length === 0) return [];

  const dayCount = Math.max(1, Math.floor(days) || 1);
  const base = Math.floor(placeIds.length / dayCount);
  const remainder = placeIds.length % dayCount;

  const items: RouteOrderItem[] = [];
  let cursor = 0;
  for (let day = 0; day < dayCount; day += 1) {
    const size = base + (day < remainder ? 1 : 0);
    for (let order = 0; order < size; order += 1) {
      items.push({ placeId: placeIds[cursor], dayIndex: day, orderIndex: order });
      cursor += 1;
    }
  }
  return items;
}

/**
 * 生成路线顺序（拿不到高德矩阵时的兜底）：
 * 1. 有坐标按 cos 校正直线最近邻排序，无坐标保持原顺序；
 * 2. 多日路线把有序列表均匀切成 days 段，依次分配到 day_index 0..days-1；
 * 3. 每段内 order_index 从 0 递增。
 */
export function buildRouteOrder(points: RouteOrderPoint[], days: number): RouteOrderItem[] {
  return distributeByDays(orderByStraightLine(points), days);
}
