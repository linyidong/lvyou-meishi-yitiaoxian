import { NextResponse, type NextRequest } from 'next/server';
import { findFeedbackFeature } from '@/config/feedback';
import { MESSAGES } from '@/config/messages';
import { createClient } from '@/lib/supabase/server';

/** T-098 提交功能建议：登录用户可为自己的账号写入一条 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: MESSAGES.LOGIN_FIRST }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const pageKey = typeof body.pageKey === 'string' ? body.pageKey.trim() : '';
  const featureKey = typeof body.featureKey === 'string' ? body.featureKey.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';

  if (!findFeedbackFeature(pageKey, featureKey)) {
    return NextResponse.json({ ok: false, message: MESSAGES.FEEDBACK.selectRequired }, { status: 400 });
  }
  if (content.length === 0) {
    return NextResponse.json({ ok: false, message: MESSAGES.FEEDBACK.contentRequired }, { status: 400 });
  }
  if (content.length < 5) {
    return NextResponse.json({ ok: false, message: MESSAGES.FEEDBACK.tooShort(content.length) }, { status: 400 });
  }
  if (content.length > 1000) {
    return NextResponse.json({ ok: false, message: MESSAGES.FEEDBACK.tooLong }, { status: 400 });
  }

  const { error } = await supabase.from('feedback').insert({
    user_id: user.id,
    page_key: pageKey,
    feature_key: featureKey,
    content,
  });
  if (error) {
    return NextResponse.json({ ok: false, message: MESSAGES.FEEDBACK.fail }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** 我最近提交的建议（只读自己的，RLS 兜底） */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: MESSAGES.LOGIN_FIRST }, { status: 401 });
  }
  const { data, error } = await supabase
    .from('feedback')
    .select('id,page_key,feature_key,content,status,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) {
    return NextResponse.json({ ok: false, message: MESSAGES.FEEDBACK.fail }, { status: 500 });
  }
  return NextResponse.json({ ok: true, items: data ?? [] });
}
