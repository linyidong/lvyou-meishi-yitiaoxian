'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudOff,
  Database,
  Info,
  LoaderCircle,
  MapPin,
  MapPinOff,
  MapPinned,
  Route as RouteIcon,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { CITY_CARDS, cityPinyin, type CityCard } from '@/config/cities';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

/** U04 城市字典项（来自 cities 表，服务端查好后传入） */
export interface CityOption {
  id: string;
  name: string;
  adcode: string;
}

/** U04 未完成路线（草稿提示条用） */
export interface CityDraft {
  id: string;
  title: string;
}

/** 二级目的地归属：城市内地名 / 同省 · 周边城市 */
type DestScope = 'city' | 'near';

/**
 * 搜索命中判断：城市名、拼音全拼 / 首字母（hz → 杭州），
 * 以及二级目的地（城市内地名 / 周边城市，如 西湖 → 杭州）。
 */
function matchCity(card: CityCard, keyword: string): boolean {
  const kw = keyword.toLowerCase();
  if (card.name.includes(keyword)) return true;

  const { full, initials } = cityPinyin(card.name);
  if (full && (full.includes(kw) || initials.includes(kw))) return true;

  return [...card.districts, ...card.nearby].some((p) => p.includes(keyword));
}

/** 二级目的地分组（原型：城市内地名 / 同省 · 周边城市与县镇） */
function DestGroup({
  title,
  hint,
  items,
  icon: Icon,
  selectedDest,
  onPick,
}: {
  title: string;
  hint: string;
  items: readonly string[];
  icon: typeof MapPin;
  selectedDest: string | null;
  onPick: (dest: string) => void;
}) {
  return (
    <div>
      {items.length === 0 ? (
        <>
          <p className="text-xs font-semibold text-stone-500">{title}</p>
          <p className="mt-2 rounded-xl border border-dashed border-stone-200 px-3 py-4 text-center text-xs text-stone-400">
            {MESSAGES.CITY_DEST.empty(title)}
          </p>
        </>
      ) : (
        <>
          <p className="flex items-center gap-1 text-xs font-semibold text-stone-500">
            <Icon className="h-4 w-4 text-stone-400" />
            {title}
            <span className="font-normal text-stone-400">· {hint}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {items.map((item) => {
              const on = selectedDest === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPick(item)}
                  className={cn(
                    'flex h-9 items-center gap-1 rounded-full border-2 px-3 text-sm',
                    on
                      ? 'border-primary bg-primary/5 font-semibold text-primary'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-primary/30 hover:text-primary',
                  )}
                >
                  {on ? <CheckCircle2 className="h-4 w-4" /> : null}
                  {item}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** 二级目的地板块（选中城市卡片下方展开） */
function DestPanel({
  card,
  selectedDest,
  onPick,
  onCollapse,
}: {
  card: CityCard;
  selectedDest: string | null;
  onPick: (dest: string, scope: DestScope) => void;
  onCollapse: () => void;
}) {
  const D = MESSAGES.CITY_DEST;
  const CityIcon = card.icon;
  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex items-center gap-1.5 font-semibold text-stone-900">
          <CityIcon className={cn('h-4 w-4', card.color.split(' ')[1])} />
          {D.panelTitle(card.name)}
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-normal text-amber-700">
            {D.panelBadge}
          </span>
        </p>
        <button
          type="button"
          onClick={onCollapse}
          className="flex h-8 items-center gap-1 rounded-lg border border-stone-300 px-3 text-xs text-stone-600 hover:bg-stone-50"
        >
          <ChevronUp className="h-4 w-4" />
          {D.panelCollapse}
        </button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <DestGroup
          title={D.groupCity}
          hint={D.groupCityHint}
          items={card.districts}
          icon={MapPin}
          selectedDest={selectedDest}
          onPick={(dest) => onPick(dest, 'city')}
        />
        <DestGroup
          title={D.groupNearby}
          hint={D.groupNearbyHint}
          items={card.nearby}
          icon={RouteIcon}
          selectedDest={selectedDest}
          onPick={(dest) => onPick(dest, 'near')}
        />
      </div>
      <p className="mt-4 flex items-start gap-1 text-[11px] text-stone-400">
        <Info className="mt-px h-4 w-4 shrink-0" />
        <span>{D.footnote}</span>
      </p>
    </div>
  );
}

/** U04 选择城市：12 张热门城市卡（二级目的地展开）+ 搜索 + 底部选择条 */
export function CitySelectClient({
  cities,
  draft,
  guest = false,
  dataCityNames = [],
  error = false,
}: {
  cities: CityOption[];
  draft?: CityDraft | null;
  /** 游客模式（免登录试用）：只有库内已有数据的城市可点，其余置灰并标注「暂无数据」 */
  guest?: boolean;
  /** 游客模式下「有数据」（库内已有可勾选地点）的城市名清单 */
  dataCityNames?: readonly string[];
  /** 城市字典查询失败 */
  error?: boolean;
}) {
  const M = MESSAGES;
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedDest, setSelectedDest] = useState<{ name: string; scope: DestScope } | null>(null);
  const [pending, setPending] = useState(false);

  const kw = keyword.trim();

  /** 游客态：库内已有数据的城市集合（不在其中的城市置灰且不可点击） */
  const dataCities = useMemo(() => new Set(dataCityNames), [dataCityNames]);

  /** 只渲染 cities 表中存在的热门城市卡（真实数据源兜底） */
  const hotCards = useMemo(() => {
    const names = new Set(cities.map((c) => c.name));
    return CITY_CARDS.filter((c) => names.has(c.name));
  }, [cities]);

  const list = useMemo(() => (kw ? hotCards.filter((c) => matchCity(c, kw)) : hotCards), [hotCards, kw]);

  const nextHref = useMemo(() => {
    // 游客：直接进免登录试用链路（带上所选城市），不走需登录的 /route/new
    if (guest) return `${ROUTES.TRY_NEW}?city=${encodeURIComponent(selected ?? '')}`;
    const isNear = selectedDest?.scope === 'near';
    const cityName = isNear ? selectedDest!.name : selected;
    if (!cityName) return ROUTES.ROUTE_NEW;
    const dest = !isNear && selectedDest ? `&dest=${encodeURIComponent(selectedDest.name)}` : '';
    return `${ROUTES.ROUTE_NEW}?city=${encodeURIComponent(cityName)}${dest}`;
  }, [guest, selected, selectedDest]);

  function pickCity(name: string) {
    if (selected === name) {
      setSelected(null);
      setSelectedDest(null);
      return;
    }
    setSelected(name);
    setSelectedDest(null);
  }

  function pickDest(dest: string, scope: DestScope) {
    setSelectedDest({ name: dest, scope });
  }

  return (
    <>
      {/* 标题 + 右侧搜索框 */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 md:text-3xl">{M.CITY_HERO.title}</h1>
          <p className="mt-2 text-sm text-stone-500">
            {M.CITY_HERO.descLine1}
            <span className="md:block">
              {M.CITY_HERO.descLine2Prefix}
              <strong className="text-stone-700">{M.CITY_HERO.descDistricts}</strong>
              {M.CITY_HERO.descOr}
              <strong className="text-stone-700">{M.CITY_HERO.descNearby}</strong>
              {M.CITY_HERO.descLine2Suffix}
            </span>
            <span className="md:block">{M.CITY_HERO.descLine3}</span>
          </p>
        </div>
        <div className="relative md:w-80 lg:w-[400px] lg:shrink-0">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={M.CITY_HERO.searchPlaceholder}
            className="h-11 w-full rounded-xl border border-stone-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* 未完成路线草稿提示条 */}
      {draft ? (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {M.CITY_HERO.draftHint(draft.title)}
            <Link
              href={ROUTES.ROUTE_ADD(draft.id)}
              className="font-semibold underline underline-offset-2"
            >
              {M.CITY_HERO.draftContinue}
            </Link>
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 py-16 text-center">
          <CloudOff className="mx-auto h-12 w-12 text-red-400" />
          <p className="mt-3 font-semibold text-red-700">{M.CITY_ERROR.title}</p>
          <p className="mt-1 text-sm text-red-600">{M.CITY_ERROR.desc}</p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-4 h-10 rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-5 text-sm font-semibold text-white hover:brightness-110"
          >
            {M.CITY_ERROR.retry}
          </button>
        </div>
      ) : hotCards.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
          <Building2 className="mx-auto h-12 w-12 text-stone-300" />
          <p className="mt-3 font-semibold">{M.CITY_EMPTY.title}</p>
          <p className="mt-1 text-sm text-stone-500">{M.CITY_EMPTY.desc}</p>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-sm font-semibold text-stone-500">
              {M.CITY_HERO.hotTitle}
              <span className="ml-1 font-normal text-stone-400">
                {guest ? M.CITY_HERO.hotTitleNoteGuest : M.CITY_HERO.hotTitleNote}
              </span>
            </h2>
            <p className="flex items-center gap-1 text-[11px] text-stone-400">
              <Database className="h-4 w-4" />
              {M.CITY_HERO.mockNote}
            </p>
          </div>

          <div className="mt-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((card) => {
                // 游客态：库内没有数据的城市置灰且不可点（游客试用只能勾选库内已有地点）
                const locked = guest && !dataCities.has(card.name);
                const on = !locked && selected === card.name;
                const CityIcon = card.icon;
                return (
                  <div
                    key={card.name}
                    className={cn('grid gap-3', on && 'col-span-2 sm:col-span-3 lg:col-span-4')}
                  >
                    <button
                      type="button"
                      disabled={locked}
                      aria-disabled={locked}
                      onClick={() => pickCity(card.name)}
                      className={cn(
                        'w-full rounded-2xl border-2 bg-white p-4 text-left transition',
                        locked
                          ? 'cursor-not-allowed border-stone-200 opacity-60 grayscale'
                          : on
                            ? 'border-primary ring-4 ring-primary/30'
                            : 'border-stone-200 hover:border-stone-300',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'grid h-10 w-10 place-items-center rounded-xl',
                            locked ? 'bg-stone-100 text-stone-400' : card.color,
                          )}
                        >
                          <CityIcon className="h-[22px] w-[22px]" />
                        </span>
                        {on ? (
                          <CheckCircle2 className="h-[22px] w-[22px] text-primary" />
                        ) : guest ? (
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px]',
                              locked
                                ? 'bg-stone-100 text-stone-500'
                                : 'bg-amber-100 text-amber-700',
                            )}
                          >
                            {locked ? M.CITY_HERO.badgeNoData : M.CITY_HERO.badgeHasData}
                          </span>
                        ) : card.badge ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                            {card.badge}
                          </span>
                        ) : null}
                      </div>
                      <p className={cn('mt-3 font-semibold', locked ? 'text-stone-400' : 'text-stone-900')}>
                        {card.name}
                      </p>
                      <p className={cn('mt-0.5 text-xs', locked ? 'text-stone-300' : 'text-stone-500')}>
                        {card.keywords.join(' · ')}
                      </p>
                      {/* 置灰的卡片没有可展开内容，不显示展开提示（正常卡片保留，与原型一致） */}
                      {locked ? null : (
                        <p
                          className={cn(
                            'mt-2 flex items-center gap-1 text-[11px]',
                            on ? 'text-primary' : 'text-stone-400',
                          )}
                        >
                          {on ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          {on ? M.CITY_DEST.cardCollapse : M.CITY_DEST.cardExpand}
                        </p>
                      )}
                    </button>
                    {on ? (
                      <DestPanel
                        card={card}
                        selectedDest={selectedDest?.name ?? null}
                        onPick={pickDest}
                        onCollapse={() => {
                          setSelected(null);
                          setSelectedDest(null);
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {list.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white py-12 text-center">
              <MapPinOff className="mx-auto h-10 w-10 text-stone-300" />
              <p className="mt-3 font-medium">{M.CITY_SEARCH.emptyTitle(kw)}</p>
              <p className="mt-1 text-sm text-stone-500">{M.CITY_SEARCH.emptyDesc}</p>
              <button
                type="button"
                onClick={() => setKeyword('')}
                className="mt-4 h-9 rounded-lg border border-stone-300 px-4 text-sm"
              >
                {M.CITY_SEARCH.clear}
              </button>
            </div>
          ) : null}

          {/* 底部选择条 */}
          <div className="sticky bottom-20 z-20 mt-8 md:bottom-4">
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-lg">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/5 text-primary">
                <MapPinned className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-stone-500">{M.CITY_HERO.selectedLabel}</p>
                <p className="truncate font-semibold text-stone-900">
                  {selected ?? M.CITY_HERO.notSelected}
                </p>
                {selectedDest ? (
                  <p className="mt-0.5 truncate text-xs text-primary">
                    {selectedDest.scope === 'near'
                      ? M.CITY_HERO.selectedDestNear(selectedDest.name, selected ?? '')
                      : M.CITY_HERO.selectedDestCity(selectedDest.name, selected ?? '')}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={!selected}
                onClick={() => {
                  setPending(true);
                  router.push(nextHref);
                }}
                className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-6 font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:bg-none"
              >
                {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {M.CITY_HERO.nextStep}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
