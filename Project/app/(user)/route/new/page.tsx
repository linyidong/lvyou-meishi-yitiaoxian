import { createClient } from '@/lib/supabase/server';
import { RouteNewClient } from '@/components/route/RouteNewClient';

/** U05 新建路线：城市 + 出行设置（出发城市 / 城际交通 / 终点住宿，本期新增） */
export default async function RouteNewPage({
  searchParams,
}: {
  searchParams: { city?: string };
}) {
  const supabase = createClient();
  const { data: cities } = await supabase.from('cities').select('id,name').order('name');

  return <RouteNewClient cities={cities ?? []} initialCityParam={searchParams.city ?? null} />;
}
