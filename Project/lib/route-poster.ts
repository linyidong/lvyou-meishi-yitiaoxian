import { PLACE_TYPE_LABEL } from '@/config/enums';
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
// T-060 修正：底部区 = 分隔线(20) + 二维码(56+200) + 页脚(30) + 余量
const FOOTER_H = 340;

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
      // 序号
      ctx.fillStyle = '#E7E5E4';
      roundRect(ctx, 40, rowY - 13, 26, 26, 13);
      ctx.fill();
      ctx.font = font(15, '600');
      ctx.fillStyle = '#57534E';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), 53, rowY);
      ctx.textAlign = 'left';

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

  const qrSize = 200;
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
