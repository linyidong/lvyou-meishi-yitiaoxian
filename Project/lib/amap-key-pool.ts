import { ENV, type AmapWebKeySlot } from '@/config/env';

/**
 * 高德 Web 服务 Key 池（服务端专用）。
 *
 * 目的：把多个高德账号的「Web服务」Key 叠加使用，每个账号独立 15 万次/月，
 * 两账号即两个独立额度池，合计可翻倍。高德不做跨账号合并，聚合只能在我们这侧做：
 * 用轮询（round-robin）把请求分散到各槽位，并跳过「本月用量已达熔断阈值」的槽位。
 *
 * 槽位下标（0 起）与 public.amap_usage.key_slot 对应，唯一标识一个高德账号的 Key。
 * 仅池里配置了 1 个 Key 时，选中结果恒为那一个，行为与接入前完全一致。
 */

/** 槽位在管理端看板的展示名 */
export function webKeyLabel(slot: number): string {
  return `Key ${slot + 1}`;
}

/**
 * 轮询游标：上次选中的槽位下标（-1 表示还没选过）。
 * dev / 单实例下每进程独立，够用；多实例部署时各实例各自轮询也不影响正确性。
 */
let lastSlot = -1;

/**
 * 轮流选一个 Key 槽位：从上次选中槽位的下一位开始，跳过已耗尽的槽位。
 *
 * - 有可用槽位 → 返回该槽位（并把游标移到它，下次从它的下一位继续）；
 * - 所有槽位都耗尽 → 仍按轮询返回下一个槽位。这里刻意不抛错：整体降级由各接口的
 *   isAmapQuotaCritical 判定负责，避免新增一条硬失败路径。
 * @param exhausted 已耗尽的槽位集合（月度用量 ≥ 熔断阈值）
 * @returns 选中的槽位下标；池为空时返回 -1
 */
export function pickWebKeySlot(exhausted: ReadonlySet<number>): number {
  const size = ENV.AMAP_WEB_KEYS.length;
  if (size === 0) return -1;

  for (let step = 1; step <= size; step += 1) {
    const slot = (lastSlot + step) % size;
    if (!exhausted.has(slot)) {
      lastSlot = slot;
      return slot;
    }
  }

  const slot = (lastSlot + 1) % size;
  lastSlot = slot;
  return slot;
}

/** 取指定槽位的 Key 配置；槽位越界时回落第一个（用于兜底） */
export function webKeyAt(slot: number): AmapWebKeySlot | undefined {
  return ENV.AMAP_WEB_KEYS[slot] ?? ENV.AMAP_WEB_KEYS[0];
}
