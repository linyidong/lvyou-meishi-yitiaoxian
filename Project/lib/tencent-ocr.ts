import { createHash, createHmac } from 'crypto';
import { getAppSettings } from '@/lib/app-settings';

/**
 * 腾讯云 OCR（仅服务端）：通用文字识别 GeneralBasicOCR，手写 TC3-HMAC-SHA256 签名
 * （Node 内置 crypto，不引入官方 SDK）。T-044 图片识别导入用。
 *
 * 凭证读 Project/.env.local：TENCENT_OCR_SECRET_ID / TENCENT_OCR_SECRET_KEY / TENCENT_OCR_REGION。
 * 图片只在内存中处理（base64），绝不落盘 / 不进 Storage / 不入库。
 *
 * 签名逻辑拆成纯函数（sha256Hex / hmac / buildCanonicalRequest / buildStringToSign /
 * deriveSigningKey / buildAuthorization），tests/unit/tencent-ocr.test.ts 可直接断言。
 */

const OCR_HOST = 'ocr.tencentcloudapi.com';
const OCR_SERVICE = 'ocr';
const OCR_VERSION = '2018-11-19';
const CONTENT_TYPE = 'application/json; charset=utf-8';
/** OCR 请求超时（毫秒）：外部 API 慢响应不拖死上传请求 */
const OCR_TIMEOUT_MS = 20_000;

/**
 * OCR 调用错误。code 取值：
 * - OCR_NOT_CONFIGURED：env 缺凭证（调用方应返回可读错误而不是崩）
 * - OCR_TIMEOUT / OCR_NETWORK_ERROR / OCR_BAD_RESPONSE：网络与响应异常
 * - 其余：腾讯云 Response.Error.Code 原样透传（如 InvalidParameter、FailedOperation）
 */
export class OcrError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'OcrError';
    this.code = code;
  }
}

/** sha256 十六进制小写（TC3 各层哈希统一用 hex） */
export function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

/** HMAC-SHA256，返回原始 Buffer（签名链中间态是 Buffer，末端再 hex） */
export function hmac(key: Buffer | string, msg: string): Buffer {
  return createHmac('sha256', key).update(msg, 'utf8').digest();
}

/**
 * TC3 规范请求串（Canonical Request）：POST /、无 query，
 * 参与签名的头固定为 content-type 与 host（按字典序）。
 */
export function buildCanonicalRequest(payload: string): string {
  const canonicalHeaders = `content-type:${CONTENT_TYPE}\nhost:${OCR_HOST}\n`;
  return ['POST', '/', '', canonicalHeaders, 'content-type;host', sha256Hex(payload)].join('\n');
}

/** TC3 待签名字符串：算法 \n 时间戳 \n 日期/服务/tc3_request \n Hash(规范请求串) */
export function buildStringToSign(timestamp: number, date: string, canonicalRequest: string): string {
  return [
    'TC3-HMAC-SHA256',
    String(timestamp),
    `${date}/${OCR_SERVICE}/tc3_request`,
    sha256Hex(canonicalRequest),
  ].join('\n');
}

/** 派生签名密钥：TC3+SecretKey → date → service → "tc3_request"（四层 HMAC 链） */
export function deriveSigningKey(secretKey: string, date: string): Buffer {
  const kDate = hmac(`TC3${secretKey}`, date);
  const kService = hmac(kDate, OCR_SERVICE);
  return hmac(kService, 'tc3_request');
}

export interface AuthorizationInput {
  secretId: string;
  secretKey: string;
  /** UTC 日期 YYYY-MM-DD（TC3 口径，不是本地日期） */
  date: string;
  /** Unix 秒级时间戳 */
  timestamp: number;
  /** 请求体 JSON 字符串 */
  payload: string;
}

/** 组装 Authorization 头（纯函数：固定输入 → 固定签名，可单测） */
export function buildAuthorization(
  input: AuthorizationInput,
): { authorization: string; signature: string } {
  const canonicalRequest = buildCanonicalRequest(input.payload);
  const stringToSign = buildStringToSign(input.timestamp, input.date, canonicalRequest);
  const signingKey = deriveSigningKey(input.secretKey, input.date);
  const signature = hmac(signingKey, stringToSign).toString('hex');
  const authorization =
    `TC3-HMAC-SHA256 Credential=${input.secretId}/${input.date}/${OCR_SERVICE}/tc3_request, ` +
    `SignedHeaders=content-type;host, Signature=${signature}`;
  return { authorization, signature };
}

