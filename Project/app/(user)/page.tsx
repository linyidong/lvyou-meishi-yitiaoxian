import Link from 'next/link';
import { ArrowRight, Heart, MapPin, Route, Sparkles } from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { CITIES, HOT_CITIES } from '@/config/cities';
import { PRODUCT } from '@/config/product';
import { ROUTES } from '@/config/routes';

/** U02 首页：Slogan + 热门城市入口 + 常用入口 */
export default function HomePage() {
  const hotCities = HOT_CITIES.slice(0, BUSINESS.HOME_HOT_CITY_LIMIT);

  return (
    <div className="space-y-8">
      {/* 首屏（配色方案 G1：玫红 → 紫 渐变） */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary-from to-primary-to px-6 py-10 text-white md:px-10 md:py-14">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          共 {CITIES.length} 座城市可选
        </p>
        <h1 className="mt-4 text-3xl font-bold md:text-4xl">{PRODUCT.NAME}</h1>
        <p className="mt-2 text-lg text-white/90">{PRODUCT.SLOGAN}</p>
        <p className="mt-3 max-w-xl text-sm text-white/70">{PRODUCT.DESCRIPTION}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={ROUTES.ROUTE_NEW}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-white px-5 font-semibold text-foreground hover:brightness-95"
          >
            开始规划路线
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={ROUTES.MY_ROUTES}
            className="flex h-11 items-center gap-1.5 rounded-xl border border-white/40 px-5 font-medium text-white hover:bg-white/10"
          >
            我的路线
          </Link>
        </div>
      </section>

      {/* 热门城市 */}
      <section>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">热门城市</h2>
            <p className="mt-1 text-sm text-muted-foreground">点一座城市，直接进入新建路线并带上目的地</p>
          </div>
          <Link href={ROUTES.ROUTE_NEW} className="shrink-0 text-sm text-primary hover:underline">
            在新建路线里搜索全部 {CITIES.length} 座
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {hotCities.map((name) => (
            <Link
              key={name}
              href={`${ROUTES.ROUTE_NEW}?city=${encodeURIComponent(name)}`}
              className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 hover:border-primary hover:bg-muted"
            >
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate text-sm font-medium">{name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 常用入口 */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Link
          href={ROUTES.COLLECTED}
          className="rounded-2xl border border-border bg-background p-5 hover:border-primary"
        >
          <Heart className="h-5 w-5 text-primary" />
          <p className="mt-3 font-semibold">我的收藏地点</p>
          <p className="mt-1 text-sm text-muted-foreground">
            出发前先收藏想去的景点和美食，出行时直接从收藏同步到路线
          </p>
        </Link>
        <Link
          href={ROUTES.MY_ROUTES}
          className="rounded-2xl border border-border bg-background p-5 hover:border-primary"
        >
          <Route className="h-5 w-5 text-primary" />
          <p className="mt-3 font-semibold">我的路线</p>
          <p className="mt-1 text-sm text-muted-foreground">
            查看已保存的路线，含出发城市、城际交通与住宿安排
          </p>
        </Link>
        <Link
          href={ROUTES.PROFILE}
          className="rounded-2xl border border-border bg-background p-5 hover:border-primary"
        >
          <Sparkles className="h-5 w-5 text-primary" />
          <p className="mt-3 font-semibold">个人中心</p>
          <p className="mt-1 text-sm text-muted-foreground">
            查看统计数据，或升级为会员解锁更强的路线规划能力
          </p>
        </Link>
      </section>
    </div>
  );
}
