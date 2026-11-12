import { describe, expect, it } from 'vitest';
import { buildAmapAppUri } from '@/lib/amap-uri';
import { NAV_MODE } from '@/config/enums';

const A = { name: '熊猫基地', lat: 30.7333, lng: 104.1466 };
const B = { name: '宽窄巷子', lat: 30.6695, lng: 104.0555 };
const C = { name: '春熙路', lat: 30.6574, lng: 104.0814 };
const HOTEL = { name: '住宿', lat: 30.66, lng: 104.07 };

/** T-106：高德 App 导航 URI 的起终点防护（否则 App 弹「起点与终点不能为同一地点」） */
describe('buildAmapAppUri', () => {
  it('两个不同点：起点/终点正确', () => {
    const uri = buildAmapAppUri([A, B], NAV_MODE.WALK, 'ios');
    expect(uri).toContain('slat=30.7333');
    expect(uri).toContain('dlat=30.6695');
  });

  it('住宿闭环（起点=终点）时去掉末尾回程点', () => {
    const uri = buildAmapAppUri([HOTEL, A, B, HOTEL], NAV_MODE.WALK, 'ios');
    expect(uri).not.toBeNull();
    expect(uri).toContain('slat=30.66');
    // 终点应是 B，而不是与起点重合的 HOTEL
    expect(uri).toContain('dlat=30.6695');
    expect((uri as string).match(/dlat=/g)?.length).toBe(1);
  });

  it('相邻重复坐标会去重', () => {
    const uri = buildAmapAppUri([A, A, B], NAV_MODE.WALK, 'ios');
    expect(uri).not.toBeNull();
    expect(uri).toContain('slat=30.7333');
    expect(uri).toContain('dlat=30.6695');
  });

  it('去重后不足两个点返回 null', () => {
    expect(buildAmapAppUri([A, A], NAV_MODE.WALK, 'ios')).toBeNull();
    expect(buildAmapAppUri([HOTEL, HOTEL], NAV_MODE.WALK, 'ios')).toBeNull();
  });

  it('三个点保留途经点', () => {
    const uri = buildAmapAppUri([A, B, C], NAV_MODE.WALK, 'ios');
    expect(uri).toContain('vian=1');
    expect(uri).toContain('vianames=' + encodeURIComponent('宽窄巷子'));
  });
});
