import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { QUOTA_ERROR, USAGE_KIND } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { getAppSettings } from '@/lib/app-settings';
import { ensureCityInDb } from '@/lib/city-ensure';
import { extractPlacesAndCity } from '@/lib/deepseek';
import {
  GUEST_COOKIE,
  checkGuestRateLimit,
  guestCookieOptions,
  resolveGuestKey,
} from '@/lib/guest-rate-limit';
import { fetchTextFromUrl, firstUrlIn, isUrlOnly } from '@/lib/link-fetch';
import {
  bumpDailyUsage,
  getDailyUsage,
  getQuotaProfile,
  limitsOf,
  type MemberTier,
} from '@/lib/member-quota';
import { createClient } from '@/lib/supabase/server';

/**
 * AI 提取地点（技术方案 v1.1 §4.3）：未登录也可试用（B08）。
 * 入参二选一：
 * - { text }  分享文案（正文里带链接也可：会额外尝试抓一次链接正文并与文案合并）
 * - { url }   分享链接（xhslink / v.douyin 等短链，服务端跟随 302 后抓正文）
 * 链接读不到内容时返回 LINK_NEED_TEXT；文案+链接混输时返回 linkReadFailed 供前端提示。
 */
export async function POST(request: NextRequest) {
  // T-049 业务开关：关闭「导入地点」时直接 403（不解析入参、不调用 DeepSeek）
  const settings = await getAppSettings();
  if (!settings.flags.importEnabled) {
    return NextResponse.json({ ok: false, error: MESSAGES.IMPORT_FEATURE_DISABLED }, { status: 403 });
  }

  let body: { text?: string; url?: string };
  try {
    body = (await request.json()) as { text?: string; url?: string };
  } catch {
    return NextResponse.json({ ok: false, error: MESSAGES.NETWORK_ERROR }, { status: 400 });
  }

  let text = (body.text ?? '').trim();
  let url = (body.url ?? '').trim();
  /** 文案里带链接、但链接正文没读到：告知前端，便于给出「补全正文」的提示 */
  let linkReadFailed = false;

  // 前端只传了文案时：文案里「几乎只有链接」→ 按链接方式处理；
  // 文案 + 链接混输 → 也尝试抓一次链接正文并合并，两者互补（读不到则静默回退到文案）
  if (!url && text) {
    const found = firstUrlIn(text);
    if (found) {
      if (isUrlOnly(text)) {
        url = found;
        text = '';
      } else {
        const fetched = await fetchTextFromUrl(found);
        if (fetched) {
          text = `${text}\n${fetched}`.slice(0, BUSINESS.MAX_IMPORT_TEXT_LENGTH);
        } else {
          linkReadFailed = true;
        }
      }
    }
  }

  if (url) {
    const fetched = await fetchTextFromUrl(url);
    if (!fetched) {
      return NextResponse.json({ ok: false, error: MESSAGES.LINK_NEED_TEXT }, { status: 422 });
    }
    text = fetched;
  }

  if (!text) {
    return NextResponse.json({ ok: false, error: MESSAGES.LINK_NEED_TEXT }, { status: 400 });
  }
  if (text.length > BUSINESS.MAX_IMPORT_TEXT_LENGTH) {
    return NextResponse.json({ ok: false, error: MESSAGES.IMPORT_TEXT_TOO_LONG }, { status: 400 });
  }

  // ==================== 阶段 2 会员分层：AI 提取每日限额（服务端强制） ====================
  // 登录用户按档位校验（免费 10 次/日、会员 20 次/日，管理员不限）；
  // 未登录访客按 B08 允许试用，但不能无限刷 DeepSeek 额度：按 IP 日限流
  // （无代理头时 lib/guest-rate-limit.ts 回落到访客标识 cookie 计数）。
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let tier: MemberTier | null = null;
  /** 访客首次访问时补发的标识 cookie（登录用户恒为 null） */
  let newGuestId: string | null = null;
  /** 统一出口：访客补发标识 cookie，保证限流按浏览器区分而不是全站共用 */
  const respond = (body: unknown, status = 200) => {
    const res = NextResponse.json(body, { status });
    if (newGuestId) res.cookies.set(GUEST_COOKIE, newGuestId, guestCookieOptions());
    return res;
  };

  if (user) {
    const profile = await getQuotaProfile(user.id);
    tier = profile.tier;
    const limits = limitsOf(profile.tier);
    if (profile.tier !== 'admin') {
      const used = await getDailyUsage(user.id, USAGE_KIND.AI_EXTRACT);
      if (used >= limits.aiExtract) {
        return NextResponse.json(
          {
            ok: false,
            code: QUOTA_ERROR.AI_EXTRACT_DAILY_LIMIT,
            error: MESSAGES.AI_EXTRACT_DAILY_LIMIT_REACHED(limits.aiExtract),
          },
          { status: 429 },
        );
      }
    }
  } else {
    const guest = resolveGuestKey(request);
    newGuestId = guest.newGuestId;
    const rate = checkGuestRateLimit(guest.key, 'ai-extract');
    if (!rate.ok) {
      return respond({ ok: false, error: MESSAGES.AI_EXTRACT_GUEST_LIMIT_REACHED }, 429);
    }
  }

  try {
    // 先识别文案里的城市，再返回该城市下的地点（收藏时按 city 归集）
    const { city, places } = await extractPlacesAndCity(text);
    // T-043：登录用户在「识别阶段」就把城市入库（lib/city-ensure 幂等，收藏时 api/places 仍兜底）；
    // 游客只读不写库（任务卡：guest 场景不写），保持 T-042 行为——提示「将作为新城市加入城市库」
    let cityInDb = true;
    let cityId: string | null = null;
    let cityIsNew = false;
    if (city) {
      if (user) {
        const ensured = await ensureCityInDb(city);
        if (ensured) {
          cityId = ensured.id;
          cityIsNew = ensured.isNew;
        } else {
          // 写库失败：不阻断提取，收藏链路（api/places）仍会重试入库
          cityInDb = false;
        }
      } else {
        const { data: cityRow } = await supabase
          .from('cities')
          .select('id')
          .eq('name', city)
          .maybeSingle();
        cityInDb = Boolean(cityRow);
      }
    }
    // 成功后才计数（仅登录用户；管理员不计数）；失败不计入
    if (user && tier !== 'admin') {
      await bumpDailyUsage(user.id, USAGE_KIND.AI_EXTRACT);
    }
    return respond({ ok: true, city, places, linkReadFailed, cityInDb, cityId, cityIsNew });
  } catch {
    return respond({ ok: false, error: MESSAGES.AI_FAILED }, 502);
  }
}
