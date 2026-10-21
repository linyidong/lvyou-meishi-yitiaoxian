import { describe, expect, it } from 'vitest';
import {
  distributeByDays,
  orderByMatrix,
  orderByStraightLine,
  straightDist2,
  type RouteOrderPoint,
} from '@/lib/route-order';

/**
 * T-019 单元测试：路线排序纯函数（lib/route-order.ts）。
 * 口径：最近邻 + 2-opt 去交叉；矩阵不完整时原样返回下标顺序。
 */

/** 一条直线上等距 4 个点的代价矩阵：cost[i][j] = |i - j| */
function lineMatrix(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => Math.abs(i - j)),
  );
}

describe('orderByMatrix', () => {
  it('直线等距矩阵 + 指定起点 0：得到不绕路顺序 [0,1,2,3]', () => {
    expect(orderByMatrix(lineMatrix(4), 0)).toEqual([0, 1, 2, 3]);
  });

  it('直线等距矩阵 + 不指定起点：全程代价最小（正序或倒序，代价均为 3）', () => {
    const order = orderByMatrix(lineMatrix(4));
    const cost = lineMatrix(4);
    const pathCost = order.reduce((sum, _, i) => (i === 0 ? 0 : sum + cost[order[i - 1]][order[i]]), 0);
    expect(new Set(order).size).toBe(4);
    expect(pathCost).toBe(3);
  });

  it('矩阵不完整（NaN / 非方阵）时原样返回下标顺序', () => {
    const broken = [
      [0, 1, Number.NaN],
      [1, 0, 1],
      [NaN, 1, 0],
    ];
    expect(orderByMatrix(broken)).toEqual([0, 1, 2]);
    expect(orderByMatrix([[0, 1], [1, 0, 1]])).toEqual([0, 1]);
  });

  it('0 / 1 个点直接返回自身', () => {
    expect(orderByMatrix([])).toEqual([]);
    expect(orderByMatrix([[0]])).toEqual([0]);
  });

  it('有交叉的折线经 2-opt 后消除交叉（代价下降）', () => {
    // 4 点：0—1 相邻、2—3 相邻，但两组之间很远；从 0 起步最近邻会走成 0,1,3,2 或 0,1,2,3
    const cost = [
      [0, 1, 100, 101],
      [1, 0, 101, 100],
      [100, 101, 0, 1],
      [101, 100, 1, 0],
    ];
    const order = orderByMatrix(cost, 0);
    // 合理结果：先走完近邻组 {0,1} 再去 {2,3} 组，总代价 = 1 + 100 + 1 = 102
    const pathCost = order.reduce((sum, _, i) => (i === 0 ? 0 : sum + cost[order[i - 1]][order[i]]), 0);
    expect(pathCost).toBe(102);
  });
});

describe('orderByStraightLine / straightDist2', () => {
  it('经度差按 cos 纬度打折：高纬度 1° 经度距离平方 < 1° 纬度距离平方', () => {
    const lngPair = straightDist2({ lat: 60, lng: 10 }, { lat: 60, lng: 11 });
    const latPair = straightDist2({ lat: 60, lng: 10 }, { lat: 61, lng: 10 });
    expect(lngPair).toBeLessThan(latPair);
    // cos(60°)=0.5 → 经度方向距离平方应为纬度方向的 0.25 倍
    expect(lngPair).toBeCloseTo(latPair * 0.25, 10);
  });

  it('从第一个有坐标点起步做最近邻；无坐标点排在有坐标点之后', () => {
    const points: RouteOrderPoint[] = [
      { placeId: 'no-coord', lat: null, lng: null },
      { placeId: 'c', lat: 30.7, lng: 104.1 },
      { placeId: 'a', lat: 30.5, lng: 104.0 },
      { placeId: 'b', lat: 30.6, lng: 104.05 },
    ];
    const ordered = orderByStraightLine(points);
    // 第一个有坐标的点是 c → 最近邻 c→b→a；无坐标点无法参与距离计算，追加在最后
    expect(ordered).toEqual(['c', 'b', 'a', 'no-coord']);
  });
});

describe('distributeByDays', () => {
  it('5 个点分 2 天：前 3 后 2，day/order 均为 0 基递增', () => {
    const items = distributeByDays(['p1', 'p2', 'p3', 'p4', 'p5'], 2);
    expect(items).toHaveLength(5);
    expect(items.filter((i) => i.dayIndex === 0).map((i) => i.placeId)).toEqual(['p1', 'p2', 'p3']);
    expect(items.filter((i) => i.dayIndex === 1).map((i) => i.placeId)).toEqual(['p4', 'p5']);
    expect(items[3].orderIndex).toBe(0);
    expect(items[4].orderIndex).toBe(1);
  });

  it('空列表返回空；days<1 按 1 天处理', () => {
    expect(distributeByDays([], 3)).toEqual([]);
    const oneDay = distributeByDays(['x', 'y'], 0);
    expect(oneDay.every((i) => i.dayIndex === 0)).toBe(true);
  });
});
