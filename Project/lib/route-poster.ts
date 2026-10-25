import { PLACE_TYPE_LABEL, TRANSPORT_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import type { RouteShareSnapshot } from '@/types';

/**
 * T-061 路线长图导出（客户端 canvas 纯自绘，机票 / 登机牌风格）。
 * 票头主色渐变 + 自绘 logo；信息区（城市/天数/地点数/出行方式/导出日期）；
 * 每天区块 = 天数胶囊 + 高德静态地图截图（经 /api/amap/staticmap 代理，失败画占位框不阻断）+ 站点清单；
 * 底部撕票虚线 + 圆孔 + 二维码（保持可解码）+ 条形码。
 */

const S = MESSAGES.SHARE;
const FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';

/** 画布宽 1080（任务卡 §2②） */
const WIDTH = 1080;
const PAD = 48;
const CONTENT_W = WIDTH - PAD * 2;
/** 每天地图尺寸（≤ 高德静态图 1024*1024 上限） */
const MAP_W = CONTENT_W;
const MAP_H = 552;
/** 逐天清单每行高度 */
const LINE_H = 46;
/** 二维码绘制边长（≥200，保证可解码） */
const QR_SIZE = 240;

/** 票头固定区高度基准（logo 行之下按标题行数再加） */
const HEADER_BASE_H = 160;
/** 标题行高 */
const TITLE_LINE_H = 60;
/** 信息区高度 */
const INFO_H = 150;
/** 每天区块：胶囊区 + 地图 + 地图与清单间距 + 底部间距 */
const DAY_PILL_H = 94;
const DAY_MAP_GAP = 34;
const DAY_BOTTOM_H = 44;
/** 底部：撕票线上间距 + QR 上间距 + QR 区 + 条形码间距/高度/文字 + 下边距 */
const TEAR_GAP = 44;
const QR_GAP = 44;
const BAR_GAP = 40;
const BAR_H = 72;
const BAR_TEXT_H = 48;
const FOOTER_H =
  TEAR_GAP + QR_GAP + QR_SIZE + BAR_GAP + BAR_H + BAR_TEXT_H + 44;

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

/** 自绘 logo：白色圆角方块 + 主色渐变路线折线 + 起终点圆点 */
function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, x, y, size, size, size * 0.26);
  ctx.fill();

  const g = ctx.createLinearGradient(x, y, x + size, y + size);
  g.addColorStop(0, PRODUCT.COLOR_PRIMARY_FROM);
  g.addColorStop(1, PRODUCT.COLOR_PRIMARY_TO);
  ctx.strokeStyle = g;
  ctx.lineWidth = Math.max(3, size * 0.09);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + size * 0.2, y + size * 0.74);
  ctx.lineTo(x + size * 0.42, y + size * 0.4);
  ctx.lineTo(x + size * 0.6, y + size * 0.6);
  ctx.lineTo(x + size * 0.8, y + size * 0.26);
  ctx.stroke();

  ctx.fillStyle = PRODUCT.COLOR_PRIMARY_FROM;
  ctx.beginPath();
  ctx.arc(x + size * 0.2, y + size * 0.74, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PRODUCT.COLOR_PRIMARY_TO;
  ctx.beginPath();
  ctx.arc(x + size * 0.8, y + size * 0.26, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

/** 装饰条形码：由种子串生成确定性的条宽（纯自绘，不引库） */
function drawBarcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
) {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, y, w, h);
  const text = seed.length > 0 ? seed : 'ROUTE-PASS';
  let cx = x;
  let black = true;
  let i = 0;
  while (cx < x + w - 2) {
    const code = text.charCodeAt(i % text.length) + i * 7;
    const bw = black ? 2 + (code % 4) * 2 : 2 + (code % 3) * 3;
    ctx.fillStyle = black ? '#1C1917' : '#FFFFFF';
    ctx.fillRect(cx, y, Math.min(bw, x + w - cx), h);
    cx += bw;
    black = !black;
    i += 1;
  }
}

/** 按当天点位跨度选缩放级别（10-16，与代理接口校验同口径） */
function pickZoom(points: { lng: number; lat: number }[]): number {
  if (points.length < 2) return 14;
  const span = Math.max(
    Math.max(...points.map((p) => p.lng)) - Math.min(...points.map((p) => p.lng)),
    Math.max(...points.map((p) => p.lat)) - Math.min(...points.map((p) => p.lat)),
  );
  if (span < 0.006) return 15;
  if (span < 0.02) return 14;
  if (span < 0.05) return 13;
  if (span < 0.1) return 12;
  if (span < 0.25) return 11;
  return 10;
}

/**
 * 经服务端代理拉当天静态地图；任何失败（未登录 / 无坐标 / 超时 / 上游错误）返回 null，
 * 由绘制端画占位框，绝不阻断导出。
 */
