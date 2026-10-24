import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, createHmac } from 'crypto';
import { BUSINESS } from '@/config/business';
import {
  buildAuthorization,
  buildCanonicalRequest,
  buildStringToSign,
  deriveSigningKey,
  hmac,
  sha256Hex,
  sniffImageMime,
  stripDataUriPrefix,
} from '@/lib/tencent-ocr';

/**
 * T-044 单元测试：腾讯云 OCR 手写 TC3-HMAC-SHA256 签名（lib/tencent-ocr.ts）。
 * 交叉验证方式：测试内按官方算法文档独立重写一份签名链（refSignature，直接用 Node crypto，
 * 不调用被测实现），断言 buildAuthorization 输出与之一致；再校验 Authorization 头字段完整性。
 * 另覆盖魔数嗅探 sniffImageMime 与每人每日 OCR 内存限额（lib/ocr-usage.ts）。
 */

/** 独立参考实现：腾讯云 TC3-HMAC-SHA256（签名 v3）算法，逐步对照官方文档 */
function refSignature(secretKey: string, date: string, timestamp: number, payload: string): string {
  const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
  const hm = (key: Buffer | string, msg: string) =>
    createHmac('sha256', key).update(msg, 'utf8').digest();
  const canonicalHeaders = 'content-type:application/json; charset=utf-8\nhost:ocr.tencentcloudapi.com\n';
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    'content-type;host',
    sha(payload),
  ].join('\n');
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    `${date}/ocr/tc3_request`,
    sha(canonicalRequest),
  ].join('\n');
  const kDate = hm(`TC3${secretKey}`, date);
  const kService = hm(kDate, 'ocr');
  const kSigning = hm(kService, 'tc3_request');
  return hm(kSigning, stringToSign).toString('hex');
}

const FIXED = {
  secretId: 'AKIDtestSecretId00000000000000000000',
  secretKey: 'TestSecretKey0000000000000000000000',
  date: '2026-01-15',
  timestamp: 1768442400,
  payload: '{"ImageBase64":"aGVsbG8="}',
};

describe('TC3 签名纯函数', () => {
  it('sha256Hex / hmac 与 Node crypto 直算一致', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(hmac('key', 'The quick brown fox jumps over the lazy dog').toString('hex')).toBe(
      'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8',
    );
  });

  it('buildCanonicalRequest：POST / 无 query，签名头固定 content-type;host', () => {
    const cr = buildCanonicalRequest(FIXED.payload);
    const parts = cr.split('\n');
    expect(parts[0]).toBe('POST');
    expect(parts[1]).toBe('/');
    expect(parts[2]).toBe('');
    expect(parts[3]).toBe('content-type:application/json; charset=utf-8');
    expect(parts[4]).toBe('host:ocr.tencentcloudapi.com');
    expect(parts[6]).toBe('content-type;host');
    expect(parts[7]).toBe(sha256Hex(FIXED.payload));
  });

  it('buildStringToSign：算法 / 时间戳 / 日期-服务-request 作用域 / 规范请求哈希', () => {
    const cr = buildCanonicalRequest(FIXED.payload);
    const sts = buildStringToSign(FIXED.timestamp, FIXED.date, cr);
    const parts = sts.split('\n');
    expect(parts[0]).toBe('TC3-HMAC-SHA256');
    expect(parts[1]).toBe(String(FIXED.timestamp));
    expect(parts[2]).toBe(`${FIXED.date}/ocr/tc3_request`);
    expect(parts[3]).toBe(sha256Hex(cr));
  });

  it('buildAuthorization 与独立参考实现逐字节一致（固定输入 → 固定签名）', () => {
    const { signature } = buildAuthorization(FIXED);
    expect(signature).toBe(refSignature(FIXED.secretKey, FIXED.date, FIXED.timestamp, FIXED.payload));
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it('buildAuthorization：Authorization 头字段完整（Credential / SignedHeaders / Signature）', () => {
    const { authorization, signature } = buildAuthorization(FIXED);
    expect(authorization).toBe(
      `TC3-HMAC-SHA256 Credential=${FIXED.secretId}/${FIXED.date}/ocr/tc3_request, ` +
        `SignedHeaders=content-type;host, Signature=${signature}`,
    );
    // 不同 payload 必须产生不同签名（签名覆盖请求体）
    const other = buildAuthorization({ ...FIXED, payload: '{"ImageBase64":"d29ybGQ="}' });
    expect(other.signature).not.toBe(signature);
  });

  it('deriveSigningKey：密钥链不含 SecretKey 原文（hex 长度 32 字节）', () => {
    const key = deriveSigningKey(FIXED.secretKey, FIXED.date);
    expect(key.length).toBe(32);
  });
});

describe('sniffImageMime 魔数嗅探', () => {
  it('识别 jpeg / png / webp，拒绝 gif 与纯文本', () => {
    expect(sniffImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe('image/jpeg');
    expect(
      sniffImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])),
    ).toBe('image/png');
    const webp = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x10, 0x00, 0x00, 0x00]),
      Buffer.from('WEBP'),
      Buffer.from([0x00]),
    ]);
    expect(sniffImageMime(webp)).toBe('image/webp');
    expect(sniffImageMime(Buffer.from('GIF89a'))).toBeNull();
    expect(sniffImageMime(Buffer.from('hello world'))).toBeNull();
    expect(sniffImageMime(Buffer.alloc(0))).toBeNull();
  });
});

