import type { CSSProperties } from 'react';
import { PLACE_GLYPH_PATHS, type PlaceIconKey } from '@/lib/place-icon';

/**
 * T-036 地点语义图标（HTML/SVG 侧）。
 * T-038 尺寸归一：全部 12 键统一渲染 lib/place-icon 的自绘路径（与 Canvas 海报同一套数据），
 * 不再混用 lucide 描边图标——描边/实心的墨迹占比不同会导致同一张图里实测宽度不一致。
 * 首页 5 键的路径墨迹宽度已归一到 18 单位（x∈[3,21]），靠 viewBox 缩放，不依赖图标宽高比。
 * size/x/y 为显式渲染参数（用于嵌在父 SVG 里的场景，如首页示意图）。颜色继承 currentColor。
 */
export function PlaceGlyph({
  iconKey,
  className,
  size,
  x,
  y,
  style,
}: {
  iconKey: PlaceIconKey;
  className?: string;
  size?: number;
  x?: number;
  y?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={style}
      fill="currentColor"
      fillRule="evenodd"
      aria-hidden
    >
      <path d={PLACE_GLYPH_PATHS[iconKey]} />
    </svg>
  );
}