/** OCR 调用凭证；env 缺失返回 null，由调用方抛 OCR_NOT_CONFIGURED */
export function readOcrEnv(): { secretId: string; secretKey: string; region: string } | null {
  const secretId = process.env.TENCENT_OCR_SECRET_ID ?? '';
  const secretKey = process.env.TENCENT_OCR_SECRET_KEY ?? '';
  const region = process.env.TENCENT_OCR_REGION ?? '';
  if (!secretId || !secretKey || !region) return null;
  return { secretId, secretKey, region };
}

/** 去掉 data URI 前缀，得到纯 base64（前端可能传完整 data:image/png;base64,...） */
export function stripDataUriPrefix(base64: string): string {
  return base64.replace(/^data:[^;]*;base64,/, '');
}

/**
 * 识别图片文字（腾讯云 GeneralBasicOCR）。
 * @param base64 图片 base64（允许带 data URI 前缀，内部剥离）
 * @returns text：按行拼接的识别文本；lineCount：识别出的文本行数
 */
export async function ocrImageBase64(base64: string): Promise<{ text: string; lineCount: number }> {
  const env = readOcrEnv();
  if (!env) {
    throw new OcrError('OCR_NOT_CONFIGURED', '图片识别服务未配置（缺少 TENCENT_OCR 凭证）');
  }

  // T-053：OCR 接口类型（X-TC-Action）从全局设置读取；该头不参与 TC3 签名，切换即生效
  const { ocrAction } = (await getAppSettings()).ai;

  const payload = JSON.stringify({ ImageBase64: stripDataUriPrefix(base64) });
  const timestamp = Math.floor(Date.now() / 1000);
  // TC3 的 date 必须是 UTC 日期（与官方示例一致），不能用服务器本地日期
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const { authorization } = buildAuthorization({
    secretId: env.secretId,
    secretKey: env.secretKey,
    date,
    timestamp,
    payload,
  });

  let res: Response;
  try {
    res = await fetch(`https://${OCR_HOST}`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': CONTENT_TYPE,
        'X-TC-Action': ocrAction,
        'X-TC-Version': OCR_VERSION,
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Region': env.region,
      },
      body: payload,
      signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
    });
  } catch (err) {
    const name = (err as { name?: string })?.name ?? '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new OcrError('OCR_TIMEOUT', '图片识别超时，请稍后重试');
    }
    throw new OcrError('OCR_NETWORK_ERROR', '无法连接图片识别服务，请稍后重试');
  }

  let json: {
    Response?: {
      Error?: { Code?: string; Message?: string };
      TextDetections?: { DetectedText?: string }[];
    };
  };
  try {
    json = await res.json();
  } catch {
    throw new OcrError('OCR_BAD_RESPONSE', `识别服务返回异常（HTTP ${res.status}）`);
  }

  const r = json.Response ?? {};
  // 腾讯云业务错误：Code 透传给调用方，Message 记日志（英文技术信息不直接展示给用户）
  if (r.Error) {
    console.warn('[tencent-ocr] 腾讯云返回错误：', r.Error.Code, r.Error.Message);
    throw new OcrError(r.Error.Code ?? 'OCR_API_ERROR', '图片识别失败，请稍后重试');
  }
  if (!res.ok) {
    throw new OcrError('OCR_API_ERROR', `图片识别失败（HTTP ${res.status}）`);
  }

  const lines = (r.TextDetections ?? [])
    .map((t) => (t.DetectedText ?? '').trim())
    .filter(Boolean);
  return { text: lines.join('\n'), lineCount: lines.length };
}

/**
 * 按文件魔数嗅探真实图片格式（不完全信任客户端声明的 MIME）。
 * 仅放行任务卡约定的三种：jpeg / png / webp，其余返回 null。
 */
export function sniffImageMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}