describe('stripDataUriPrefix', () => {
  it('剥离 data URI 前缀，纯 base64 原样返回', () => {
    expect(stripDataUriPrefix('data:image/png;base64,aGVsbG8=')).toBe('aGVsbG8=');
    expect(stripDataUriPrefix('aGVsbG8=')).toBe('aGVsbG8=');
  });
});

/**
 * T-048 OCR 用量持久化（lib/ocr-usage.ts）：mock service_role 客户端，
 * 用内存 Map 模拟 user_daily_usage（kind='ocr'）与迁移 020 的两个 RPC，
 * 覆盖累加返回值 / 用户隔离 / 跨天清零 / 计数失败降级放行 / 本月求和。
 */
const usageStore = vi.hoisted(() => ({
  /** key = `${userId}|${day}`，value = count（模拟 user_daily_usage 单行） */
  rows: new Map<string, number>(),
  /** true = 所有 rpc / 查询失败（模拟 Supabase 不可用，验证降级放行） */
  fail: false,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async (fn: string, args: Record<string, string | number>) => {
      if (usageStore.fail) throw new Error('mock supabase down');
      const key = `${args.p_user_id}|${args.p_day}`;
      if (fn === 'get_user_daily_usage') {
        return { data: usageStore.rows.get(key) ?? 0, error: null };
      }
      if (fn === 'bump_user_daily_usage') {
        usageStore.rows.set(key, (usageStore.rows.get(key) ?? 0) + Number(args.p_count));
        return { data: null, error: null };
      }
      throw new Error(`unexpected rpc: ${fn}`);
    },
    from: () => {
      const filters: Array<[string, string]> = [];
      const builder = {
        select: () => builder,
        eq: (col: string, val: string) => {
          filters.push([col, val]);
          return builder;
        },
        gte: (col: string, val: string) => {
          filters.push([col, val]);
          return builder;
        },
        then: (resolve: (v: { data: unknown; error: Error | null }) => void) => {
          if (usageStore.fail) {
            resolve({ data: null, error: new Error('mock supabase down') });
            return;
          }
          const minDay = filters.find(([c]) => c === 'day')?.[1] ?? '0000-01-01';
          const data: Array<{ count: number }> = [];
          for (const [k, v] of usageStore.rows) {
            const day = k.split('|')[1];
            if (day >= minDay) data.push({ count: v });
          }
          resolve({ data, error: null });
        },
      };
      return builder;
    },
  }),
}));

/** 模块内部无状态（计数在 mock 的 store 里），仍沿用 resetModules + 动态 import 拿新模块 */
type UsageModule = typeof import('@/lib/ocr-usage');

async function freshUsageModule(): Promise<UsageModule> {
  vi.resetModules();
  return import('@/lib/ocr-usage');
}

beforeEach(() => {
  usageStore.rows.clear();
  usageStore.fail = false;
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-15T10:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ocr-usage 每人每日限额（DB 持久化，T-048）', () => {
  it('每日上限取 BUSINESS.OCR_DAILY_LIMIT（20）', async () => {
    const { ocrDailyLimit } = await freshUsageModule();
    expect(ocrDailyLimit()).toBe(BUSINESS.OCR_DAILY_LIMIT);
    expect(BUSINESS.OCR_DAILY_LIMIT).toBe(20);
  });

  it('同一用户累加到上限（第 20 次 bump 返回 20，getOcrUsage=20）', async () => {
    const { bumpOcrUsage, getOcrUsage } = await freshUsageModule();
    for (let i = 1; i <= 20; i++) {
      expect(await bumpOcrUsage('user-a')).toBe(i);
    }
    expect(await getOcrUsage('user-a')).toBe(20);
  });

  it('不同用户互不影响', async () => {
    const { bumpOcrUsage, getOcrUsage } = await freshUsageModule();
    await bumpOcrUsage('user-a');
    await bumpOcrUsage('user-a');
    expect(await getOcrUsage('user-b')).toBe(0);
  });

  it('跨天自动清零（按服务器本地日期口径，day 桶键变化）', async () => {
    const { bumpOcrUsage, getOcrUsage } = await freshUsageModule();
    await bumpOcrUsage('user-a');
    expect(await getOcrUsage('user-a')).toBe(1);
    vi.setSystemTime(new Date('2026-01-16T00:00:01'));
    expect(await getOcrUsage('user-a')).toBe(0);
  });

  it('计数失败降级放行：读返回 0、累加不抛错', async () => {
    const { bumpOcrUsage, getOcrUsage } = await freshUsageModule();
    usageStore.fail = true;
    expect(await getOcrUsage('user-a')).toBe(0);
    expect(await bumpOcrUsage('user-a')).toBe(0);
  });

  it('本月求和：只计 day >= 本月 1 日的行（上月旧行不计入）', async () => {
    const { bumpOcrUsage, getOcrMonthlyUsage } = await freshUsageModule();
    await bumpOcrUsage('user-a'); // 2026-01-15
    await bumpOcrUsage('user-b');
    vi.setSystemTime(new Date('2026-01-20T10:00:00'));
    await bumpOcrUsage('user-a'); // 本月第 3 次
    usageStore.rows.set('user-c|2025-12-31', 5); // 上月行，不应计入
    expect(await getOcrMonthlyUsage()).toBe(3);
  });
});
