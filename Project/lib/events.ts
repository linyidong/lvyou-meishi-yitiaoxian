'use client';

import { createClient } from '@/lib/supabase/client';
import type { EventName } from '@/types';

/** 埋点（技术方案 v1.1 §4.9）：前端直接写 events 表；未登录或失败都静默跳过。 */
export async function trackEvent(eventName: EventName, metadata?: Record<string, unknown>) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from('events').insert({
      user_id: user.id,
      event_name: eventName,
      metadata: metadata ?? null,
    });
  } catch {
    // 埋点失败不影响主流程
  }
}
