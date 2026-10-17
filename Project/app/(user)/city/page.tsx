import { CitySelectClient, type CityOption } from '@/components/city/CitySelectClient';
import { createClient } from '@/lib/supabase/server';

/** U04 选择城市：城市数据来自 cities 字典表（服务端查询） */
export default async function CityPage() {
  const supabase = createClient();
  const { data, error } = await supabase.from('cities').select('id,name,adcode').order('name');

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="font-semibold text-red-800">城市列表加载失败</p>
        <p className="mt-1 text-sm text-red-700">{error.message}</p>
      </div>
    );
  }

  const cities: CityOption[] = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    adcode: c.adcode ?? '',
  }));

  return <CitySelectClient cities={cities} />;
}
