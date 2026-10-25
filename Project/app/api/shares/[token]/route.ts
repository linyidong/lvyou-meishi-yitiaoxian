import { NextResponse, type NextRequest } from 'next/server';
import { MESSAGES } from '@/config/messages';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { RouteShareSnapshot } from '@/types';

/** T-060 预览最多返回的地点条数 */
const PREVIEW_PLACES = 8;

/**
 * T-060 导入分享路线·预览接口（登录用户可访问，只读）：
 * GET /api/shares/[token]
 * - 只读 route_shares.snapshot，不写库、不累加 view_count、不占任何额度；
 *   实际导入仍走 POST /api/shares/[token]/import（会员专属 + 额度校验在那一侧）。
 * - 返回精简快照 { ok, snapshot: { title, cityName, days, placeCount, places: 前 8 个 {name,type}, exportedAt } }
 * - 失效处理：token 不存在 → 404；已被作者关闭（revoked_at 非空）→ 410；未登录 → 401。
 */
export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: MESSAGES.LOGIN_FIRST }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    // 不过滤 revoked_at：需要区分「不存在（404）」与「已关闭（410）」
    const { data, error } = await admin
      .from('route_shares')
      .select('token,revoked_at,snapshot')
      .eq('token', params.token)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ ok: false, message: MESSAGES.SHARE.previewFailed }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, message: MESSAGES.SHARE.importNotFound }, { status: 404 });
    }
    if (data.revoked_at) {
      return NextResponse.json({ ok: false, message: MESSAGES.SHARE.revoked }, { status: 410 });
    }

    const snapshot = data.snapshot as RouteShareSnapshot;
    if (!snapshot || !Array.isArray(snapshot.dayPlans)) {
      return NextResponse.json({ ok: false, message: MESSAGES.SHARE.importFailed }, { status: 400 });
    }

    // 按天顺序展平，只取前 PREVIEW_PLACES 个（name/type）
    const places: { name: string; type: string }[] = [];
    for (const day of snapshot.dayPlans) {
      for (const p of day.places ?? []) {
        places.push({ name: p.name, type: p.type });
        if (places.length >= PREVIEW_PLACES) break;
      }
      if (places.length >= PREVIEW_PLACES) break;
    }

    return NextResponse.json({
      ok: true,
      snapshot: {
        title: snapshot.title,
        cityName: snapshot.cityName,
        days: snapshot.days,
        placeCount: snapshot.totalPlaces ?? places.length,
        places,
        exportedAt: snapshot.exportedAt,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.SHARE.previewFailed }, { status: 500 });
  }
}
