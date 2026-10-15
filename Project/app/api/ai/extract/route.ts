import { NextResponse, type NextRequest } from 'next/server';
import { MESSAGES } from '@/config/messages';
import { extractPlaces } from '@/lib/deepseek';

const URL_ONLY_PATTERN = /^https?:\/\/\S+$/i;

/** AI 提取地点（技术方案 v1.1 §4.3）：未登录也可试用（B08） */
export async function POST(request: NextRequest) {
  let text = '';
  try {
    const body = (await request.json()) as { text?: string };
    text = (body.text ?? '').trim();
  } catch {
    return NextResponse.json({ ok: false, error: MESSAGES.NETWORK_ERROR }, { status: 400 });
  }

  if (!text || URL_ONLY_PATTERN.test(text)) {
    return NextResponse.json({ ok: false, error: MESSAGES.LINK_NEED_TEXT }, { status: 400 });
  }

  try {
    const places = await extractPlaces(text);
    return NextResponse.json({ ok: true, places });
  } catch {
    return NextResponse.json({ ok: false, error: MESSAGES.AI_FAILED }, { status: 502 });
  }
}
