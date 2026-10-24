import { PLACE_TYPE } from '@/config/enums';

/**
 * T-036 地名 → 图标语义映射（纯函数，可单测）。
 * T-037 细化：新增 wildlife/shopping，匹配顺序 wildlife → shopping → pagoda → palace
 * → museum → park → street →（美食细分）→ 默认，保证同一张图里图标尽量不重复。
 * 景点与美食按关键词区分图标；关键词未命中时按 type 落到默认值。
 */
export type PlaceIconKey =
  | 'wildlife' // 动物园/熊猫/海洋馆
  | 'shopping' // 商场/商业街（太古里、春熙路等）
  | 'pagoda' // 宝塔
  | 'palace' // 宫殿
  | 'museum' // 博物馆/展馆
  | 'park' // 公园/绿地
  | 'tree' // 树（T-039 新增，仅首页示意图使用）
  | 'street' // 街巷/市集/广场
  | 'bowl' // 面/饭/汤
  | 'dumpling' // 饺子/包子
  | 'skewer' // 烧烤/串
  | 'hotpot' // 火锅
  | 'coffee'; // 咖啡/茶

/** 景点关键词规则（T-037 匹配顺序：wildlife → shopping → pagoda → palace → museum → park → street） */
const ATTRACTION_RULES: [PlaceIconKey, string[]][] = [
  ['wildlife', ['熊猫', '动物园', '动物', '海洋馆', '水族馆']],
  ['shopping', ['太古里', '商场', '购物', '百货', '广场', '春熙路', '步行街']],
  ['pagoda', ['塔', '寺', '庙', '禅', '鼓楼']],
  ['palace', ['宫', '殿', '城', '府', '苑']],
  ['museum', ['博物馆', '展馆', '纪念馆', '美术馆']],
  ['park', ['公园', '花园', '植物园', '湖']],
  ['street', ['街', '巷', '里', '胡同', '路']],
];

/**
 * 美食关键词规则（T-038 调整顺序与关键词）：
 * hotpot → skewer(仅 串/烧烤/烤串/烤肉，不再用单独「烤/肉」) → dumpling → coffee
 * → bowl(面/粉/饭/汤/锅/肉) → 默认。
 * 火锅先于「锅」碗类兜底；「肉丁胡辣汤」这类含「肉」的汤菜落 bowl 而非 skewer。
 */
const FOOD_RULES: [PlaceIconKey, string[]][] = [
  ['hotpot', ['火锅']],
  ['skewer', ['串', '烧烤', '烤串', '烤肉']],
  ['dumpling', ['饺', '包', '馄饨', '抄手']],
  ['coffee', ['咖啡', '茶', '饮']],
  ['bowl', ['面', '粉', '饭', '汤', '锅', '肉']],
];

/** 关键词命中后按 type 限定的图标（防止「路」把美食判成街巷等跨类误伤） */
const KEY_TYPE: Record<PlaceIconKey, 'attraction' | 'food'> = {
  wildlife: 'attraction',
  shopping: 'attraction',
  pagoda: 'attraction',
  palace: 'attraction',
  museum: 'attraction',
  park: 'attraction',
  tree: 'attraction',
  street: 'attraction',
  bowl: 'food',
  dumpling: 'food',
  skewer: 'food',
  hotpot: 'food',
  coffee: 'food',
};

/** 地名 → 图标 key；type 为 attraction/food */
export function iconKeyFor(name: string, type: 'attraction' | 'food'): PlaceIconKey {
  const rules = type === PLACE_TYPE.FOOD ? FOOD_RULES : ATTRACTION_RULES;
  for (const [key, words] of rules) {
    if (KEY_TYPE[key] !== type) continue;
    if (words.some((w) => name.includes(w))) return key;
  }
  return type === PLACE_TYPE.FOOD ? 'bowl' : 'museum';
}

/**
 * T-036 自绘 glyph 路径数据（24×24 viewBox，实心填充，evenodd 挖孔）。
 * T-038 尺寸归一：HTML 端（PlaceGlyph）与 Canvas 端（route-poster.ts）全部 12 键统一用这套
 * 路径数据（不再混用 lucide 描边图标，避免墨迹占比不同导致的实测宽度不一致）；
 * 首页 5 键（street/bowl/park/dumpling/shopping）与 pagoda/palace/museum 的墨迹宽度
 * 归一到 18 单位（x∈[3,21]）。pagoda/palace/dumpling/skewer/hotpot 造型参考
 * Material Design Icons（Apache-2.0）简化而来。
 */
