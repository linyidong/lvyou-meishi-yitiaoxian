import { BUSINESS } from '@/config/business';

/**
 * 分享链接 → 文本（U02 导入地点：链接方式）
 * 小红书 / 抖音的分享链接多为短链（xhslink.com、v.douyin.com），需要跟随 302 到真实页面。
 * 只做 HTTP 抓取，不引入 headless 浏览器：
 * 1) 优先取 meta 摘要（og:description / description / og:title）；
 * 2) 摘要不足时，正则抽取页面可见文本兜底；
 * 3) 都拿不到（登录墙、纯前端渲染）就返回失败，由调用方提示改用「粘贴笔记文案」。
 */

const MAX_HTML_CHARS = 400 * 1024;
const FETCH_TIMEOUT_MS = 8000;
/** 判定「几乎只有链接」的剩余文本长度阈值 */
const AMBIENT_TEXT_MIN = 12;

const URL_PATTERN = /https?:\/\/[^\s"'<>（）()【】]+/i;

/** HTTP 响应头里的 UA：部分平台对非浏览器 UA 直接返回空壳页 */
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** 取文本里出现的第一个链接（没有则返回 null） */
export function firstUrlIn(text: string): string | null {
  const m = text.match(URL_PATTERN);
  return m ? m[0] : null;
}

/** 去掉文本里所有链接，用于判断是否「几乎只有链接」 */
export function textWithoutUrls(text: string): string {
  return text.replace(new RegExp(URL_PATTERN.source, 'gi'), ' ');
}

export function isUrlOnly(text: string): boolean {
  return textWithoutUrls(text).trim().length < AMBIENT_TEXT_MIN;
}

/** 只允许 http/https，且禁止内网/本机地址，避免被当作跳板请求内部服务 */
function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    /^(10|127)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host)
  ) {
    return false;
  }
  return true;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  middot: '·',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (all, code: string) => {
    if (code.startsWith('#')) {
      const n = code.startsWith('#x') || code.startsWith('#X')
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}

function readMeta(html: string, names: string[]): string {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']`,
      'i',
    );
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1]).trim();
    // 属性顺序相反的写法（content 在前）
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`,
      'i',
    );
    const m2 = html.match(re2);
    if (m2?.[1]) return decodeEntities(m2[1]).trim();
  }
  return '';
}

/** 正则抽取页面可见文本：去脚本样式、去标签、还原实体、压缩空白 */
function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[\u200b-\u200f\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clip(text: string): string {
  return text.trim().slice(0, BUSINESS.MAX_IMPORT_TEXT_LENGTH);
}

/** 平台返回的「笔记不存在 / 需登录 / 安全验证」页面不算读取成功，避免把错误页当正文喂给 AI */
const JUNK_PATTERN =
  /页面不见了|页面不存在|内容不存在|内容已被删除|笔记不存在|访问受限|访问的页面|安全验证|人机验证|验证测试|请先登录|登录后查看|滑动验证|not\s*found|access\s*denied|captcha|verification|verify/i;

/** 短链最终落到登录墙（小红书等未登录访问会跳 /login）时同样视为读不到 */
const LOGIN_URL_PATTERN = /\/(login|signin|sign-in|passport|account\/login)\b/i;

function isErrorPage(finalUrl: string, head: string): boolean {
  return (
    /\/404|error_code=|\/error\b|verify/i.test(finalUrl) ||
    LOGIN_URL_PATTERN.test(finalUrl) ||
    JUNK_PATTERN.test(head)
  );
}

/** 少于这个长度基本只是站点名 / 一句话标题，交给 AI 也识别不出地点，按「读不到」处理 */
const MIN_USEFUL_TEXT = 24;

/**
 * 抓取链接内容并整理成一段可供 AI 提取的文本。
 * 成功返回文本（非空），失败返回 null（调用方据此提示改用文案方式）。
 */
export async function fetchTextFromUrl(url: string): Promise<string | null> {
  if (!isPublicHttpUrl(url)) return null;

  let html = '';
  let finalUrl = url;
  try {
    const res = await fetch(url, {
      // 跟随短链 302（xhslink / v.douyin 等都靠这层跳转）
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    if (!/text\/html|text\/plain|application\/json|application\/xhtml/i.test(type)) return null;
    finalUrl = res.url || url;
    html = (await res.text()).slice(0, MAX_HTML_CHARS);
  } catch {
    // 超时 / DNS / 被重置 / 证书问题：统一按「读不到」处理，让用户走文案方式
    return null;
  }

  const title =
    readMeta(html, ['og:title']) ||
    decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const summary =
    readMeta(html, ['og:description', 'description', 'twitter:description', 'keywords']) || '';
  // 先只审 meta：摘要足够长且不含错误特征时直接采用
  const metaText = clip([title.trim(), summary.trim()].filter(Boolean).join(' '));
  if (metaText.length >= 40 && !isErrorPage(finalUrl, metaText)) return metaText;

  // 摘要不足（常见于分享页只有站点标题）再补页面可见文本
  const body = clip(visibleText(html));
  const merged = clip([metaText, body].filter(Boolean).join(' '));
  if (isErrorPage(finalUrl, merged.slice(0, 800))) return null;
  return merged.length >= MIN_USEFUL_TEXT ? merged : null;
}