async function fetchDayMapBitmap(
  points: { lng: number; lat: number }[],
): Promise<ImageBitmap | null> {
  if (points.length === 0) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const coords = encodeURIComponent(points.map((p) => `${p.lng},${p.lat}`).join(';'));
    const res = await fetch(
      `/api/amap/staticmap?coords=${coords}&size=${MAP_W}*${MAP_H}&zoom=${pickZoom(points)}`,
      { signal: ctrl.signal },
    );
    if (!res.ok) return null;
    const blob = await res.blob();
    return await createImageBitmap(blob);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function renderRoutePoster(input: {
  snapshot: RouteShareSnapshot;
  shareUrl: string;
  qrDataUrl: string;
  /** 公开分享页最小数据契约不含真实出行方式，置 false 时该栏显示「—」 */
  showTransport?: boolean;
}): Promise<Blob> {
  const { snapshot, shareUrl, qrDataUrl, showTransport = true } = input;

  // 并发拉每天的静态地图（先拉图再定画布高度：占位框与真图等高，布局不受成败影响）
  const dayPoints = snapshot.dayPlans.map((d) =>
    d.places
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => ({ lng: p.lng as number, lat: p.lat as number })),
  );
  const [maps, qrImg] = await Promise.all([
    Promise.all(dayPoints.map(fetchDayMapBitmap)),
    loadImage(qrDataUrl),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = 10;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  // 标题行数要先测量，票头高度随之变化（resize 会清空画布，须在绘制前完成）
  ctx.font = font(44, '700');
  const titleLines = wrapText(ctx, snapshot.title, CONTENT_W, 2);
  const headerH = HEADER_BASE_H + titleLines.length * TITLE_LINE_H;
  const dayBlockH = snapshot.dayPlans.map(
    (d) =>
      DAY_PILL_H +
      MAP_H +
      DAY_MAP_GAP +
      Math.max(1, d.places.length) * LINE_H +
      DAY_BOTTOM_H,
  );
  const height =
    headerH + INFO_H + dayBlockH.reduce((sum, h) => sum + h, 0) + FOOTER_H;
  canvas.height = height;

  // 票身白底
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, WIDTH, height);

  const gradient = ctx.createLinearGradient(0, 0, WIDTH, 0);
  gradient.addColorStop(0, PRODUCT.COLOR_PRIMARY_FROM);
  gradient.addColorStop(1, PRODUCT.COLOR_PRIMARY_TO);

  /* ---------- 票头（主色渐变） ---------- */
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, headerH);

  const logoSize = 76;
  drawLogo(ctx, PAD, 36, logoSize);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = font(38, '700');
  ctx.fillText(PRODUCT.NAME, PAD + logoSize + 22, 36 + 38);
  ctx.font = font(20, '400');
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`${S.posterBrandEn} · ${S.posterBrandSub}`, PAD + logoSize + 22, 36 + 68);

  // 右上角票种标识
  ctx.textAlign = 'right';
  ctx.font = font(22, '600');
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(S.posterBrandEn, WIDTH - PAD, 36 + 40);
  ctx.textAlign = 'left';

  // 路线标题
  ctx.fillStyle = '#FFFFFF';
  ctx.font = font(44, '700');
  let titleY = HEADER_BASE_H - 10;
  for (const line of titleLines) {
    ctx.fillText(line, PAD, titleY);
    titleY += TITLE_LINE_H;
  }

  /* ---------- 信息区（五列） ---------- */
  const cityPart = snapshot.cityName ?? S.noCity;
  const infoCells: { label: string; value: string }[] = [
    { label: S.posterInfoCity, value: cityPart },
    { label: S.posterInfoDays, value: `${snapshot.days}` },
    { label: S.posterInfoPlaces, value: `${snapshot.totalPlaces}` },
    {
      label: S.posterInfoTransport,
      value: showTransport ? TRANSPORT_LABEL[snapshot.transport] ?? '—' : '—',
    },
    { label: S.posterInfoExported, value: snapshot.exportedAt.slice(0, 10) },
  ];
  const cellW = CONTENT_W / infoCells.length;
  let infoY = headerH;
  ctx.textBaseline = 'middle';
  infoCells.forEach((cell, i) => {
    const cx = PAD + i * cellW;
    ctx.font = font(20, '400');
    ctx.fillStyle = '#A8A29E';
    ctx.fillText(cell.label, cx + 8, infoY + 44);
    ctx.font = font(28, '700');
    ctx.fillStyle = '#1C1917';
    ctx.fillText(truncate(ctx, cell.value, cellW - 20), cx + 8, infoY + 100);
    if (i > 0) {
      ctx.strokeStyle = '#E7E5E4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, infoY + 30);
      ctx.lineTo(cx, infoY + INFO_H - 30);
      ctx.stroke();
    }
  });
  // 信息区底部渐变细线
  ctx.fillStyle = gradient;
  ctx.fillRect(PAD, infoY + INFO_H - 6, CONTENT_W, 4);

  /* ---------- 每天区块 ---------- */
  let y = headerH + INFO_H;
  ctx.textBaseline = 'middle';
  snapshot.dayPlans.forEach((day, di) => {
    const blockTop = y;

    // 天数胶囊（渐变底）
    ctx.font = font(24, '600');
    const pillText = `${S.dayTitle(di + 1)} · ${S.posterDayPlaces(day.places.length)}`;
    const pillW = ctx.measureText(pillText).width + 48;
    ctx.fillStyle = gradient;
    roundRect(ctx, PAD, blockTop + 28, pillW, 44, 22);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(pillText, PAD + 24, blockTop + 51);

    // 地图截图（圆角描边）/ 占位框
    const mapTop = blockTop + DAY_PILL_H;
    const map = maps[di];
    if (map) {
      ctx.save();
      roundRect(ctx, PAD, mapTop, MAP_W, MAP_H, 24);
      ctx.clip();
      ctx.drawImage(map, PAD, mapTop, MAP_W, MAP_H);
      ctx.restore();
    } else {
      ctx.fillStyle = '#F5F5F4';
      roundRect(ctx, PAD, mapTop, MAP_W, MAP_H, 24);
      ctx.fill();
      ctx.strokeStyle = '#D6D3D1';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      roundRect(ctx, PAD, mapTop, MAP_W, MAP_H, 24);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = font(28, '500');
      ctx.fillStyle = '#A8A29E';
      ctx.textAlign = 'center';
      ctx.fillText(S.posterMapUnavailable, WIDTH / 2, mapTop + MAP_H / 2);
      ctx.textAlign = 'left';
    }
    // 描边（圆角）
    ctx.strokeStyle = '#E7E5E4';
    ctx.lineWidth = 2;
    roundRect(ctx, PAD, mapTop, MAP_W, MAP_H, 24);
    ctx.stroke();

    // 站点清单：序号 + 名称 + 类型 chip
    let rowY = mapTop + MAP_H + DAY_MAP_GAP + LINE_H / 2;
    day.places.forEach((place, i) => {
      ctx.fillStyle = '#F5F5F4';
      ctx.beginPath();
      ctx.arc(PAD + 18, rowY, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = font(20, '600');
      ctx.fillStyle = '#57534E';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), PAD + 18, rowY + 1);
      ctx.textAlign = 'left';

      ctx.font = font(20, '400');
      const typeText = PLACE_TYPE_LABEL[place.type];
      const tagW = ctx.measureText(typeText).width + 24;
      const tagX = WIDTH - PAD - tagW;

      ctx.font = font(26, '500');
      ctx.fillStyle = '#1C1917';
      ctx.fillText(truncate(ctx, place.name, tagX - 16 - (PAD + 44)), PAD + 44, rowY + 1);

      ctx.font = font(20, '400');
      ctx.fillStyle = '#F5F5F4';
      roundRect(ctx, tagX, rowY - 15, tagW, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#57534E';
      ctx.fillText(typeText, tagX + 12, rowY + 1);

      rowY += LINE_H;
    });

    y = blockTop + dayBlockH[di];
  });

  /* ---------- 撕票虚线 + 两侧圆孔 ---------- */
  const tearY = y + TEAR_GAP;
  ctx.strokeStyle = '#A8A29E';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(PAD, tearY);
  ctx.lineTo(WIDTH - PAD, tearY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#F5F5F4';
  ctx.beginPath();
  ctx.arc(0, tearY, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(WIDTH, tearY, 24, 0, Math.PI * 2);
  ctx.fill();

  /* ---------- 副票区：二维码 + 域名 + 条形码 ---------- */
  const qrY = tearY + QR_GAP;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(PAD, qrY, QR_SIZE, QR_SIZE);
  ctx.drawImage(qrImg, PAD, qrY, QR_SIZE, QR_SIZE);

  const textX = PAD + QR_SIZE + 36;
  ctx.font = font(28, '600');
  ctx.fillStyle = '#1C1917';
  wrapText(ctx, S.posterQrHint, WIDTH - PAD - textX, 2).forEach((line, i) => {
    ctx.fillText(line, textX, qrY + 60 + i * 42);
  });
  ctx.font = font(26, '500');
  ctx.fillStyle = PRODUCT.COLOR_PRIMARY_FROM;
  ctx.fillText(hostOf(shareUrl), textX, qrY + 160);
  ctx.font = font(20, '400');
  ctx.fillStyle = '#A8A29E';
  ctx.fillText(S.posterFooter(snapshot.exportedAt.slice(0, 10)), textX, qrY + 206);

  const barY = qrY + QR_SIZE + BAR_GAP;
  drawBarcode(ctx, PAD, barY, CONTENT_W, BAR_H, shareUrl);
  ctx.font = font(18, '400');
  ctx.fillStyle = '#78716E';
  ctx.textAlign = 'center';
  ctx.fillText(`${S.posterBrandEn} · ${PRODUCT.NAME}`, WIDTH / 2, barY + BAR_H + 30);
  ctx.textAlign = 'left';

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
