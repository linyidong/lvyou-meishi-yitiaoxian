'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bike,
  Bus,
  Car,
  CircleAlert,
  Footprints,
  Info,
  LoaderCircle,
  Lock,
  MapPinned,
  Search,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { cityPinyin } from '@/config/cities';
import { TRANSPORT, TRANSPORT_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { readTryDraft, saveTryDraft } from '@/lib/draft';
import { cn } from '@/lib/utils';
import type { Transport } from '@/types';

const CARD_CLS = 'mt-5 rounded-2xl border border-stone-200 bg-white p-5 md:p-6';
const LABEL_CLS = 'flex items-center gap-1.5 text-sm font-semibold text-stone-900';
const INPUT_CLS =
  'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

/** 市内交通各方式的图标 */
const TRANSPORT_ICON: Record<Transport, LucideIcon> = {
  [TRANSPORT.WALK]: Footprints,
  [TRANSPORT.BIKE]: Bike,
  [TRANSPORT.TRANSIT]: Bus,
  [TRANSPORT.DRIVE]: Car,
};

function chipCls(on: boolean, layout = 'items-center justify-center gap-1.5') {
  return cn(
    'flex h-12 rounded-xl border-2 text-sm font-medium',
    layout,
    on
      ? 'border-primary bg-primary/5 text-primary'
      : 'border-stone-200 text-stone-600 hover:border-stone-300',
  );
}

/** 游客试用第 1 步：选城市 + 行程设置 → 写 sessionStorage 草稿 → 进 /try/pick（全程免登录） */
export function TryNewClient({
  cities,
  initialCityName = '',
}: {
  cities: { id: string; name: string; adcode: string }[];
  /** 由「选择城市」页带过来的预选城市名（?city=xxx） */
  initialCityName?: string;
}) {
  const M = MESSAGES.TRY.NEW;
  const router = useRouter();

  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState<{ id: string; name: string; adcode: string } | null>(null);
  const [title, setTitle] = useState<string>(MESSAGES.TRIP_TITLE.defaultTitle ?? '');
  const [days, setDays] = useState(1);
  const [transport, setTransport] = useState<Transport>(TRANSPORT.WALK);
  const [lodgingName, setLodgingName] = useState('');
  const [lodgingArea, setLodgingArea] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 回到本页时（例如从 /try/pick 返回）用已有草稿回填，避免重复输入；
  // 若由「选择城市」页带城市进来（?city=），该城市优先于草稿里的城市。
  useEffect(() => {
    const draft = readTryDraft();
    const paramHit = initialCityName ? cities.find((c) => c.name === initialCityName) : undefined;
    const draftHit = draft ? cities.find((c) => c.id === draft.cityId) : undefined;
    const target =
      paramHit ??
      draftHit ??
      (draft
        ? { id: draft.cityId, name: draft.cityName, adcode: draft.cityAdcode }
        : undefined);

    if (target) setCity(target);
    if (!draft || draft.cityId !== target?.id) return;

    // 草稿里存的是「城市名 · 标题」的完整标题（与正常用户一致），回填时去掉城市前缀
    const prefix = `${target.name} · `;
    setTitle(draft.title.startsWith(prefix) ? draft.title.slice(prefix.length) : draft.title);
    // 游客试用固定单日行程（与免费版分层一致）；历史草稿里若存过多日天数，这里统一归一为 1
    setDays(1);
    setTransport(draft.transport);
    setLodgingName(draft.lodgingName);
    setLodgingArea(draft.lodgingArea);
  }, [cities, initialCityName]);

  const matches = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const list = kw
      ? cities.filter((c) => {
          if (c.name.includes(keyword.trim())) return true;
          const { full, initials } = cityPinyin(c.name);
          return full.includes(kw) || initials.includes(kw);
        })
      : cities;
    return list.slice(0, 24);
  }, [cities, keyword]);

  function submit() {
    if (!city) {
      setError(M.cityRequired);
      return;
    }
    if (!title.trim()) {
      setError(MESSAGES.ROUTE_TITLE_REQUIRED);
      return;
    }
    setError('');
    setSubmitting(true);

    // 同城市保留已挑选的地点与导入的地点，换城市则清空（避免跨城残留）
    const prev = readTryDraft();
    const sameCity = prev && prev.cityId === city.id;
    const keepPlaces = sameCity ? prev.places : [];
    const keepImported = sameCity ? prev.importedPlaces : undefined;

    saveTryDraft({
      cityId: city.id,
      cityName: city.name,
      cityAdcode: city.adcode,
      // 与正常用户一致：存「城市名 · 标题」，保证保存成正式路线后标题展示相同
      title: `${city.name} · ${title.trim()}`,
      days,
      transport,
      lodgingName: lodgingName.trim(),
      lodgingArea: lodgingArea.trim(),
      places: keepPlaces,
      importedPlaces: keepImported,
    });
    router.push(ROUTES.TRY_PICK);
  }

  /** 标题字数：只统计输入部分（城市前缀不计入），与正常用户同一套规则 */
  const titleLength = title.trim().length;
  const titleNearLimit =
    titleLength >= BUSINESS.MAX_ROUTE_TITLE_LENGTH - 5 && titleLength < BUSINESS.MAX_ROUTE_TITLE_LENGTH;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
          {MESSAGES.TRY.guestBadge}
        </span>
        <span className="text-xs text-stone-400">
          {MESSAGES.TRY.stepNew} · {MESSAGES.TRY.stepPick} · {MESSAGES.TRY.stepResult}
        </span>
      </div>
      <h1 className="mt-2 text-2xl font-bold text-stone-900 md:text-3xl">{M.title}</h1>
      <p className="mt-2 text-sm text-stone-500">{M.desc}</p>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* 旅行城市 */}
      <div className={CARD_CLS}>
        <p className={LABEL_CLS}>
          <MapPinned className="h-4 w-4 text-primary" />
          {M.cityLabel}
        </p>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={M.citySearchPlaceholder}
            className={cn(INPUT_CLS, 'pl-10')}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {matches.map((c) => {
            const on = city?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCity(c)}
                className={cn(
                  'flex h-10 items-center justify-center rounded-xl border-2 px-3 text-sm font-medium',
                  on
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-stone-200 text-stone-700 hover:border-stone-300',
                )}
              >
                <span className="truncate">{c.name}</span>
              </button>
            );
          })}
        </div>
        {cities.length === 0 ? (
          <p className="mt-2 text-xs text-stone-500">{M.cityEmpty}</p>
        ) : matches.length === 0 ? (
          <p className="mt-2 text-xs text-stone-500">{M.cityNoResult}</p>
        ) : null}
      </div>

      {/* 标题 / 天数 / 市内交通 */}
      <div className={cn(CARD_CLS, 'space-y-6')}>
        <div>
          <label htmlFor="tryTitle" className={LABEL_CLS}>
            <Type className="h-4 w-4 text-primary" />
            {MESSAGES.TRIP_TITLE.label}
          </label>
          <p className="mt-1 text-xs text-stone-500">{MESSAGES.TRIP_TITLE.desc}</p>
          <div className="mt-3 flex h-11 w-full items-stretch overflow-hidden rounded-xl border border-stone-300 bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <span
              title={MESSAGES.TRIP_TITLE.prefixTitle}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap border-r border-stone-200 bg-stone-100 pl-3 pr-2.5 text-sm font-semibold text-stone-700"
            >
              <Lock className="h-4 w-4 text-stone-400" />
              {city?.name ?? MESSAGES.TRIP_TITLE.prefixEmpty} ·
            </span>
            <input
              id="tryTitle"
              value={title}
              maxLength={BUSINESS.MAX_ROUTE_TITLE_LENGTH}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={MESSAGES.TRIP_TITLE.placeholder}
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
            />
          </div>
          <div className="mt-1.5 flex items-start gap-3">
            <p className="flex flex-1 items-start gap-1 text-xs text-stone-500">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{MESSAGES.TRIP_TITLE.prefixHint}</span>
            </p>
            <span
              className={cn(
                'shrink-0 text-xs',
                titleLength >= BUSINESS.MAX_ROUTE_TITLE_LENGTH
                  ? 'font-semibold text-red-600'
                  : titleNearLimit
                    ? 'font-semibold text-amber-600'
                    : 'text-stone-400',
              )}
            >
              {MESSAGES.TRIP_TITLE.count(titleLength, BUSINESS.MAX_ROUTE_TITLE_LENGTH)}
            </span>
          </div>
          {titleNearLimit ? (
            <p className="mt-1 text-xs text-amber-600">
              {MESSAGES.TRIP_TITLE.warnNear(BUSINESS.MAX_ROUTE_TITLE_LENGTH - titleLength)}
            </p>
          ) : null}
        </div>

        <div>
          <p className={LABEL_CLS}>{M.daysLabel}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDays(1)}
              className={chipCls(days === 1, 'flex-col items-center justify-center leading-tight')}
            >
              <span className="font-semibold">{M.daysSingle}</span>
              <span className="text-[11px] opacity-70">{M.daysSingleSub}</span>
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className={`${chipCls(false, 'flex-col items-center justify-center leading-tight')} cursor-not-allowed opacity-50`}
            >
              <span className="font-semibold">{M.daysMany}</span>
              <span className="text-[11px] opacity-70">{M.daysManyLocked}</span>
            </button>
          </div>
          <p className="mt-2 text-xs text-stone-500">{M.daysGuestHint}</p>
        </div>

        <div>
          <p className={LABEL_CLS}>{M.transportLabel}</p>
          <p className="mt-1 text-xs text-stone-500">{M.transportHint}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.values(TRANSPORT).map((mode) => {
              const Icon = TRANSPORT_ICON[mode];
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTransport(mode)}
                  className={chipCls(transport === mode)}
                >
                  <Icon className="h-5 w-5" />
                  {TRANSPORT_LABEL[mode]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 住宿（选填） */}
      <div className={cn(CARD_CLS, 'space-y-4')}>
        <div>
          <p className={LABEL_CLS}>{M.lodgingTitle}</p>
          <p className="mt-1 text-xs text-stone-500">{M.lodgingHint}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="tryLodgingName" className="text-xs font-semibold text-stone-500">
              {M.lodgingNameLabel}
            </label>
            <input
              id="tryLodgingName"
              value={lodgingName}
              maxLength={BUSINESS.MAX_LODGING_NAME_LENGTH}
              onChange={(e) => setLodgingName(e.target.value)}
              placeholder={M.lodgingNamePlaceholder}
              className={cn(INPUT_CLS, 'mt-1.5')}
            />
          </div>
          <div>
            <label htmlFor="tryLodgingArea" className="text-xs font-semibold text-stone-500">
              {M.lodgingAreaLabel}
            </label>
            <input
              id="tryLodgingArea"
              value={lodgingArea}
              maxLength={BUSINESS.MAX_LODGING_AREA_LENGTH}
              onChange={(e) => setLodgingArea(e.target.value)}
              placeholder={M.lodgingAreaPlaceholder}
              className={cn(INPUT_CLS, 'mt-1.5')}
            />
          </div>
        </div>
      </div>

      {/* 操作 */}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Link
          href={ROUTES.HOME}
          className="flex h-12 items-center justify-center rounded-xl border border-stone-300 px-6 text-sm font-medium hover:bg-stone-50"
        >
          {M.backHome}
        </Link>
        <button
          type="button"
          disabled={submitting}
          onClick={submit}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-7 font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {M.next}
        </button>
      </div>
    </div>
  );
}
