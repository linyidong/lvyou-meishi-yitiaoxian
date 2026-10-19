/**
 * 高德 JS API 脚本加载器（B 方案：页面内嵌真实高德地图底图）
 *
 * 版本选择：实测 JS API 2.0（WebGL 矢量渲染）在部分环境里只拉样式与图标、
 * 不拉底图瓦片，页面表现为一块灰白底；JS API 1.4（经典 canvas 渲染）在同环境
 * 底图、折线、标记都正常，因此这里固定用 1.4。
 * 1.4 不需要 securityJsCode（NEXT_PUBLIC_AMAP_SECURITY_CODE 仅 2.0 使用）。
 *
 * 这里只声明本项目用到的接口，避免引入 any。
 */
import { ENV } from '@/config/env';

/** 叠加物（标记 / 折线）的公共方法 */
export interface AMapOverlay {
  setMap(map: AMapInstance | null): void;
}

export interface AMapInstance {
  add(overlays: AMapOverlay[]): void;
  remove(overlays: AMapOverlay[]): void;
  clearMap(): void;
  setZoomAndCenter(zoom: number, center: [number, number]): void;
  /** 限制缩放范围 [最小, 最大]，1.4 无 setZoomLimit，用这个定「最小缩放」 */
  setZooms(zooms: [number, number]): void;
  zoomIn(): void;
  zoomOut(): void;
  destroy(): void;
}

export interface AMapNamespace {
  Map: new (container: HTMLElement, options?: Record<string, unknown>) => AMapInstance;
  Marker: new (options: Record<string, unknown>) => AMapOverlay;
  Polyline: new (options: Record<string, unknown>) => AMapOverlay;
  Pixel: new (x: number, y: number) => unknown;
}

declare global {
  interface Window {
    AMap?: AMapNamespace;
  }
}

/** 同一页面只加载一次脚本，多个地图组件共用 */
let pending: Promise<AMapNamespace> | null = null;

/**
 * 脚本加载超时（毫秒）。
 * 网络被阻断或请求一直挂起时，onload 与 onerror 都不会触发，
 * 必须有超时兜底，否则页面会永远停在「地图加载中…」。
 */
const AMAP_SCRIPT_TIMEOUT_MS = 20_000;

export function loadAmap(): Promise<AMapNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('高德地图只能在浏览器中加载'));
  }
  if (window.AMap) return Promise.resolve(window.AMap);
  if (pending) return pending;

  if (ENV.AMAP_JS_KEYS.length === 0) {
    return Promise.reject(new Error('缺少高德 JS API Key，请在 .env.local 中配置'));
  }

  // 多个 JS API Key（多个高德账号）时随机挑一个，分散前端地图用量；只有一个 Key 时就是它
  const jsKey = ENV.AMAP_JS_KEYS[Math.floor(Math.random() * ENV.AMAP_JS_KEYS.length)];

  pending = new Promise<AMapNamespace>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=1.4.15&key=${jsKey}`;
    script.async = true;

    const timer = window.setTimeout(() => {
      script.remove();
      reject(new Error('高德地图加载超时'));
    }, AMAP_SCRIPT_TIMEOUT_MS);

    script.onload = () => {
      window.clearTimeout(timer);
      if (window.AMap) resolve(window.AMap);
      else reject(new Error('高德地图加载失败'));
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('高德地图加载失败'));
    };
    document.head.appendChild(script);
  });

  // 加载失败后清掉缓存，下次进入页面还能重试
  pending.catch(() => {
    pending = null;
  });

  return pending;
}
