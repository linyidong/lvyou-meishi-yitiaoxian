import { CitySelectClient, type CityDraft, type CityOption } from '@/components/city/CitySelectClient';
import { FlowSteps } from '@/components/route/FlowSteps';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * 游客态下「库内已有数据」的城市清单。
 * 口径与 /api/try/city-places 一致：库内存在 is_collected=true 且坐标非空的地点。
 * places 是跨用户的私有数据（RLS 只允许 owner 读），因此用 service_role 读取，且只取城市名。
 * 查询失败时降级为「全部城市可点」，避免把整页城市误置灰导致游客无从选择。
 */
async function dataCityNamesOf(cities: CityOption[]): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('places')
      .select('city_id')
      .eq('is_collected', true)
      .not('lat', 'is', null)
      .not('lng', 'is', null);
    if (error) throw error;

    const ids = new Set(
      (data ?? [])
        .map((row) => row.city_id)
        .filter((id): id is string => typeof id === 'string' && id !== ''),
    );
    return cities.filter((c) => ids.has(c.id)).map((c) => c.name);
  } catch (err) {
    console.warn('[city] 城市数据可用性查询失败，按「全部可点」降级：', err);
    return cities.map((c) => c.name);
  }
}

/** U04 选择城市：城市数据来自 cities 字典表（服务端查询），并带出未完成路线用于草稿提示 */
export default async function CityPage() {
  const supabase = createClient();
  const selectCities = () => supabase.from('cities').select('id,name,adcode').order('name');

  // 自建 Supabase 网关偶发会挂起首个查询（超 5s 触发 lib/supabase/fetch.ts 的超时），
  // 单次失败就整页落「城市列表加载失败」态太脆；这里重试一次再降级。
  let { data, error } = await selectCities();
  if (error) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    ({ data, error } = await selectCities());
  }

  if (error) {
    return (
      <>
        <FlowSteps current={1} />
        <div className="pt-6 md:pt-10">
          <CitySelectClient cities={[]} error />
        </div>
      </>
    );
  }

  const cities: CityOption[] = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    adcode: c.adcode ?? '',
  }));

  const {
    data: { user },
  } = await supabase.auth.getUser();
  /** 未登录 = 游客模式：只能挑库内已有数据的城市试用，其次级目的地与草稿提示都不适用 */
  const guest = !user;

  // 未完成路线 = 尚未生成按天顺序（route_places 为空）的最近一条路线；未登录时为空
  let draft: CityDraft | null = null;

  if (user) {
    const { data: routes } = await supabase
      .from('routes')
      .select('id,title,route_places(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const unfinished = (routes ?? []).find((row) => {
      const list = (row as { route_places?: { count: number }[] }).route_places;
      return Array.isArray(list) && (list[0]?.count ?? 0) === 0;
    });

    if (unfinished) draft = { id: unfinished.id, title: unfinished.title };
  }

  const dataCityNames = guest ? await dataCityNamesOf(cities) : [];

  return (
    <>
      <FlowSteps current={1} />
      <div className="pt-6 md:pt-10">
        <CitySelectClient
          cities={cities}
          draft={draft}
          guest={guest}
          dataCityNames={dataCityNames}
        />
      </div>
    </>
  );
}
