import { createClient } from '@/lib/supabase/server';
import { getQuotaProfile } from '@/lib/member-quota';
import { getAppSettings } from '@/lib/app-settings';
import { BUSINESS } from '@/config/business';
import { FlowSteps } from '@/components/route/FlowSteps';
import { RouteNewClient } from '@/components/route/RouteNewClient';

/** U05 新建路线：城市 + 出行设置（出发城市 / 城际交通 / 终点住宿，本期新增） */
export default async function RouteNewPage({
  searchParams,
}: {
  searchParams: { city?: string; dest?: string };
}) {
  const supabase = createClient();
  const { data: cities } = await supabase.from('cities').select('id,name').order('name');

  // 阶段 2 会员分层：按角色在页面上动态展示天数 / 地点数上限（服务端另做强制校验）
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const quota = user ? await getQuotaProfile(user.id) : { tier: 'free' as const, trialMultiDayUsed: false };

  // T-052：档位配额说明数字改从全局设置读取（管理端保存后本页文案同步）；
  // 会员天数上限暂无设置项，仍取 BUSINESS 常量传入。
  const { quotas } = await getAppSettings();

  return (
    <>
      <FlowSteps current={2} />
      <div className="pt-6 md:pt-10">
        <RouteNewClient
          cities={cities ?? []}
          initialCityParam={searchParams.city ?? null}
          initialDestParam={searchParams.dest ?? null}
          tier={quota.tier}
          trialMultiDayUsed={quota.trialMultiDayUsed}
          quotaHints={{
            freePlacesPerDay: quotas.freePlacesPerDay,
            memberPlacesPerDay: quotas.memberPlacesPerDay,
            memberMaxDays: BUSINESS.MEMBER_MAX_DAYS,
          }}
        />
      </div>
    </>
  );
}
