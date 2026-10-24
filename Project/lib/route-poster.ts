import { PLACE_TYPE, PLACE_TYPE_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import type { RouteShareSnapshot } from '@/types';

/**
 * 阶段 3 路线长图导出（客户端 canvas 纯自绘）。
 * 不调用高德静态图 API（避免消耗配额），二维码图片由调用方用 qrcode 生成后传入。
 */

const S = MESSAGES.SHARE;
const FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';

const WIDTH = 750;
/** 逐天清单每行高度 */
const LINE_H = 34;
/** 顶部品牌条 + 标题区预估高度 */
const HEADER_H = 260;
/** 底部二维码区高度 */
const FOOTER_H = 220;

function font(size: number, weight = '400') {
  return `${weight} ${size}px ${FONT}`;
}

/** 画圆角矩形（老浏览器无 roundRect 时兜底） */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 按最大宽度折行，最多 maxLines 行，超出加省略号 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const chars = Array.from(text);
  const lines: string[] = [];
  let line = '';
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === 0) return [''];
  if (lines.length === maxLines) {
    // 内容还有剩余则把最后一行补省略号
    const consumed = lines.join('').length;
    if (consumed < text.length) {
      let last = lines[maxLines - 1];
      while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

/** 单行截断（超宽加省略号） */
function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

/** T-035 站点类型主色：景点青绿 / 美食橙（与图例一致） */
const TYPE_COLOR: Record<string, string> = {
  [PLACE_TYPE.ATTRACTION]: '#14B8A6',
  [PLACE_TYPE.FOOD]: '#F59E0B',
};

/**
 * T-035 自绘站点类型图标（白色矢量路径，禁止 emoji / 外链图片）。
 * 景点 = 双峰山峰（折线闭合填充）；美食 = 碗（下半圆 + 碗沿横条）+ 两缕热气（二次贝塞尔短线）。
 * 以 (cx, cy) 为中心，整体控制在约 ±9px 内。
 */
function drawPlaceIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, type: string) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  if (type === PLACE_TYPE.FOOD) {
    // 碗沿横条 + 下半圆碗身
    ctx.fillRect(cx - 7, cy + 0.5, 14, 2.4);
    ctx.beginPath();
    ctx.arc(cx, cy + 1.5, 6.5, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    // 两缕热气：S 形短曲线
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (const dx of [-3, 3]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx, cy - 3);
      ctx.quadraticCurveTo(cx + dx + 2.2, cy - 5.5, cx + dx, cy - 8);
      ctx.stroke();
    }
  } else {
    // 双峰山：左小峰 + 右大峰，底边闭合
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 5.5);
    ctx.lineTo(cx - 3, cy - 3);
    ctx.lineTo(cx - 0.5, cy + 0.5);
    ctx.lineTo(cx + 3.5, cy - 6.5);
    ctx.lineTo(cx + 8, cy + 5.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * T-035 站点序号徽标（30×30）：类型色圆底 + 白色自绘图标 + 右下角白底类型色小序号。
 * (cx, cy) 为大圆圆心。
 */
function drawStationBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  type: string,
  num: number,
) {
  const color = TYPE_COLOR[type] ?? '#57534E';
  ctx.fillStyle = color;
  roundRect(ctx, cx - 15, cy - 15, 30, 30, 15);
  ctx.fill();
  drawPlaceIcon(ctx, cx, cy, type);
  // 右下角序号小徽标（白底圆 + 类型色数字）
  ctx.beginPath();
  ctx.arc(cx + 11, cy + 11, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.font = font(10, '700');
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(String(num), cx + 11, cy + 11.5);
  ctx.textAlign = 'left';
}

/** 从分享链接解析站点域名（无协议前缀时原样返回） */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export async function renderRoutePoster(input: {
  snapshot: RouteShareSnapshot;
  shareUrl: string;
  qrDataUrl: string;
}): Promise<Blob> {
  const { snapshot, shareUrl, qrDataUrl } = input;

  const dayBlocks = snapshot.dayPlans.map((d) => 140 + Math.max(1, d.places.length) * LINE_H);
  const contentH = dayBlocks.reduce((sum, h) => sum + h, 0);
  const height = HEADER_H + contentH + FOOTER_H;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  // 背景
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, WIDTH, height);

  // 顶部 G1 渐变条
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, 0);
  gradient.addColorStop(0, PRODUCT.COLOR_PRIMARY_FROM);
  gradient.addColorStop(1, PRODUCT.COLOR_PRIMARY_TO);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, 120);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = font(30, '700');
  ctx.fillText(PRODUCT.NAME, 40, 62);
  ctx.font = font(18, '400');
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(S.posterSubtitle, 40, 95);

  // 标题区
  let y = 180;
  ctx.fillStyle = '#1C1917';
  ctx.font = font(40, '700');
  const titleLines = wrapText(ctx, snapshot.title, WIDTH - 80, 2);
  for (const line of titleLines) {
    ctx.fillText(line, 40, y);
    y += 52;
  }

  // 概览行：城市 · N 天 · M 个地点
  const cityPart = snapshot.cityName ?? S.noCity;
  const meta =
    snapshot.days > 1
      ? S.summary(cityPart, snapshot.days, snapshot.totalPlaces)
      : S.summarySingle(cityPart, snapshot.totalPlaces);
  ctx.font = font(22, '400');
  ctx.fillStyle = '#78716C';
  ctx.fillText(meta, 40, y + 6);
  y += 40;

  // 逐天清单
  ctx.textBaseline = 'middle';
  for (const day of snapshot.dayPlans) {
    const blockTop = y;
    // 天数胶囊（G1 底色）
    ctx.font = font(20, '600');
    const pillText = S.dayTitle(day.dayIndex + 1);
    const pillW = ctx.measureText(pillText).width + 40;
    ctx.fillStyle = gradient;
    roundRect(ctx, 40, blockTop + 8, pillW, 34, 17);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(pillText, 60, blockTop + 26);

    ctx.font = font(16, '400');
    ctx.fillStyle = '#A8A29E';
    ctx.fillText(S.placesTotal(day.places.length), 40 + pillW + 12, blockTop + 26);

    let rowY = blockTop + 70;
    day.places.forEach((place, i) => {
      // T-035 序号徽标：类型色圆 + 自绘图标 + 右下角小序号
      drawStationBadge(ctx, 55, rowY, place.type, i + 1);

      // 类型标签
      ctx.font = font(16, '400');
      const typeText = PLACE_TYPE_LABEL[place.type];
      const tagW = ctx.measureText(typeText).width + 18;
      const tagX = WIDTH - 40 - tagW;

      // 地点名（在序号与类型标签之间截断）
      const nameMax = tagX - 12 - (40 + 38);
      ctx.font = font(22, '500');
      ctx.fillStyle = '#1C1917';
      ctx.fillText(truncate(ctx, place.name, nameMax), 40 + 38, rowY);

      ctx.font = font(16, '400');
      ctx.fillStyle = '#F5F5F4';
      roundRect(ctx, tagX, rowY - 13, tagW, 26, 6);
      ctx.fill();
      ctx.fillStyle = '#57534E';
      ctx.fillText(typeText, tagX + 9, rowY);

      rowY += LINE_H;
    });

    y = blockTop + 140 + Math.max(1, day.places.length) * LINE_H;
  }

  // 底部区：分隔线 + 二维码 + 域名 + 页脚
  ctx.beginPath();
  ctx.strokeStyle = '#E7E5E4';
  ctx.lineWidth = 1;
  ctx.moveTo(40, y + 20);
  ctx.lineTo(WIDTH - 40, y + 20);
  ctx.stroke();

  const qrSize = 180;
  const qrY = y + 56;
  const qrImg = await loadImage(qrDataUrl);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(40, qrY, qrSize, qrSize);
  ctx.drawImage(qrImg, 40, qrY, qrSize, qrSize);

  const textX = 40 + qrSize + 28;
  ctx.textBaseline = 'middle';
  ctx.font = font(24, '600');
  ctx.fillStyle = '#1C1917';
  wrapText(ctx, S.posterQrHint, WIDTH - 40 - textX, 2).forEach((line, i) => {
    ctx.fillText(line, textX, qrY + 40 + i * 36);
  });
  ctx.font = font(20, '400');
  ctx.fillStyle = PRODUCT.COLOR_PRIMARY_FROM;
  ctx.fillText(hostOf(shareUrl), textX, qrY + 120);

  ctx.font = font(16, '400');
  ctx.fillStyle = '#A8A29E';
  ctx.fillText(S.posterFooter(snapshot.exportedAt.slice(0, 10)), 40, qrY + qrSize + 30);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas toBlob failed'));
    }, 'image/png');
  });
}

/** 载入 dataURL 图片（二维码） */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('qr image load failed'));
    img.src = src;
  });
}
