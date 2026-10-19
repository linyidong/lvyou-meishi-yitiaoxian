import { NAV_MODE } from '@/config/enums';
import { PRODUCT } from '@/config/product';
import type { NavMode } from '@/types';

/**
 * 高德导航唤起（U09「用高德导航」按钮）
 * 高德消费者端没有「导入路线」的入口，只能把当天的起终点与途经点交给高德自己算路：
 * - App：iosamap://path（iOS）/ amapuri://route/plan/（Android），支持多途经点，手机端一键直达导航；
 * - 网页版 uri.amap.com/navigation 的 via 只支持 1 个途经点（且仅驾车），所以桌面端不拼链接，只提示用手机打开。
 * 参考高德开放平台：URI API 路径规划、手机版 iOS/Android 路径规划。
 */

/** 一天里参与高德导航的一个点（坐标已是高德坐标系，dev=0 直接可用） */
export interface AmapNavPoint {
  name: string;
  lng: number;
  lat: number;
}

/** 是否在手机端（只用来决定拼哪套 scheme；不用于拦截，见 openAmapNav） */
export type AmapPlatform = 'ios' | 'android' | 'desktop';

/** App 唤起链接里的出行方式 t：0 驾车 / 1 公交 / 2 步行 / 3 骑行 */
const APP_T: Record<NavMode, number> = {
  [NAV_MODE.DRIVE]: 0,
  [NAV_MODE.TRANSIT]: 1,
  [NAV_MODE.WALK]: 2,
  [NAV_MODE.BIKE]: 3,
};

/**
 * 判断用哪套 scheme。UA 不可靠，所以这里只做「拼 ios 还是 android」的选择：
 * - iPadOS 13+ 与手机浏览器的「请求桌面版网站」都会把 UA 报成 Macintosh，靠触摸点数兜底认成 iOS；
 * - 其余认不出来的（含真桌面浏览器）一律按 android 拼，真桌面上点击后的失败由延时兜底提示接住。
 */
export function detectAmapPlatform(ua: string, maxTouchPoints = 0): AmapPlatform {
  if (/iPhone|iPad|iPod|iOS/i.test(ua)) return 'ios';
  if (/Android|Mobile|MicroMessenger/i.test(ua)) return 'android';
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios';
  return 'desktop';
}

/** 途经点名称用 | 分隔传参，名称里不能混入 | */
function cleanName(name: string): string {
  return name.replace(/\|/g, '').trim();
}

/**
 * 拼高德 App 唤起链接：起点 + 途经点 + 终点（vian/vialons/vialats/vianames 四个参数数量必须一致）。
 * 少于 2 个点时返回 null（当天只有一个地点，没有可导航的路段）。
 */
export function buildAmapAppUri(
  points: AmapNavPoint[],
  mode: NavMode,
  platform: Exclude<AmapPlatform, 'desktop'>,
): string | null {
  if (points.length < 2) return null;
  const [from, ...rest] = points;
  const to = rest[rest.length - 1];
  const vias = rest.slice(0, -1);
  const params = [
    `sourceApplication=${encodeURIComponent(PRODUCT.NAME_EN)}`,
    `slat=${from.lat}`,
    `slon=${from.lng}`,
    `sname=${encodeURIComponent(cleanName(from.name))}`,
    `dlat=${to.lat}`,
    `dlon=${to.lng}`,
    `dname=${encodeURIComponent(cleanName(to.name))}`,
    // 坐标已是高德坐标系，不需要再做国测加密
    'dev=0',
    `t=${APP_T[mode]}`,
  ];
  if (vias.length > 0) {
    params.push(
      `vian=${vias.length}`,
      `vialons=${vias.map((p) => p.lng).join('|')}`,
      `vialats=${vias.map((p) => p.lat).join('|')}`,
      `vianames=${vias.map((p) => encodeURIComponent(cleanName(p.name))).join('|')}`,
    );
  }
  const base = platform === 'ios' ? 'iosamap://path' : 'amapuri://route/plan/';
  return `${base}?${params.join('&')}`;
}
