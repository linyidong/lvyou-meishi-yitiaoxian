'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  Bike,
  Bus,
  Car,
  CircleAlert,
  Footprints,
  Info,
  LoaderCircle,
  Lock,
  MapPinPlus,
  MapPinned,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { TRANSPORT, TRANSPORT_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import {
  EMPTY_TRIP_SETTINGS,
  TripSettingsFields,
  type TripSettingsValue,
} from '@/components/route/TripSettingsFields';
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

/**
 * 游客试用第 1 步：设置这条路线 → 写 sessionStorage 草稿 → 进 /try/pick（全程免登录）。
 *
 * 与普通用户设置路线页（U05）保持同一套结构：
 * 旅行城市（终点，来自 /city，锁定不可改）→ 出发城市（必填，独立字段）→ 标题 / 天数 / 市内交通 → 住宿。
 * 关键约束：选出发城市**不允许**改动旅行城市与路线标题里的城市前缀（两者是不同字段）。
 */
export function TryNewClient({
  cities,
  initialCityName = '',
}: {
  cities: { id: string; name: string; adcode: string }[];
  /** 由「选择城市」页带过来的预选城市名（?city=xxx），即旅行城市（终点） */
  initialCityName?: string;
}) {
  const M = MESSAGES.TRY.NEW;
  const router = useRouter();

  /** 旅行城市（终点）：来自 ?city= 或草稿，本页不可修改，标题前缀与落库城市都用它 */
  const [destCity, setDestCity] = useState<{ id: string; name: string; adcode: string } | null>(null);
  const [title, setTitle] = useState<string>(MESSAGES.TRIP_TITLE.defaultTitle ?? '');
  const [days, setDays] = useState(1);
  const [transport, setTransport] = useState<Transport>(TRANSPORT.WALK);
  const [trip, setTrip] = useState<TripSettingsValue>(EMPTY_TRIP_SETTINGS);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ dest?: string; title?: string; origin?: string }>({});

  const cityNames = useMemo(() => cities.map((c) => c.name), [cities]);

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

    if (target) setDestCity(target);
    // 没有草稿，或草稿所属城市与当前旅行城市不一致（换城市了）就不回填，避免把旧城市的行程带过来
    if (!draft || draft.cityId !== target?.id) return;

    // 草稿里存的是「城市名 · 标题」的完整标题（与正常用户一致），回填时去掉城市前缀
    const prefix = `${target.name} · `;
    setTitle(draft.title.startsWith(prefix) ? draft.title.slice(prefix.length) : draft.title);
    // 游客试用固定单日行程（与正常版分层一致）；历史草稿里若存过多日天数，这里统一归一为 1
    setDays(1);
    // T-016：游客试用固定步行；历史草稿里若存了其它方式，进页统一归一为 walk
    setTransport(TRANSPORT.WALK);
    setTrip((prev) => ({ ...prev, originCity: draft.originCity ?? '' }));
  }, [cities, initialCityName]);

  function patchTrip(patch: Partial<TripSettingsValue>) {
    setTrip((prev) => ({ ...prev, ...patch }));
    if (patch.originCity !== undefined) setErrors((prev) => ({ ...prev, origin: undefined }));
  }

  function submit() {
    const nextErrors: typeof errors = {};
    if (!destCity) nextErrors.dest = M.destRequired;
    if (!title.trim()) nextErrors.title = MESSAGES.ROUTE_TITLE_REQUIRED;
    if (!trip.originCity) nextErrors.origin = MESSAGES.ORIGIN_CITY_REQUIRED;

    setErrors(nextErrors);
    if (!destCity || Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);

    // 同城市保留已挑选的地点与导入的地点，换城市则清空（避免跨城残留）
    const prev = readTryDraft();
    const sameCity = prev && prev.cityId === destCity.id;
    const keepPlaces = sameCity ? prev.places : [];
    const keepImported = sameCity ? prev.importedPlaces : undefined;

    saveTryDraft({
      cityId: destCity.id,
      cityName: destCity.name,
      cityAdcode: destCity.adcode,
      originCity: trip.originCity,
      // 与正常用户一致：存「城市名 · 标题」，保证保存成正式路线后标题展示相同
      title: `${destCity.name} · ${title.trim()}`,
      days,
      transport,
      lodgingName: trip.lodgingName.trim(),
      lodgingArea: trip.lodgingArea.trim(),
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

      {/* 未选旅行城市时的引导（终点城市只在「选择城市」页选） */}
      {!destCity ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <MapPinned className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            {MESSAGES.TRIP_CITY.guidePre}
            <Link href={ROUTES.CITY} className="font-semibold underline py-2.5 md:py-0">
              {MESSAGES.TRIP_CITY.guideLink}
            </Link>
            {MESSAGES.TRIP_CITY.guidePost}
          </span>
        </div>
      ) : null}

      {/* 旅行城市（终点，来自身份地选择，本页不可修改） */}
      <div
        className={cn(
          'mt-5 flex items-center gap-3 rounded-2xl p-4',
          errors.dest ? 'border-2 border-red-400 bg-red-50' : 'border border-stone-200 bg-white',
        )}
      >
        <span
          className={cn(
            'grid h-11 w-11 place-items-center rounded-xl',
            errors.dest ? 'bg-red-100 text-red-600' : 'bg-teal-50 text-teal-600',
          )}
        >
          <MapPinned className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-stone-500">{MESSAGES.TRIP_CITY.label}</p>
          <p className="truncate font-semibold text-stone-900">
            {destCity?.name ?? MESSAGES.TRIP_CITY.none}
          </p>
          {errors.dest ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-600" role="alert">
              <CircleAlert className="h-4 w-4 shrink-0" />
              <span>{errors.dest}</span>
            </p>
          ) : null}
        </div>
        <Link
          href={ROUTES.CITY}
          className={cn(
            'flex h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-3 text-sm md:h-9',
            errors.dest
              ? 'bg-gradient-to-r from-primary-from to-primary-to font-semibold text-white hover:brightness-110'
              : 'border border-stone-300 hover:bg-stone-50',
          )}
        >
          {destCity ? (
            <>
              <ArrowLeftRight className="h-4 w-4" />
              {MESSAGES.TRIP_CITY.change}
            </>
          ) : (
            <>
              <MapPinPlus className="h-4 w-4" />
              {MESSAGES.TRIP_CITY.pick}
            </>
          )}
        </Link>
      </div>

      <p className="mt-2 flex items-start gap-1 text-xs text-stone-500">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" />
        <span>{M.cityHint}</span>
      </p>

      {/* 出发城市（必填）：与普通用户同一个组件，选它不会改动旅行城市与路线标题 */}
      <TripSettingsFields
        value={trip}
        onChange={patchTrip}
        cityOptions={cityNames}
        destCity={destCity?.name ?? null}
        destHint={destCity?.name ?? MESSAGES.TRIP_CITY.destFallback}
        days={days}
        originError={errors.origin}
        sections={['origin']}
      />

      {/* 标题 / 天数 / 市内交通 */}
      <div className={cn(CARD_CLS, 'space-y-6')}>
        <div>
          <label htmlFor="tryTitle" className={LABEL_CLS}>
            <Type className="h-4 w-4 text-primary" />
            {MESSAGES.TRIP_TITLE.label}
          </label>
          <p className="mt-1 text-xs text-stone-500">{MESSAGES.TRIP_TITLE.desc}</p>
          <div
            className={cn(
              'mt-3 flex h-11 w-full items-stretch overflow-hidden rounded-xl border bg-white',
              errors.title
                ? 'border-red-400 bg-red-50'
                : 'border-stone-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
            )}
          >
            <span
              title={MESSAGES.TRIP_TITLE.prefixTitle}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap border-r border-stone-200 bg-stone-100 pl-3 pr-2.5 text-sm font-semibold text-stone-700"
            >
              <Lock className="h-4 w-4 text-stone-400" />
              {destCity?.name ?? MESSAGES.TRIP_TITLE.prefixEmpty} ·
            </span>
            <input
              id="tryTitle"
              value={title}
              maxLength={BUSINESS.MAX_ROUTE_TITLE_LENGTH}
              onChange={(e) => {
                setTitle(e.target.value);
                setErrors((prev) => ({ ...prev, title: undefined }));
              }}
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
          {errors.title ? <p className="mt-1 text-xs text-red-600">{errors.title}</p> : null}
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
              <span className="text-xs opacity-70">{M.daysSingleSub}</span>
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className={`${chipCls(false, 'flex-col items-center justify-center leading-tight')} cursor-not-allowed opacity-50`}
            >
              <span className="font-semibold">{M.daysMany}</span>
              <span className="text-xs opacity-70">{M.daysManyLocked}</span>
            </button>
          </div>
          <p className="mt-2 text-xs text-stone-500">{M.daysGuestHint}</p>
        </div>

        <div>
          <p className={LABEL_CLS}>{M.transportLabel}</p>
          <p className="mt-1 text-xs text-stone-500">{M.transportHint}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* T-016：游客交通锁定步行——步行选中且禁用，其余置灰禁用（注册/登录后可选） */}
            {Object.values(TRANSPORT).map((mode) => {
              const Icon = TRANSPORT_ICON[mode];
              const isWalk = mode === TRANSPORT.WALK;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled
                  aria-disabled="true"
                  onClick={() => setTransport(mode)}
                  className={
                    isWalk
                      ? cn(chipCls(true), 'cursor-not-allowed')
                      : // 显式禁用样式（不套 hover 反馈）：置灰 + 半透明 + 不可点光标
                        'flex h-12 items-center justify-center gap-1.5 rounded-xl border-2 border-stone-200 bg-stone-100 text-sm font-medium text-stone-400 opacity-50 cursor-not-allowed'
                  }
                >
                  <Icon className="h-5 w-5" />
                  {TRANSPORT_LABEL[mode]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-stone-500">{M.transportGuestLocked}</p>
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
              value={trip.lodgingName}
              maxLength={BUSINESS.MAX_LODGING_NAME_LENGTH}
              onChange={(e) => patchTrip({ lodgingName: e.target.value })}
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
              value={trip.lodgingArea}
              maxLength={BUSINESS.MAX_LODGING_AREA_LENGTH}
              onChange={(e) => patchTrip({ lodgingArea: e.target.value })}
              placeholder={M.lodgingAreaPlaceholder}
              className={cn(INPUT_CLS, 'mt-1.5')}
            />
          </div>
        </div>
      </div>

      {/* 操作 */}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Link
          href={ROUTES.CITY}
          className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-stone-300 px-6 text-sm font-medium hover:bg-stone-50"
        >
          {MESSAGES.TRIP_FOOTER.back}
        </Link>
        <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-7 font-semibold text-white hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {M.next}
          </button>
          {errors.dest || errors.origin ? (
            <p className="flex items-center gap-1 text-xs text-red-600 sm:justify-end">
              <CircleAlert className="h-4 w-4 shrink-0" />
              <span>{errors.dest ?? errors.origin}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
