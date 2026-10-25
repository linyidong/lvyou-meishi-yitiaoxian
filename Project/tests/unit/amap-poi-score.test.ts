import { describe, expect, it } from 'vitest';
import { scorePoi } from '@/lib/amap';

/**
 * T-058 追加：POI 候选打分——水体/自然地名（海湾中心点）应排在岸上景区之后。
 * 真实案例：「南门湾」高德第一条是「海湾海峡」（水面点），第二条才是「南门湾风景区」（南门海堤）。
 */
describe('scorePoi', () => {
  it('水体类型降权，景区类型加权', () => {
    const water = scorePoi({ name: '南门湾', type: '地名地址信息;自然地名;海湾海峡', address: '东山县' }, '南门湾');
    const scenic = scorePoi({ name: '南门湾风景区', type: '风景名胜;风景名胜;风景名胜', address: '南门海堤' }, '南门湾');
    expect(scenic).toBeGreaterThan(water);
  });

  it('有具体地址比空地址高分', () => {
    const withAddr = scorePoi({ name: '南门湾夜市', type: '餐饮服务', address: '工业路1号' }, '南门湾夜市');
    const noAddr = scorePoi({ name: '南门湾夜市', type: '餐饮服务', address: '' }, '南门湾夜市');
    expect(withAddr).toBeGreaterThan(noAddr);
  });

  it('停车场等配套设施降权，景区优先', () => {
    const parking = scorePoi(
      { name: '南门湾风景区停车场', type: '交通设施服务;停车场;公共停车场', address: '南门路与水产路交叉口' },
      '南门湾',
    );
    const scenic = scorePoi({ name: '南门湾风景区', type: '风景名胜;风景名胜;风景名胜', address: '' }, '南门湾');
    expect(scenic).toBeGreaterThan(parking);
  });

  it('同名结果略有加成，但不敌水体降权', () => {
    expect(scorePoi({ name: 'A', type: '', address: '' }, 'A')).toBe(1);
    const waterExact = scorePoi({ name: '南门湾', type: '自然地名;海湾海峡', address: '' }, '南门湾');
    expect(waterExact).toBeLessThan(0);
  });
});
