'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { cn } from '@/lib/utils';
import {
  loadAmap,
  type AMapInstance,
  type AMapNamespace,
  type AMapOverlay,
} from '@/lib/amap-loader';

/** 地图上的一个站点 */
export interface AmapPoint {
  lat: number;
  lng: number;
  /** 站点序号，传了才画带数字的大圆点（不传只画小圆点） */
  order?: number;
  /** 站点名称，传了才在圆点上方显示标签 */
  label?: string;
  /** 美食点用橙色，景点用青绿色 */
  food?: boolean;
  /** 未勾选 / 未选中时画成灰色 */
  inactive?: boolean;
  /** 住宿点：画成方形「住」标记，与圆点站点区分开 */
  lodging?: boolean;
}

/** 一条线路（一天一条） */
export interface AmapLine {
  path: { lat: number; lng: number }[];
  /** 线色，不传用主色 */
  stroke?: string;
  /** 虚线：用于「当天走完 → 回住宿」这类回程线，与当天的行程线区分开 */
  dashed?: boolean;
}

/** 路线周边的知名地点（灰点 + 浅灰小字，视觉上明显弱于自己的编号站点） */
export interface AmapLandmark {
  lat: number;
  lng: number;
  name: string;
}

const FOOD_COLOR = '#f59e0b';
const SPOT_COLOR = '#14b8a6';
const IDLE_COLOR = '#d6d3d1';
/** 住宿标记色（与站点、美食都不同的紫色，一眼能认出「今晚住这」） */
const LODGING_COLOR = '#7c3aed';
/** 还没有坐标时用的兜底中心（成都市中心），建图后会按路线范围重新定位 */
const FALLBACK_CENTER = { lng: 104.0665, lat: 30.5723 };

/** 自动定位到路线范围时的边距系数：1 表示刚好装下，大于 1 留出边距 */
const FIT_PADDING = 1.4;
/**
 * 自动定位的缩放级别下限：**不得高于 VIEW_MIN_ZOOM（用户手动下限）**。
 * 此前取 13，高于手动下限 10：跨度大的路线（如游客单日 6 点、市内 8-15km）
 * 理想缩放约 11-12 会被强行抬到 13，最远点出界——用户手动缩小反而能看到整条线，
 * 自动定位却做不到。取 10 后自动定位至少达到手动可达的效果；
 * 再往下（省/全国视图）仍由 fitZoomFor 的钳制挡住。
 */
const FIT_MIN_ZOOM = 10;
/** 自动定位的缩放级别上限：避免两三个点挨得很近时贴脸 */
const FIT_MAX_ZOOM = 16;
/** 允许缩小到的最小缩放：与自动定位下限一致，保证用户一定能缩小看到整条路线，又不至于缩成省/全国图 */
const VIEW_MIN_ZOOM = 10;
/** 高德 1.4 的最大缩放级别（默认 zooms 上界），用于 setZooms 的右端点 */
const MAX_ZOOM = 20;
/** 容器尺寸小于这个像素就不做自动定位（手机端首帧还没量到尺寸时会算出错误视角） */
const MIN_MEASURABLE_PX = 40;

/** 经纬度包围盒 */
interface LngLatBox {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

/**
 * 取所有站点、折线点与周边地点的最小外接矩形；没有任何点时返回 null
 */
function boundsOf(points: AmapPoint[], lines: AmapLine[], landmarks: AmapLandmark[]): LngLatBox | null {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  const visit = (lng: number, lat: number) => {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  };
  for (const p of points) visit(p.lng, p.lat);
  for (const line of lines) for (const p of line.path) visit(p.lng, p.lat);
  for (const l of landmarks) visit(l.lng, l.lat);
  if (!Number.isFinite(minLng)) return null;
  return { minLng, maxLng, minLat, maxLat };
}

/**
 * 依据包围盒与容器像素尺寸估算合适的缩放级别（Web Mercator 近似），
 * 并收敛到 [FIT_MIN_ZOOM, FIT_MAX_ZOOM]。
 * 用它替代高德自带的 setFitView：后者在窄小容器上会抛 Invalid Object: Pixel(NaN, NaN)，
 * 而且会把范围算得很宽，看起来像一张省/全国地图。
 */
function fitZoomFor(box: LngLatBox, width: number, height: number): number {
  const lat = (box.maxLat + box.minLat) / 2;
  const metersPerDegreeLng = 111320 * Math.cos((lat * Math.PI) / 180);
  const spanX = Math.max((box.maxLng - box.minLng) * metersPerDegreeLng, 1);
  const spanY = Math.max((box.maxLat - box.minLat) * 110900, 1);
  const metersPerPx =
    Math.max(spanX / Math.max(width, 1), spanY / Math.max(height, 1)) * FIT_PADDING;
  const zoom = Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180)) / metersPerPx);
  return Math.min(FIT_MAX_ZOOM, Math.max(FIT_MIN_ZOOM, Math.round(zoom * 100) / 100));
}

