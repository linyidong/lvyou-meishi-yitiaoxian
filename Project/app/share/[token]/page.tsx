import Link from 'next/link';
import { LinkIcon, TriangleAlert } from 'lucide-react';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { ROUTES } from '@/config/routes';
import { SharePosterCard, type SharePosterView } from '@/components/share/SharePosterCard';
import { ShareReloadButton } from '@/components/share/ShareReloadButton';
import { ShareViewClient } from '@/components/share/ShareViewClient';
import { getQuotaProfile } from '@/lib/member-quota';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { RouteShareSnapshot } from '@/types';

/**
 * T-007 F-52 分享分级：非会员/游客的最小视图模型（服务端裁剪）。
 * 仅保留海报展示所需字段；坐标、地址、行程方式、住宿信息一律不下发。
 */
function buildPosterView(snapshot: RouteShareSnapshot): SharePosterView {
  return {
    title: snapshot.title ?? '',
    cityName: snapshot.cityName ?? null,
    days: snapshot.days ?? 1,
    totalPlaces: snapshot.totalPlaces ?? 0,
    dayPlans: (snapshot.dayPlans ?? []).map((day) => ({
      dayIndex: day.dayIndex,
      places: (day.places ?? []).map((place) => ({ name: place.name, type: place.type })),
    })),
    exportedAt: snapshot.exportedAt ?? '',
  };
}

/**
 * 阶段 3 公开分享页（服务端组件，位于 app/share 下，不套用户端布局）。
 * 数据源 route_shares（无 RLS 策略，只能服务端 admin 客户端读取）。
 */
export default async function SharePage({ params }: { params: { token: string } }) {
  let share: { token: string; snapshot: unknown; view_count: number } | null = null;
  /** T-017 C9：查询异常/超时（loadFailed）与「查无记录」（notFound）必须分开，超时不能说链接失效 */
  let loadFailed = false;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('route_shares')
      .select('token,snapshot,view_count')
      .eq('token', params.token)
      .is('revoked_at', null)
      .maybeSingle();
    if (error) {
      loadFailed = true;
    } else {
      share = data ?? null;
    }
  } catch {
    // noStoreFetch 超时（TimeoutError）或网络错误：属「加载失败」，不是「链接失效」
    loadFailed = true;
  }

  if (loadFailed) {
    return (
      <main className="grid min-h-screen place-items-center bg-stone-100 px-4">
        <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <TriangleAlert className="mx-auto h-12 w-12 text-amber-400" />
          <p className="mt-3 font-semibold text-stone-900">{MESSAGES.SHARE.loadFailedTitle}</p>
          <p className="mt-1 text-sm text-stone-500">{MESSAGES.SHARE.loadFailedDesc}</p>
          <ShareReloadButton />
        </div>
      </main>
    );
  }

  const snapshot = (share?.snapshot ?? null) as RouteShareSnapshot | null;

  if (!share || !snapshot || !Array.isArray(snapshot.dayPlans)) {
    return (
      <main className="grid min-h-screen place-items-center bg-stone-100 px-4">
        <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <LinkIcon className="mx-auto h-12 w-12 text-stone-300" />
          <p className="mt-3 font-semibold text-stone-900">{MESSAGES.SHARE.linkInvalidTitle}</p>
          <p className="mt-1 text-sm text-stone-500">{MESSAGES.SHARE.linkInvalidDesc}</p>
          <Link
            href={ROUTES.HOME}
            className="mt-5 inline-flex h-10 items-center rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-5 text-sm font-semibold text-white hover:brightness-110"
          >
            {MESSAGES.SHARE.backHome}
          </Link>
        </div>
      </main>
    );
  }

  // 浏览计数 +1（失败静默）
  try {
    const admin = createAdminClient();
    await admin
      .from('route_shares')
      .update({ view_count: (share.view_count ?? 0) + 1 })
      .eq('token', params.token);
  } catch {
    // 忽略
  }

  // 访问者档位：未登录视为 free
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let loggedIn = false;
  let canImport = false;
  let viewerTier: 'admin' | 'member' | 'free' = 'free';
  if (user) {
    loggedIn = true;
    const profile = await getQuotaProfile(user.id);
    viewerTier = profile.tier;
    canImport = profile.tier !== 'free';
  }

  // T-007 F-52 分享分级：非会员/游客只看海报图片（服务端裁剪，敏感字段不下发）
  if (viewerTier === 'free') {
    return (
      <main className="min-h-screen bg-stone-100 pb-10">
        <SharePosterCard
          view={buildPosterView(snapshot)}
          loggedIn={loggedIn}
          productName={PRODUCT.NAME}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 pb-10">
      <ShareViewClient
        token={params.token}
        snapshot={snapshot}
        loggedIn={loggedIn}
        canImport={canImport}
        viewerTier={viewerTier}
        productName={PRODUCT.NAME}
      />
    </main>
  );
}
