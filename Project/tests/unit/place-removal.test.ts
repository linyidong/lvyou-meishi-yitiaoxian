import { describe, expect, it } from 'vitest';
import { BUSINESS } from '@/config/business';
import { MESSAGES } from '@/config/messages';
import { removePlaceAt, removePlaceByName } from '@/lib/place-removal';

/**
 * T-026 单元测试：结果页「移除已选地点」的纯逻辑（游客 / 会员共用）。
 * 重点断言两件事：移除后的集合正确、剩余不足下限时拒绝移除
 * （验收标准「剩余 2 个时移除被阻止」的依据就在这里，UI 只负责展示拒绝原因）。
 */
const PLACES = [
  { name: '春熙路', lat: 30.65, lng: 104.08 },
  { name: '宽窄巷子', lat: 30.67, lng: 104.05 },
  { name: '武侯祠', lat: 30.64, lng: 104.04 },
];

describe('T-026 移除地点纯逻辑', () => {
  it('移除 1 个后集合少 1 个、顺序保持、不动原数组', () => {
    const result = removePlaceAt(PLACES, 1, BUSINESS.GUEST_TRY_MIN_PLACES);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.next.map((p) => p.name)).toEqual(['春熙路', '武侯祠']);
    }
    expect(PLACES).toHaveLength(3);
  });

  it('剩余将低于 GUEST_TRY_MIN_PLACES(2) 时拒绝移除（reason=min）', () => {
    expect(BUSINESS.GUEST_TRY_MIN_PLACES).toBe(2);
    const two = PLACES.slice(0, 2);
    const blocked = removePlaceAt(two, 0, BUSINESS.GUEST_TRY_MIN_PLACES);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe('min');
  });

  it('下标越界拒绝移除（reason=notFound）', () => {
    const bad = removePlaceAt(PLACES, 9, 1);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe('notFound');
  });

  it('会员页单天保底：移空一天被拒（minCount=1）', () => {
    const one = PLACES.slice(0, 1);
    const blocked = removePlaceAt(one, 0, 1);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe('min');
  });

  it('草稿同步按名称剔除（同城同名只留一条，与 rank 映射口径一致）', () => {
    const draftPlaces = [
      { key: 'a', name: '春熙路' },
      { key: 'b', name: '宽窄巷子' },
      { key: 'c', name: '武侯祠' },
    ];
    const next = removePlaceByName(draftPlaces, '宽窄巷子');
    expect(next.map((p) => p.name)).toEqual(['春熙路', '武侯祠']);
  });

  it('移除相关文案已配置（游客与会员结果页共用 ROUTE_RESULT）', () => {
    expect(MESSAGES.ROUTE_RESULT.orderRemove).toBe('移除该地点');
    expect(MESSAGES.ROUTE_RESULT.removeMin).toContain('至少保留 2 个地点');
    expect(MESSAGES.ROUTE_RESULT.removeFailed).toContain('已恢复');
  });
});
