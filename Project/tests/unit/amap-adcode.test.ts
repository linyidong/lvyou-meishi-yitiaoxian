import { describe, expect, it } from 'vitest';
import { adcodeWithin } from '@/lib/amap';

/**
 * T-058 追加：城市一致性判定的粒度（区县级必须精确，避免同地级市内跨区县错配）。
 * 真实案例：东山 350626 的「铁牛哥」被匹配到漳州芗城区 350602（同属 3506 前缀）。
 */
describe('adcodeWithin', () => {
  it('区县级目标必须精确相等', () => {
    expect(adcodeWithin('350626', '350626')).toBe(true);
    expect(adcodeWithin('350602', '350626')).toBe(false); // 芗城区 ≠ 东山县
    expect(adcodeWithin('350600', '350626')).toBe(false); // 地级市码不算具体县
  });

  it('地级市目标接受其下辖各区县', () => {
    expect(adcodeWithin('350602', '350600')).toBe(true);
    expect(adcodeWithin('350626', '350600')).toBe(true);
    expect(adcodeWithin('440305', '350600')).toBe(false);
  });

  it('直辖市目标只比前两位', () => {
    expect(adcodeWithin('110101', '110000')).toBe(true);
    expect(adcodeWithin('310104', '310000')).toBe(true);
    expect(adcodeWithin('110101', '310000')).toBe(false);
  });

  it('非法或空值一律不通过', () => {
    expect(adcodeWithin('', '350626')).toBe(false);
    expect(adcodeWithin('350626', '')).toBe(false);
    expect(adcodeWithin('35062', '350626')).toBe(false);
    expect(adcodeWithin('abc123', '350626')).toBe(false);
  });
});
