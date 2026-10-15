import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/config/routes';
import { RouteEditClient } from '@/components/route/RouteEditClient';

/** U08 路线编辑：出行设置卡（本期新增） */
export default async function RouteEditPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // middleware.ts 已拦截未登录，这里只做兜底
  if (!user) {
    return (
      <p className="text-sm text-muted-foreground">
        请先
        <Link href={ROUTES.LOGIN} className="text-primary underline">
          登录
        </Link>
        后编辑路线。
      </p>
    );
  }

  const { data: route } = await supabase
    .from('routes')
    .select(
      'id,title,days,transport,city_id,origin_city,intercity_mode,lodging_type,lodging_area,lodging_name,lodging_nights',
    )
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!route) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center">
        <p className="font-semibold">这条路线不存在或不属于你</p>
        <Link
          href={ROUTES.MY_ROUTES}
          className="mt-4 inline-flex h-10 items-center rounded-xl border border-border px-5 text-sm font-medium hover:bg-muted"
        >
          返回我的路线
        </Link>
      </div>
    );
  }

  const citiesRes = await supabase.from('cities').select('id,name').order('name');

  let cityName: string | null = null;
  if (route.city_id) {
    const { data: city } = await supabase
      .from('cities')
      .select('name')
      .eq('id', route.city_id)
      .maybeSingle();
    cityName = city?.name ?? null;
  }

  return (
    <RouteEditClient
      route={route}
      cityName={cityName}
      cityOptions={(citiesRes.data ?? []).map((c) => c.name)}
    />
  );
}
