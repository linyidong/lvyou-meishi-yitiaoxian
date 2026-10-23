/**
 * T-026 结果页「移除已选地点」的共用纯逻辑（游客 / 会员两页 + 单元测试共用）。
 * 只负责「能不能移除」与「移除后的集合」，网络请求与 UI 回滚留在页面组件里做。
 */

/** 可移除地点的最小字段集：草稿地点与 order 接口返回的地点都满足 */
export interface RemovalTarget {
  name: string;
}

export type RemovalResult<T> =
  | { ok: true; next: T[] }
  | { ok: false; reason: 'min' | 'notFound' };

/**
 * 移除第 index 个地点（0 基）：
 * - 剩余数量低于 minCount（如游客的 GUEST_TRY_MIN_PLACES=2）→ 拒绝，reason='min'；
 * - 下标越界 → reason='notFound'；
 * - 其余返回移除后的新数组，不改动入参。
 */
export function removePlaceAt<T extends RemovalTarget>(
  list: T[],
  index: number,
  minCount: number,
): RemovalResult<T> {
  if (index < 0 || index >= list.length) return { ok: false, reason: 'notFound' };
  if (list.length - 1 < minCount) return { ok: false, reason: 'min' };
  return { ok: true, next: list.filter((_, i) => i !== index) };
}

/**
 * 从地点集合里按名称剔除目标地点，用于游客草稿 sessionStorage 同步。
 * 口径与 applyOrder 里「草稿 ↔ order 结果」的 rank 映射一致：同城同名只留一条，名称即稳定键。
 */
export function removePlaceByName<T extends RemovalTarget>(list: T[], name: string): T[] {
  return list.filter((p) => p.name !== name);
}
