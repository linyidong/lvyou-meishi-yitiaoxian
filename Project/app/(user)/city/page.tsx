import { CitySelectClient, type CityDraft, type CityOption } from '@/components/city/CitySelectClient';
import { FlowSteps } from '@/components/route/FlowSteps';
import { createClient } from '@/lib/supabase/server';

/** U04 选择城市：城市数据来自 cities 字典表（服务端查询），并带出未完成路线用于草稿提示 */
export default async function CityPage() {
  const supabase = createClient();
  const { data, error } = await supabase.from('cities').select('id,name,adcode').order('name');

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

  // 未完成路线 = 尚未生成按天顺序（route_places 为空）的最近一条路线；未登录时为空
  let draft: CityDraft | null = null;
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  return (
    <>
      <FlowSteps current={1} />
      <div className="pt-6 md:pt-10">
        <CitySelectClient cities={cities} draft={draft} />
      </div>
    </>
  );
}