export const PLACE_GLYPH_PATHS: Record<PlaceIconKey, string> = {
  // 宝塔：塔尖 + 三层檐（三角）与塔身 + 台基；T-038 檐逐层加宽至底檐 x∈[3,21]（墨迹宽 18）
  pagoda:
    'M11.1 1.6h1.8v2.4h-1.8z' +
    'M12 3.4l5.2 3.6H6.8z M9.4 7.6h5.2v2.4H9.4z' +
    'M12 9.4l7.6 4.2H4.4z M8.2 13.6h7.6v2.6H8.2z' +
    'M12 15.6l9 4.4H3z M6.6 20h10.8v2.4H6.6z',
  // 宫殿（T-037 重设计 / T-038 归宽）：宝顶 + 三层重檐梯形逐层加宽 + 主身门洞 + 宽台基；
  // 底层檐与台基 x∈[3,21]（墨迹宽 18），宽扁横带轮廓区别于博物馆「单三角 + 立柱」与宝塔「尖顶多层」
  palace:
    'M11.4 1.6h1.2v1.4h-1.2z' +
    'M7.8 3h8.4l1.5 2.2H6.3z' +
    'M9.2 5.4h5.6v1.6H9.2z' +
    'M5.6 7.2h12.8l1.5 2.2H4.1z' +
    'M7.8 9.6h8.4v1.7H7.8z' +
    'M4.2 11.5h15.6l1.2 2.3H3z' +
    'M7 14h10v4.6H7z' +
    'M10.9 15.6h2.2v3h-2.2z' +
    'M3 18.8h18v2.3H3z',
  // 博物馆：单层三角山墙 + 横梁 + 四立柱 + 台阶（竖向线条）；山墙 x∈[3,21]（墨迹宽 18）
  museum:
    'M12 3.2l9 5.6H3z M4.6 9.4h14.8v1.9H4.6z' +
    'M5 11.9h2v6.2H5z M9 11.9h2v6.2H9z M13 11.9h2v6.2h-2z M17 11.9h2v6.2h-2z' +
    'M3.6 18.7h16.8v2.4H3.6z',
  // 公园：大圆树冠（r=9，x∈[3,21]）+ 树干；T-038 归宽
  park: 'M12 2a9 9 0 1 0 .01 0z M10.7 18.5h2.6v4.5h-2.6z',
  // 街巷：遮阳篷 + 店面 + 门洞（evenodd 挖门）；篷 x∈[3,21]（墨迹宽 18）
  // 树：双层松树冠 + 树干（T-039 新增，仅首页示意图使用；墨迹宽 ~17）
  tree:
    'M12 2 5.5 10h3L3.5 16.5h7V21h3v-4.5h7L15.5 10h3z',
  street:
    'M3 7.8h18l-1.5 3.6H4.5z M5.2 12h13.6v9.4H5.2z M10 15.4h4v6h-4z',
  // 碗饭：下半圆碗身（rx=9，x∈[3,21]）+ 碗中饭 mound 两粒
  bowl:
    'M3 11.6h18a9 9 0 0 1-18 0z' +
    'M6.5 11.6a2.75 2.75 0 0 1 5.5 0z M12 11.6a2.75 2.75 0 0 1 5.5 0z',
  // 饺子：下弧饺子身（rx=9，x∈[3,21]）+ 锯齿褶边
  dumpling:
    'M3 12.8a9 7 0 0 0 18 0 L19.1 10 16.5 12.8 13.9 10 11.4 12.8 8.6 10 6.2 12.8 3.6 10z',
  // 串烧：粗斜签 + 三大块肉（圆）
  skewer:
    'M4.4 19.6L18 6l1.6 1.6L6 21.2z' +
    'M8.5 12.3a3.2 3.2 0 1 0 .01 0z M12 8.8a3.2 3.2 0 1 0 .01 0z M15.5 5.3a3.2 3.2 0 1 0 .01 0z',
  // 火锅：提钮 + 锅沿 + 双耳 + 锅身
  hotpot:
    'M11 6.6h2v2.6h-2z M3.6 10.2h16.8v2.2H3.6z M1.4 10.8h2.6v2.2H1.4z M20 10.8h2.6v2.2H20z' +
    'M5.4 12.6h13.2a6.6 6.6 0 0 1-13.2 0z',
  // 咖啡茶：杯身 + 把手 + 杯托（lucide Coffee 同语义）
  coffee:
    'M4.6 8.6h12v5a6 6 0 0 1-12 0z' +
    'M16.6 9.4h2.6a3.2 3.2 0 0 1 0 6.4h-2.6v-2h2.4a1.2 1.2 0 0 0 0-2.4h-2.4z' +
    'M3 19.6h16v2.2H3z',
  // 动物（T-037 新增）：三趾 + 掌垫（lucide PawPrint 同语义，Canvas 用）
  wildlife:
    'M12 11.8c3.6 0 6.4 2.8 6.4 5.9 0 2.2-2.1 3.2-6.4 3.2s-6.4-1-6.4-3.2c0-3.1 2.8-5.9 6.4-5.9z' +
    'M5.8 5.9a2.3 2.3 0 1 0 .02 0z M12 4.1a2.5 2.5 0 1 0 .02 0z M18.2 5.9a2.3 2.3 0 1 0 .02 0z',
  // 购物（T-037 新增 / T-038 归宽）：提手 + 梯形袋身（x∈[3,21]，墨迹宽 18）
  shopping:
    'M8.4 9.6V7a3.6 3.6 0 0 1 7.2 0v2.6h-2V7.1a1.6 1.6 0 0 0-3.2 0v2.5z' +
    'M3 9.6h18l-1.4 12.1H4.4z',
};
