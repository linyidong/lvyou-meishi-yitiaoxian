import { TryNewClient } from '@/components/try/TryNewClient';
import { createClient } from '@/lib/supabase/server';

/**
 * R21 游客试用 · 第 1 步：设置路线（免登录）。
 * 城市数据来自 cities 字典表（服务端查询，公开可读）；行程设置写入 sessionStorage 草稿。
 * ?city=xxx 用于承接「选择城市」页选中的城市（游客链路：/city → 本页）。
 */
export default async function TryNewPage({
  searchParams,
}: {
  searchParams: { city?: string };
}) {
  const supabase = createClient();
  const { data } = await supabase.from('cities').select('id,name,adcode').order('name');

  const cities = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    adcode: c.adcode ?? '',
  }));

  return (
    <div className="pt-2 md:pt-6">
      <TryNewClient cities={cities} initialCityName={searchParams.city?.trim() ?? ''} />
    </div>
  );
}
