import { describe, expect, it } from 'vitest';
import { parseShareToken } from '@/lib/share-token';

/**
 * T-041 单元测试：分享 token 解析纯函数（lib/share-token.ts）。
 * 口径：完整 URL / 相对路径 /share/<token> / 纯 token 均可解析；
 * 忽略 query、hash、首尾空格；非法输入返回 null。
 */

describe('parseShareToken 正例', () => {
  it('完整分享 URL（带 query 与 hash）→ token', () => {
    expect(parseShareToken('https://example.com/share/Ab3-xYz9_123?from=qr#top')).toBe(
      'Ab3-xYz9_123',
    );
  });

  it('相对路径 /share/<token> → token', () => {
    expect(parseShareToken('/share/xyz123456')).toBe('xyz123456');
  });

  it('纯 token（首尾空格）→ token', () => {
    expect(parseShareToken('  aB3-xYz9  ')).toBe('aB3-xYz9');
  });
});

describe('parseShareToken 反例', () => {
  it('空串 / 纯空白 → null', () => {
    expect(parseShareToken('')).toBeNull();
    expect(parseShareToken('   ')).toBeNull();
  });

  it('非 share 路径或含非法字符 → null', () => {
    expect(parseShareToken('https://example.com/routes/12345')).toBeNull();
    expect(parseShareToken('not a token!!')).toBeNull();
  });
});
