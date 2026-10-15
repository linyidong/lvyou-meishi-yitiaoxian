import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** 在线心跳（技术方案 v1.1 §4.7）：更新 users.last_seen_at / current_path */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let currentPath: string | null = null;
  try {
    const body = (await request.json()) as { path?: string };
    currentPath = body.path?.trim() || null;
  } catch {
    // 空 body 视为只刷新 last_seen_at
  }

  const { error } = await supabase
    .from('users')
    .update({ last_seen_at: new Date().toISOString(), current_path: currentPath })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
