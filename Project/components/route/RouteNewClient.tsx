'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowLeftRight,
  Bike,
  Bus,
  CalendarRange,
  Car,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Footprints,
  Info,
  Lock,
  LoaderCircle,
  MapPinned,
  MapPinPlus,
  Minus,
  Plus,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { TRANSPORT, TRANSPORT_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { parseTripSettings } from '@/lib/route-settings';
import type { MemberTier } from '@/lib/member-quota';
import {
  EMPTY_TRIP_SETTINGS,
  TripSettingsFields,
  type TripSettingsValue,
} from '@/components/route/TripSettingsFields';
import type { Transport } from '@/types';

const CARD_CLS = 'mt-5 rounded-2xl border border-stone-200 bg-white p-5 md:p-6';
const LABEL_CLS = 'flex items-center gap-1.5 text-sm font-semibold text-stone-900';
const BADGE_OPT = 'rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-normal text-stone-600';
const INPUT_CLS =
  'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

/** 市内交通各方式的图标（与 TRANSPORT 取值一一对应） */
const TRANSPORT_ICON: Record<Transport, LucideIcon> = {
  [TRANSPORT.WALK]: Footprints,
  [TRANSPORT.BIKE]: Bike,
  [TRANSPORT.TRANSIT]: Bus,
  [TRANSPORT.DRIVE]: Car,
};

/** 单日 / 多日、市内交通等候选块 */
function bigChipCls(on: boolean, layout = 'items-center justify-center gap-1.5') {
  return cn(
    'flex h-12 rounded-xl border-2 text-sm font-medium',
    layout,
    on
      ? 'border-primary bg-primary/5 text-primary'
      : 'border-stone-200 text-stone-600 hover:border-stone-300',
  );
}

/** U05 新建路线：城市 → 出行设置 → 标题 / 天数 / 市内交通，保存后进入导入地点（U06）。 */
export function RouteNewClient({
  cities,
  initialCityParam,
  initialDestParam,
  tier,
  trialMultiDayUsed,
}: {
  cities: { id: string; name: string }[];
  /** 来自 /city 的跳转参数，允许是城市 id 或城市名 */
  initialCityParam: string | null;
  /** 来自 /city 的二级目的地参数（城市内地名，或作为旅行城市的周边城市） */
  initialDestParam: string | null;
  /** 当前用户会员档位（admin / member / free），用于动态展示配额说明 */
  tier: MemberTier;
  /** 免费用户「永久 1 次多日试用额度」是否已用 */
  trialMultiDayUsed: boolean;
}) {
  const M = MESSAGES;
  const router = useRouter();

  /** 本档位允许的最大天数：免费用户试用额度已用则仅单日；其余沿用现有上限 */
  const maxDaysAllowed =
    tier === 'free' ? (trialMultiDayUsed ? 1 : BUSINESS.MEMBER_MAX_DAYS) : BUSINESS.MAX_DAYS;
  /** 档位配额说明文案（全部取自 config/messages.ts） */
  const tierHint =
    tier === 'admin'
      ? M.TRIP_TIER.admin
      : tier === 'member'
        ? M.TRIP_TIER.member(BUSINESS.MEMBER_MAX_DAYS, BUSINESS.MEMBER_MAX_PLACES_PER_DAY)
        : [M.TRIP_TIER.free(BUSINESS.FREE_MAX_PLACES_PER_DAY), trialMultiDayUsed ? null : M.TRIP_TIER.freeTrial]
            .filter(Boolean)
            .join('；');

  const cityNames = useMemo(() => cities.map((c) => c.name), [cities]);
  const initialCity = useMemo(() => {
    if (!initialCityParam) return null;
    const hit = cities.find((c) => c.id === initialCityParam);
    if (hit) return hit.name;
    // 未命中字典表（如周边城市 / 县镇）时按原型直接用参数作为旅行城市名
    return initialCityParam;
  }, [cities, initialCityParam]);

  const [cityName] = useState<string | null>(initialCity);
  const [destName] = useState<string | null>(initialDestParam);
  const [title, setTitle] = useState<string>(MESSAGES.TRIP_TITLE.defaultTitle ?? '');
  const [days, setDays] = useState<number>(1);
  const [transport, setTransport] = useState<Transport>(TRANSPORT.WALK);
  const [trip, setTrip] = useState<TripSettingsValue>(EMPTY_TRIP_SETTINGS);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ city?: string; title?: string; origin?: string }>({});
  const [notice, setNotice] = useState('');

  const fullTitle = cityName ? `${cityName} · ${title.trim()}` : title.trim();
  const isMultiDay = days > 1;
  /** 旅行城市卡片显示名：带二级目的地时按原型标注（周边城市 / 所属城市） */
  const cityCardName = cityName
    ? destName
      ? destName === cityName
        ? `${destName}${M.TRIP_CITY.nearbyTag}`
        : M.TRIP_CITY.cardDest(destName, cityName)
      : cityName
    : M.TRIP_CITY.none;
  /** 出发城市卡片说明里的「旅行目的地」标签（原型 destLabel：目的地与城市同名时标注“周边城市”） */
  const destHint = destName
    ? destName === cityName
      ? `${destName}${M.TRIP_CITY.nearbyTag}`
      : destName
    : M.TRIP_CITY.destFallback;
  const titleLength = title.trim().length;
  const titleNearLimit =
    titleLength >= BUSINESS.MAX_ROUTE_TITLE_LENGTH - 5 && titleLength < BUSINESS.MAX_ROUTE_TITLE_LENGTH;

  function patchTrip(patch: Partial<TripSettingsValue>) {
    setTrip((prev) => ({ ...prev, ...patch }));
  }

  async function submit() {
    const nextErrors: typeof errors = {};
    if (!cityName) nextErrors.city = M.TRIP_CITY_REQUIRED;
    if (!title.trim()) nextErrors.title = M.ROUTE_TITLE_REQUIRED;

    const parsed = parseTripSettings(trip);
    if (!parsed.ok) nextErrors.origin = parsed.message;
    else if (!parsed.value.origin_city) nextErrors.origin = M.ORIGIN_CITY_REQUIRED;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !parsed.ok) return;

    setSubmitting(true);
    setNotice('');
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityId: cities.find((c) => c.name === cityName)?.id ?? null,
          title: fullTitle,
          days,
          transport,
          originCity: trip.originCity,
          intercityMode: trip.intercityMode,
          lodgingType: trip.lodgingType,
          lodgingArea: trip.lodgingArea,
          lodgingName: trip.lodgingName,
          lodgingNights: trip.lodgingNights,
        }),
      });
      const data = (await res.json()) as { ok: boolean; id?: string; message?: string };
      if (!data.ok || !data.id) {
        setNotice(data.message ?? M.TRIP_SAVE_ERROR.desc);
        return;
      }
      setNotice(M.ROUTE_SETTINGS_SAVED);
      router.push(ROUTES.ROUTE_ADD(data.id));
    } catch {
      setNotice(M.TRIP_SAVE_ERROR.desc);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* 保存成功提示（真实流程会立即跳转到导入地点） */}
      {notice === M.ROUTE_SETTINGS_SAVED ? (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          {notice}
        </div>
      ) : null}
      {notice && notice !== M.ROUTE_SETTINGS_SAVED ? (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">{M.TRIP_SAVE_ERROR.title}</span>
            <span className="mt-0.5 block">{notice}</span>
          </span>
        </div>
      ) : null}

      {/* 未选城市时的引导提示（未登录也可先体验流程） */}
      {!cityName ? (
        <div
          role="alert"
          className={cn(
            'mb-5 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm',
            errors.city
              ? 'border border-red-300 bg-red-50 text-red-700'
              : 'border border-amber-200 bg-amber-50 text-amber-800',
          )}
        >
          {errors.city ? (
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <MapPinned className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <span>
            {errors.city ? M.TRIP_CITY.guideBadPre : M.TRIP_CITY.guidePre}
            <Link href={ROUTES.CITY} className="font-semibold underline">
              {M.TRIP_CITY.guideLink}
            </Link>
            {errors.city ? M.TRIP_CITY.guideBadPost : M.TRIP_CITY.guidePost}
          </span>
        </div>
      ) : null}

      <h1 className="text-2xl font-bold text-stone-900 md:text-3xl">{M.TRIP_HERO.title}</h1>
      <p className="mt-2 text-sm text-stone-500">{M.TRIP_HERO.desc}</p>

      {/* 本期新增范围说明（超出 PRD P0） */}
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <ClipboardList className="mt-0.5 h-[22px] w-[22px] shrink-0 text-amber-600" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">{M.TRIP_HERO.newInfoTitle}</p>
          <p className="mt-1 text-amber-800">
            {M.TRIP_HERO.newInfoDesc1}
            <strong>{M.TRIP_HERO.newInfoDescStrong}</strong>
            {M.TRIP_HERO.newInfoDesc2}
          </p>
        </div>
      </div>

      {/* 阶段 2 会员分层：按角色动态展示当前配额（免费用户另给升级入口） */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
        <Info className="h-4 w-4 shrink-0 text-teal-600" />
        <span className="font-medium">{tierHint}</span>
        {tier === 'free' ? (
          <Link
            href={ROUTES.PROFILE}
            className="ml-auto flex h-8 shrink-0 items-center rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-3 text-xs font-semibold text-white hover:brightness-110"
          >
            {M.TRIP_TIER.upgrade}
          </Link>
        ) : null}
      </div>

      {/* 旅行城市（来自 /city） */}
      <div
        tabIndex={-1}
        className={cn(
          'mt-5 flex items-center gap-3 rounded-2xl p-4 outline-none transition focus:ring-2 focus:ring-primary/20',
          errors.city ? 'border-2 border-red-400 bg-red-50' : 'border border-stone-200 bg-white',
        )}
      >
        <span
          className={cn(
            'grid h-11 w-11 place-items-center rounded-xl',
            errors.city ? 'bg-red-100 text-red-600' : 'bg-teal-50 text-teal-600',
          )}
        >
          <MapPinned className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-stone-500">{M.TRIP_CITY.label}</p>
          <p className="truncate font-semibold text-stone-900">{cityCardName}</p>
          {errors.city ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-600" role="alert">
              <CircleAlert className="h-4 w-4 shrink-0" />
              <span>{errors.city}</span>
            </p>
          ) : null}
        </div>
        <Link
          href={ROUTES.CITY}
          className={cn(
            'flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-3 text-sm',
            errors.city
              ? 'bg-gradient-to-r from-primary-from to-primary-to font-semibold text-white hover:brightness-110'
              : 'border border-stone-300 hover:bg-stone-50',
          )}
        >
          {cityName ? (
            <>
              <ArrowLeftRight className="h-4 w-4" />
              {M.TRIP_CITY.change}
            </>
          ) : (
            <>
              <MapPinPlus className="h-4 w-4" />
              {M.TRIP_CITY.pick}
            </>
          )}
        </Link>
      </div>

      {/* 出行设置（本期新增） */}
      <TripSettingsFields
        value={trip}
        onChange={patchTrip}
        cityOptions={cityNames}
        destCity={cityName}
        destHint={destHint}
        days={days}
        originError={errors.origin}
      />

      {/* 标题 / 天数 / 市内交通 */}
      <div className={cn(CARD_CLS, 'space-y-7')}>
        <div>
          <label htmlFor="routeTitle" className={LABEL_CLS}>
            <Type className="h-4 w-4 text-primary" />
            {M.TRIP_TITLE.label}
          </label>
          <p className="mt-1 text-xs text-stone-500">{M.TRIP_TITLE.desc}</p>
          <div
            className={cn(
              'mt-3 flex h-11 w-full items-stretch overflow-hidden rounded-xl border bg-white',
              errors.title
                ? 'border-red-400 bg-red-50'
                : 'border-stone-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
            )}
          >
            <span
              title={M.TRIP_TITLE.prefixTitle}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap border-r border-stone-200 bg-stone-100 pl-3 pr-2.5 text-sm font-semibold text-stone-700"
            >
              <Lock className="h-4 w-4 text-stone-400" />
              {cityName ?? M.TRIP_TITLE.prefixEmpty} ·
            </span>
            <input
              id="routeTitle"
              value={title}
              maxLength={BUSINESS.MAX_ROUTE_TITLE_LENGTH}
              onChange={(e) => {
                setTitle(e.target.value);
                setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              placeholder={M.TRIP_TITLE.placeholder}
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
            />
          </div>
          <div className="mt-1.5 flex items-start gap-3">
            <p className="flex flex-1 items-start gap-1 text-xs text-stone-500">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{M.TRIP_TITLE.prefixHint}</span>
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
              {M.TRIP_TITLE.count(titleLength, BUSINESS.MAX_ROUTE_TITLE_LENGTH)}
            </span>
          </div>
          {titleNearLimit ? (
            <p className="mt-1 text-xs text-amber-600">
              {M.TRIP_TITLE.warnNear(BUSINESS.MAX_ROUTE_TITLE_LENGTH - titleLength)}
            </p>
          ) : null}
          {errors.title ? <p className="mt-1 text-xs text-red-600">{errors.title}</p> : null}
        </div>

        <div>
          <p className={LABEL_CLS}>
            <CalendarRange className="h-4 w-4 text-primary" />
            {M.TRIP_DAYS.label}
          </p>
          <p className="mt-1 text-xs text-stone-500">{M.TRIP_DAYS.desc}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDays(1)}
              className={bigChipCls(days === 1, 'flex-col items-center justify-center leading-tight')}
            >
              <span className="font-semibold">{M.TRIP_DAYS.single}</span>
              <span className="text-[11px] opacity-70">{M.TRIP_DAYS.singleSub}</span>
            </button>
            <button
              type="button"
              disabled={maxDaysAllowed < 2}
              onClick={() => {
                if (maxDaysAllowed >= 2) setDays(BUSINESS.MIN_DAYS);
              }}
              className={cn(
                bigChipCls(isMultiDay, 'flex-col items-center justify-center leading-tight'),
                maxDaysAllowed < 2 && 'cursor-not-allowed opacity-50',
              )}
            >
              <span className="font-semibold">{M.TRIP_DAYS.many}</span>
              <span className="text-[11px] opacity-70">{M.TRIP_DAYS.manySub}</span>
            </button>
          </div>
          {isMultiDay ? (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-stone-100 px-4 py-3">
              <span className="text-sm text-stone-600">{M.TRIP_DAYS.unitPre}</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={M.TRIP_DAYS.minus}
                  onClick={() => setDays(Math.max(BUSINESS.MIN_DAYS, days - 1))}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-stone-300 bg-white"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-lg font-semibold">{days}</span>
                <button
                  type="button"
                  aria-label={M.TRIP_DAYS.plus}
                  onClick={() => setDays(Math.min(maxDaysAllowed, days + 1))}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-stone-300 bg-white"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <span className="text-sm text-stone-600">{M.TRIP_DAYS.unitPost}</span>
            </div>
          ) : null}
        </div>

        <div>
          <p className={LABEL_CLS}>
            <Footprints className="h-4 w-4 text-primary" />
            {M.TRIP_TRANSPORT.label}
            <span className={BADGE_OPT}>{M.TRIP_TRANSPORT.badge}</span>
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {M.TRIP_TRANSPORT.desc1}
            <strong>{M.TRIP_TRANSPORT.descStrong}</strong>
            {M.TRIP_TRANSPORT.desc2}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.values(TRANSPORT).map((mode) => {
              const Icon = TRANSPORT_ICON[mode];
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTransport(mode)}
                  className={bigChipCls(transport === mode)}
                >
                  <Icon className="h-5 w-5" />
                  {TRANSPORT_LABEL[mode]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 操作 */}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Link
          href={ROUTES.CITY}
          className="flex h-12 items-center justify-center gap-1.5 truncate whitespace-nowrap rounded-xl border border-stone-300 px-6 text-sm font-medium hover:bg-stone-50"
        >
          <ArrowLeft className="h-4 w-4" />
          {M.TRIP_FOOTER.back}
        </Link>
        <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-7 font-semibold text-white hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {M.TRIP_FOOTER.next}
          </button>
          {errors.origin ? (
            <p className="flex items-center gap-1 text-xs text-red-600 sm:justify-end">
              <CircleAlert className="h-4 w-4 shrink-0" />
              <span>{M.TRIP_FOOTER.nextErr}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
