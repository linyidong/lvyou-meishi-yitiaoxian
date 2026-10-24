import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { QUOTA_ERROR } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { getAppSettings } from '@/lib/app-settings';
import { bumpOcrUsage, getOcrUsage } from '@/lib/ocr-usage';
import { createClient } from '@/lib/supabase/server';
import { OcrError, ocrImageBase64, readOcrEnv, sniffImageMime } from '@/lib/tencent-ocr';

/**
 * T-044 图片识别（OCR）→ 文本：仅登录用户。
 * 入参二选一：
 * - multipart/form-data 的 file 字段（前端首选）
 * - JSON { imageBase64 }（允许带 data URI 前缀）
 * 校验：真实格式为 jpeg/png/webp（按魔数嗅探）、大小 ≤ 7MB、每人每日 OCR_DAILY_LIMIT 次。
 * 返回 { ok: true, text, lineCount }；识别文本回填前端文本框后复用 /api/ai/extract 流程。
 * 图片只在内存 Buffer 中处理一次：绝不写文件、不进 Storage、不入库（任务卡铁律）。
 * 限额计数走 lib/ocr-usage.ts 持久化计数（T-048：user_daily_usage kind='ocr'，
 * 迁移 031 已放宽约束；重启不清零、多实例共享，修复 known-issues A9）。
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: 'UNAUTHORIZED', error: MESSAGES.HOME_IMPORT.imageNeedLogin },
      { status: 401 },
    );
  }

  // T-049 业务开关：关闭「图片识别」时直接 403（鉴权后即拦截，不消耗限额）
  const settings = await getAppSettings();
  if (!settings.flags.ocrEnabled) {
    return NextResponse.json(
      { ok: false, code: 'OCR_DISABLED', error: MESSAGES.OCR_FEATURE_DISABLED },
      { status: 403 },
    );
  }

  // env 缺凭证：快速失败返回可读错误（503），不进入 OCR 调用也不消耗限额
  if (!readOcrEnv()) {
    return NextResponse.json(
      { ok: false, code: 'OCR_NOT_CONFIGURED', error: MESSAGES.HOME_IMPORT.imageNotConfigured },
      { status: 503 },
    );
  }

  // 解析入参：multipart file 优先，其次 JSON imageBase64；统一转成内存 Buffer 校验
  let buf: Buffer | null = null;
  let declaredMime = '';
  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json(
          { ok: false, code: 'NO_FILE', error: MESSAGES.HOME_IMPORT.imageNoFile },
          { status: 400 },
        );
      }
      declaredMime = file.type;
      buf = Buffer.from(await file.arrayBuffer());
    } else {
      const body = (await request.json()) as { imageBase64?: string };
      const b64 = (body.imageBase64 ?? '').trim();
      if (!b64) {
        return NextResponse.json(
          { ok: false, code: 'NO_FILE', error: MESSAGES.HOME_IMPORT.imageNoFile },
          { status: 400 },
        );
      }
      buf = Buffer.from(b64.replace(/^data:[^;]*;base64,/, ''), 'base64');
    }
  } catch {
    return NextResponse.json(
      { ok: false, code: 'BAD_REQUEST', error: MESSAGES.HOME_IMPORT.imageNoFile },
      { status: 400 },
    );
  }

  if (!buf || buf.length === 0) {
    return NextResponse.json(
      { ok: false, code: 'NO_FILE', error: MESSAGES.HOME_IMPORT.imageNoFile },
      { status: 400 },
    );
  }
  if (buf.length > BUSINESS.MAX_OCR_IMAGE_BYTES) {
    return NextResponse.json(
      { ok: false, code: 'IMAGE_TOO_LARGE', error: MESSAGES.HOME_IMPORT.imageTooLarge },
      { status: 400 },
    );
  }
  // 魔数为准；multipart 声明了非 image/* 的 MIME 也直接拒绝
  const mime = sniffImageMime(buf);
  if (!mime || (declaredMime !== '' && !declaredMime.startsWith('image/'))) {
    return NextResponse.json(
      { ok: false, code: 'IMAGE_TYPE_UNSUPPORTED', error: MESSAGES.HOME_IMPORT.imageBadType },
      { status: 400 },
    );
  }

  // 每日限额（T-049：上限取后台全局设置，缺省回退 config/business.ts；识别成功才计数；超限 429）
  const used = await getOcrUsage(user.id);
  const limit = settings.quotas.ocrDailyLimit;
  if (used >= limit) {
    return NextResponse.json(
      { ok: false, code: QUOTA_ERROR.OCR_DAILY_LIMIT, error: MESSAGES.HOME_IMPORT.imageQuota(limit) },
      { status: 429 },
    );
  }

  try {
    const { text, lineCount } = await ocrImageBase64(buf.toString('base64'));
    await bumpOcrUsage(user.id);
    return NextResponse.json({ ok: true, text, lineCount });
  } catch (err) {
    const code = err instanceof OcrError ? err.code : 'OCR_FAILED';
    const message =
      code === 'OCR_NOT_CONFIGURED'
        ? MESSAGES.HOME_IMPORT.imageNotConfigured
        : err instanceof Error && (code === 'OCR_TIMEOUT' || code === 'OCR_NETWORK_ERROR')
          ? err.message
          : MESSAGES.HOME_IMPORT.imageFailed;
    const status = code === 'OCR_NOT_CONFIGURED' ? 503 : 502;
    // code 透传腾讯云 Error.Code（如 InvalidParameter），便于排查；message 给用户可读文案
    return NextResponse.json({ ok: false, code, error: message }, { status });
  }
}