/** 坐标必须是有限数字：高德拿到 NaN / undefined 会抛 Invalid Object: Pixel(NaN, NaN) */
function isFinitePoint(p: { lat: number; lng: number }): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

/** 站点名来自用户导入的文案，拼进标记 HTML 前必须转义 */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

/** 标记 DOM：名称绝对定位在圆点上方，圆点始终在容器正中，便于用 offset 精准对齐 */
function markerHtml(point: AmapPoint, size: number): string {
  const label = point.label
    ? `<span style="position:absolute;top:-19px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:1px 4px;border-radius:3px;background:rgba(255,255,255,.88);color:#44403c;font:500 11px/1.3 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif">${escapeHtml(point.label)}</span>`
    : '';

  // 住宿：方形圆角「住」字块，形状与颜色都和圆形站点不同，扫一眼就能区分
  if (point.lodging) {
    return `<span style="position:relative;display:block;width:${size}px;height:${size}px;">
      <span style="position:absolute;inset:0;box-sizing:border-box;border-radius:7px;background:${LODGING_COLOR};border:2px solid #fff;color:#fff;font:700 11px/16px -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.3)">住</span>
      ${label}</span>`;
  }

  const color = point.inactive ? IDLE_COLOR : point.food ? FOOD_COLOR : SPOT_COLOR;
  const dot =
    size === 12
      ? `<span style="position:absolute;inset:0;box-sizing:border-box;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></span>`
      : `<span style="position:absolute;inset:0;box-sizing:border-box;border-radius:9999px;background:${color};border:2px solid #fff;color:#fff;font:700 11px/16px -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.3)">${point.order ?? ''}</span>`;
  return `<span style="position:relative;display:block;width:${size}px;height:${size}px;">${dot}${label}</span>`;
}

/** 周边知名地点的标记：8px 灰点 + 下方浅灰小字，比自己的站点更轻，不抢视线 */
function landmarkHtml(name: string): string {
  return `<span style="position:relative;display:block;width:8px;height:8px;">
    <span style="position:absolute;inset:0;box-sizing:border-box;border-radius:9999px;background:#cbd5e1;border:1.5px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.12)"></span>
    <span style="position:absolute;top:10px;left:50%;transform:translateX(-50%);white-space:nowrap;color:#a8a29e;font:500 10px/1.2 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif">${escapeHtml(name)}</span>
  </span>`;
}

/**
 * 内嵌真实高德地图底图：画站点标记与站间折线，建图后自动缩放到看得见全部站点。
 * 有坐标的地点少于 2 个时不建图，只显示提示文案，避免出现一块空白底图。
 *
 * 注意：高德内部异常（例如容器异常时抛 Invalid Object: Pixel(NaN, NaN)）必须就地捕获。
 * 它一旦冒泡成 React 渲染 / 副作用错误，错误边界会整棵树重建，页面会丢掉全部点击交互。
 * 因此下面每一处调用高德的地方都各自兜底，且只在数据真正变化时才重画。
 */
