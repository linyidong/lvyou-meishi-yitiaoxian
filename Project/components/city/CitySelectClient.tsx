'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { HOT_CITIES } from '@/config/cities';
import { ROUTES } from '@/config/routes';

/** U04 城市字典项（来自 cities 表，服务端查好后传入） */
export interface CityOption {
  id: string;
  name: string;
  adcode: string;
}

const chipCls = (on: boolean) =>
  `flex h-12 items-center justify-center rounded-xl border-2 text-sm font-medium ${
    on ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'
  }`;

/**
 * U04 选择城市：搜索只支持中文名片段与 adcode 片段。
 * 本项目城市数据只有 name + adcode，不提供拼音 / 简称搜索。
 */
export function CitySelectClient({ cities }: { cities: CityOption[] }) {
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const kw = keyword.trim();

  const matches = useMemo(
    () => (kw ? cities.filter((c) => c.name.includes(kw) || c.adcode.includes(kw)) : cities),
    [cities, kw],
  );

  const nextHref = selected
    ? `${ROUTES.ROUTE_NEW}?city=${encodeURIComponent(selected)}`
    : ROUTES.ROUTE_NEW;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">这次去哪座城市？</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          一条路线只对应一座城市，导入的地点会在该城市范围内规划。第一版仅支持国内城市。
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索城市名或城市编码，如：杭州、330100"
          className="h-11 w-full rounded-xl border border-border pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {kw === '' ? (
        <section className="mt-5">
          <h2 className="text-sm font-semibold">热门城市</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {HOT_CITIES.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setSelected(name)}
                className={chipCls(selected === name)}
              >
                {name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="text-sm font-semibold">全部城市</h2>
        {matches.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-border bg-background p-8 text-center">
            <p className="font-semibold">没有匹配的城市</p>
            <p className="mt-1 text-sm text-muted-foreground">换个关键词再试，或清空搜索看看全部城市。</p>
            <button
              type="button"
              onClick={() => setKeyword('')}
              className="mt-4 h-10 rounded-xl border border-border px-5 text-sm font-medium hover:bg-muted"
            >
              清空搜索
            </button>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {matches.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c.name)}
                className={chipCls(selected === c.name)}
              >
                <span className="flex flex-col items-center leading-tight">
                  <span>{c.name}</span>
                  <span className="text-[10px] text-muted-foreground">{c.adcode}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 底部 sticky 选择条 */}
      <div className="sticky bottom-0 -mx-4 mt-6 flex items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <span className="min-w-0 flex-1 truncate text-sm">
          {selected ? (
            <>
              已选城市：<span className="font-semibold text-primary">{selected}</span>
            </>
          ) : (
            <span className="text-muted-foreground">请先选择一座城市</span>
          )}
        </span>
        {selected ? (
          <Link
            href={nextHref}
            className="flex h-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-6 text-sm font-semibold text-white hover:brightness-110"
          >
            下一步：设置路线
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="flex h-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-6 text-sm font-semibold text-white opacity-50"
          >
            下一步：设置路线
          </button>
        )}
      </div>
    </>
  );
}
