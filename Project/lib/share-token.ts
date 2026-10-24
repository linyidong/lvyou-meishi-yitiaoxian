/**
 * T-041 分享 token 解析（纯函数，前后端共用，不依赖任何服务端模块）：
 * 接受完整分享 URL（https://host/share/<token>）、相对路径（/share/<token>）或纯 token，
 * 忽略 query / hash / 首尾空格；解析不出合法 token 时返回 null。
 */

/** token 字符集：base64url 随机串（见 lib/route-share.ts generateShareToken） */
const TOKEN_RE = /^[A-Za-z0-9_-]{4,64}$/;

export function parseShareToken(input: string): string | null {
  let s = (input ?? '').trim();
  if (!s) return null;

  // 先去掉 hash 与 query（纯 token 与 URL 都适用）
  const hashAt = s.indexOf('#');
  if (hashAt !== -1) s = s.slice(0, hashAt);
  const queryAt = s.indexOf('?');
  if (queryAt !== -1) s = s.slice(0, queryAt);
  if (!s) return null;

  // 完整 URL：取 pathname
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) {
    try {
      s = new URL(s).pathname;
    } catch {
      return null;
    }
  }

  // /share/<token>：share 段必须在末尾（前面允许有路径前缀）
  const shareMatch = s.match(/(?:^|\/)share\/([^/]+)$/);
  if (shareMatch) {
    return TOKEN_RE.test(shareMatch[1]) ? shareMatch[1] : null;
  }

  // 纯 token：不含路径分隔符
  if (!s.includes('/')) {
    return TOKEN_RE.test(s) ? s : null;
  }

  return null;
}
