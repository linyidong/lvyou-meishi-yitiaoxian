import { describe, expect, it } from 'vitest';
import { iconKeyFor, PLACE_GLYPH_PATHS } from '@/lib/place-icon';

/** T-036/037 地名→图标语义映射：6+ 组关键词 + wildlife/shopping + 默认分支 + 路径数据完整性 */
describe('iconKeyFor（T-036/037）', () => {
  it('景点关键词', () => {
    expect(iconKeyFor('大雁塔', 'attraction')).toBe('pagoda');
    expect(iconKeyFor('大唐不夜城', 'attraction')).toBe('palace');
    expect(iconKeyFor('陕西历史博物馆', 'attraction')).toBe('museum');
    expect(iconKeyFor('人民公园', 'attraction')).toBe('park');
    expect(iconKeyFor('宽窄巷子', 'attraction')).toBe('street');
    expect(iconKeyFor('洪崖洞民俗风貌街', 'attraction')).toBe('street');
    expect(iconKeyFor('灵隐寺', 'attraction')).toBe('pagoda');
  });

  it('T-037 wildlife：熊猫/动物园/动物/海洋馆/水族馆', () => {
    expect(iconKeyFor('成都大熊猫基地', 'attraction')).toBe('wildlife');
    expect(iconKeyFor('北京动物园', 'attraction')).toBe('wildlife');
    expect(iconKeyFor('珠海长隆海洋王国水族馆', 'attraction')).toBe('wildlife');
  });

  it('T-037 shopping：太古里/春熙路/广场/步行街/商场（优先于 street）', () => {
    expect(iconKeyFor('太古里', 'attraction')).toBe('shopping');
    expect(iconKeyFor('春熙路', 'attraction')).toBe('shopping');
    expect(iconKeyFor('万达广场', 'attraction')).toBe('shopping');
    expect(iconKeyFor('南京路步行街', 'attraction')).toBe('shopping');
    // shopping 先于 street：「里/路」不再把太古里/春熙路判成街巷
    expect(iconKeyFor('宽窄巷子', 'attraction')).not.toBe('shopping');
  });

  it('美食关键词', () => {
    expect(iconKeyFor('海底捞火锅', 'food')).toBe('hotpot');
    expect(iconKeyFor('钟水饺', 'food')).toBe('dumpling');
    expect(iconKeyFor('烤鱼串吧', 'food')).toBe('skewer');
    expect(iconKeyFor('老王烧烤', 'food')).toBe('skewer');
    expect(iconKeyFor('星巴克咖啡', 'food')).toBe('coffee');
    expect(iconKeyFor('一碗小面', 'food')).toBe('bowl');
    expect(iconKeyFor('螺蛳粉老店', 'food')).toBe('bowl');
  });

  it('T-038 美食优先级修正：含「肉」的汤菜落 bowl，串/烤肉仍 skewer，火锅不回归', () => {
    // 马老三肉丁胡辣汤：旧规则 skewer 含单独「肉」误判；新规则 skewer 仅 串/烧烤/烤串/烤肉
    expect(iconKeyFor('马老三肉丁胡辣汤', 'food')).toBe('bowl');
    expect(iconKeyFor('刘记烤串', 'food')).toBe('skewer');
    expect(iconKeyFor('王二烤肉', 'food')).toBe('skewer');
    expect(iconKeyFor('樊记腊汁肉夹馍', 'food')).toBe('bowl');
    expect(iconKeyFor('海底捞火锅', 'food')).toBe('hotpot');
  });

  it('火锅优先于碗类「锅」兜底', () => {
    expect(iconKeyFor('重庆老火锅', 'food')).toBe('hotpot');
    expect(iconKeyFor('铁锅炖', 'food')).toBe('bowl');
  });

  it('关键词不跨类误伤：美食名含「路/城」仍按美食规则', () => {
    expect(iconKeyFor('马路烧烤', 'food')).toBe('skewer');
    expect(iconKeyFor('陈麻婆豆腐', 'food')).toBe('bowl');
  });

  it('默认分支：景点→museum、美食→bowl', () => {
    expect(iconKeyFor('未知景点', 'attraction')).toBe('museum');
    expect(iconKeyFor('未知美食', 'food')).toBe('bowl');
  });

  it('PLACE_GLYPH_PATHS 覆盖全部 12 个 key 且为字符串路径', () => {
    const keys = [
      'wildlife', 'shopping', 'pagoda', 'palace', 'museum', 'park',
      'street', 'bowl', 'dumpling', 'skewer', 'hotpot', 'coffee',
    ] as const;
    for (const k of keys) {
      expect(typeof PLACE_GLYPH_PATHS[k]).toBe('string');
      expect(PLACE_GLYPH_PATHS[k].length).toBeGreaterThan(10);
    }
  });
});