export function AmapMap({
  points,
  lines = [],
  landmarks = [],
  className,
  interactive = false,
  onReady,
}: {
  points: AmapPoint[];
  lines?: AmapLine[];
  /** 路线周边的知名地点（灰点），只在有底图时作为背景信息显示 */
  landmarks?: AmapLandmark[];
  className?: string;
  /** 是否允许拖动与缩放（路线卡片缩略图关掉，避免误触） */
  interactive?: boolean;
  /** 建图完成回调（销毁时回传 null），供外部按钮控制缩放 */
  onReady?: (map: AMapInstance | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AMapInstance | null>(null);
  const amapRef = useRef<AMapNamespace | null>(null);
  const overlaysRef = useRef<AMapOverlay[]>([]);
  const fitKeyRef = useRef('');
  /** 当前这次自动定位的执行体；容器尺寸变化时重复调用它（不改动用户的缩放偏好以外的行为） */
  const fitRef = useRef<(() => void) | null>(null);
  const onReadyRef = useRef(onReady);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  /** 先剔除非法坐标，再交给高德，从源头避免 Pixel(NaN, NaN) */
  const safePoints = useMemo(() => points.filter(isFinitePoint), [points]);
  const safeLines = useMemo(
    () =>
      lines
        .map((line) => ({ ...line, path: line.path.filter(isFinitePoint) }))
        .filter((line) => line.path.length >= 2),
    [lines],
  );
  const safeLandmarks = useMemo(() => landmarks.filter(isFinitePoint), [landmarks]);

  /**
   * 父组件每次渲染都会重建 points / lines 数组，若直接用数组引用做依赖，
   * 重画副作用会被无谓地反复触发（反复 remove/add 覆盖物）。这里用内容签名做依赖。
   */
  const pointsSig = safePoints
    .map(
      (p) =>
        `${p.lng},${p.lat},${p.order ?? ''},${p.label ?? ''},${p.food ? 1 : 0},${p.inactive ? 1 : 0},${p.lodging ? 1 : 0}`,
    )
    .join('|');
  const linesSig = safeLines
    .map(
      (l) =>
        `${l.stroke ?? ''}:${l.dashed ? 'd' : 's'}:${l.path.map((p) => `${p.lng},${p.lat}`).join(';')}`,
    )
    .join('|');
  const landmarksSig = safeLandmarks.map((l) => `${l.lng},${l.lat},${l.name}`).join('|');

  /**
   * 视角自适应签名：只看站点与**行程线**的坐标集合（不含顺序、名称、周边地点、回程虚线）。
   * 切天 / 换路线时坐标集合变了要重新定位（否则当天站点会被裁到画面外）；
   * 而拖动改顺序、切换出行方式、周边知名地点后到时坐标集合没变，视角保持不动。
   * 回程虚线不算进来：它只是「回住宿」的附加信息，不该因为顺序微调就让视角跳一下
   * （住宿坐标本身已作为站点参与 points 签名，首屏一样装得下）。
   */
  const fitKey = `${safePoints.map((p) => `${p.lng},${p.lat}`).join(';')}|${safeLines
    .filter((l) => !l.dashed)
    .map((l) => l.path.map((p) => `${p.lng},${p.lat}`).join(';'))
    .join(';')}`;

  /** 副作用里读最新数据（依赖用签名，避免读到闭包旧值） */
  const dataRef = useRef({ points: safePoints, lines: safeLines, landmarks: safeLandmarks });
  dataRef.current = { points: safePoints, lines: safeLines, landmarks: safeLandmarks };

  /** 建图用的初始中心只在挂载时取一次，避免 props 变化导致重复建图 */
  const centerRef = useRef(
    safePoints.length > 0 ? { lng: safePoints[0].lng, lat: safePoints[0].lat } : FALLBACK_CENTER,
  );

  const drawable = safePoints.length >= 2 || safeLines.length > 0;

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  /**
   * 容器尺寸变化（手机端首帧尚未量到尺寸、旋转屏幕、布局断点切换）后补做一次自动定位。
   * 尺寸变化很小就忽略，免得滚动条抖动 / 惯性滚动把用户的视角跳掉。
   */
  useEffect(() => {
    if (!ready) return;
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    let lastW = el.clientWidth;
    let lastH = el.clientHeight;
    let timer: number | null = null;
    const observer = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (Math.abs(w - lastW) < 40 && Math.abs(h - lastH) < 40) return;
      lastW = w;
      lastH = h;
      if (timer) window.clearTimeout(timer);
      // 等布局稳定（移动端键盘 / 折叠栏收起等会连发多次）再定位
      timer = window.setTimeout(() => {
        try {
          fitRef.current?.();
        } catch (err) {
          console.warn('[AmapMap] 尺寸变化后重新定位失败：', err);
        }
      }, 200);
    });
    observer.observe(el);
    return () => {
      if (timer) window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [ready]);

  useEffect(() => {
    if (!drawable) return;
    let cancelled = false;

    loadAmap()
      .then((AMap) => {
        if (cancelled || !containerRef.current) return;
        amapRef.current = AMap;
        try {
          const map = new AMap.Map(containerRef.current, {
            zoom: 12,
            center: [centerRef.current.lng, centerRef.current.lat],
            viewMode: '2D',
            resizeEnable: true,
            rotateEnable: false,
            dragEnable: interactive,
            zoomEnable: interactive,
            scrollWheel: interactive,
            doubleClickZoom: interactive,
            // 只保留背景、道路、建筑物：隐藏周边商家 / POI 的图标与名称
            // （参考主流地图的路线页，底图越干净，路线越突出）
            features: ['bg', 'road', 'building'],
          });
          mapRef.current = map;
          setReady(true);
          onReadyRef.current?.(map);
        } catch (err) {
          console.error('[AmapMap] 建图失败：', err);
          setFailed(true);
        }
      })
      .catch((err) => {
        console.error('[AmapMap] 高德脚本加载失败：', err);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      overlaysRef.current = [];
      fitKeyRef.current = '';
      fitRef.current = null;
      try {
        mapRef.current?.destroy();
      } catch (err) {
        // 高德销毁时也会抛 Pixel(NaN, NaN)，这里必须吞掉，否则卸载阶段会带崩整棵树
        console.error('[AmapMap] 销毁地图失败：', err);
      }
      mapRef.current = null;
      onReadyRef.current?.(null);
    };
  }, [drawable, interactive]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = amapRef.current;
    if (!map || !AMap || !ready) return;

    let step = 'remove';
    try {
      if (overlaysRef.current.length > 0) {
        try {
          map.remove(overlaysRef.current);
        } catch (err) {
          console.error('[AmapMap] 清理旧覆盖物失败，改用 clearMap：', err);
          map.clearMap();
        }
        overlaysRef.current = [];
      }

      step = 'polyline';
      const next: AMapOverlay[] = [];
      for (const line of dataRef.current.lines) {
        next.push(
          new AMap.Polyline({
            path: line.path.map((p) => [p.lng, p.lat]),
            strokeColor: line.stroke ?? PRODUCT.COLOR_PRIMARY_FROM,
            strokeWeight: line.dashed ? 4 : 5,
            strokeOpacity: line.dashed ? 0.8 : 0.95,
            strokeStyle: line.dashed ? 'dashed' : 'solid',
            lineJoin: 'round',
            lineCap: 'round',
            // 线身带方向箭头，和手机地图的路线观感一致（回程虚线不带箭头，保持轻）
            showDir: !line.dashed,
            zIndex: line.dashed ? 50 : 60,
          }),
        );
      }
      step = 'landmark';
      // 周边知名地点先画，编号站点后画，保证站点压在上面
      for (const landmark of dataRef.current.landmarks) {
        next.push(
          new AMap.Marker({
            position: [landmark.lng, landmark.lat],
            content: landmarkHtml(landmark.name),
            offset: new AMap.Pixel(-4, -4),
            zIndex: 70,
            title: landmark.name,
          }),
        );
      }
      step = 'marker';
      for (const point of dataRef.current.points) {
        const size = point.order !== undefined || point.label ? 20 : 12;
        next.push(
          new AMap.Marker({
            position: [point.lng, point.lat],
            content: markerHtml(point, size),
            offset: new AMap.Pixel(-size / 2, -size / 2),
            // 住宿标记压在最上层，免得被站点圆点盖住
            zIndex: point.lodging ? 110 : point.order !== undefined || point.label ? 100 : 90,
            title: point.label,
          }),
        );
      }

      step = 'add';
      map.add(next);
      overlaysRef.current = next;

      // 坐标集合变化时（首次绘制、切天、换路线）重新定位到自己算出的缩放级别与中心；
      // 顺序 / 出行方式 / 周边地点变化不重定位，保留用户当前视角。
      if (fitKeyRef.current !== fitKey && next.length > 0) {
        fitKeyRef.current = fitKey;
        try {
          const box = boundsOf(dataRef.current.points, dataRef.current.lines, dataRef.current.landmarks);
          if (box) {
            // 记下这次定位该怎么算，容器尺寸变化（含首帧量不到尺寸）时由 ResizeObserver 再补一次
            fitRef.current = () => {
              const el = containerRef.current;
              const width = el?.clientWidth ?? 0;
              const height = el?.clientHeight ?? 0;
              if (width < MIN_MEASURABLE_PX || height < MIN_MEASURABLE_PX) return;
              const zoom = fitZoomFor(box, width, height);
              // 最小缩放比自动定位值再小几级：允许用户缩小看到整条路线，而不是被锁死在定位视角
              map.setZooms([Math.min(VIEW_MIN_ZOOM, zoom), MAX_ZOOM]);
              map.setZoomAndCenter(zoom, [
                (box.minLng + box.maxLng) / 2,
                (box.minLat + box.maxLat) / 2,
              ]);
            };
            fitRef.current();
          }
        } catch (err) {
          console.warn('[AmapMap] 自动定位到路线范围失败，保留默认视角：', err);
        }
      }
    } catch (err) {
      console.error(`[AmapMap] 绘制站点失败 @${step}：`, err);
      setFailed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 依赖用内容签名，避免父组件重建数组导致重画
  }, [pointsSig, linesSig, landmarksSig, ready]);

  const hint = !drawable
    ? MESSAGES.MAP.NO_COORDS
    : failed
      ? MESSAGES.MAP.LOAD_FAILED
      : ready
        ? null
        : MESSAGES.MAP.LOADING;

  return (
    <div className={cn('relative z-0 h-full w-full overflow-hidden', className)}>
      <div ref={containerRef} className="h-full w-full" />
      {hint ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-4 text-center text-xs leading-relaxed text-stone-400">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
