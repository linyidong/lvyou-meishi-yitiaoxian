'use client';

import { Fragment, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bed,
  BedDouble,
  BedSingle,
  Building2,
  Bus,
  Car,
  CircleAlert,
  CircleCheck,
  CircleMinus,
  Ellipsis,
  Flame,
  House,
  MapPin,
  Minus,
  Plane,
  Plus,
  Search,
  SquarePen,
  TrainFront,
  TrainTrack,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { cityPinyin, HOT_CITIES } from '@/config/cities';
import {
  INTERCITY_MODE,
  INTERCITY_MODE_LABEL,
  LODGING_TYPE,
  LODGING_TYPE_LABEL,
} from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { cn } from '@/lib/utils';
import type { IntercityMode, LodgingType } from '@/types';

/** 出行设置的表单值（U05 新建 / U08 编辑共用） */
export interface TripSettingsValue {
  originCity: string;
  intercityMode: IntercityMode | null;
  lodgingType: LodgingType | null;
  lodgingArea: string;
  lodgingName: string;
  lodgingNights: number | null;
}

export const EMPTY_TRIP_SETTINGS: TripSettingsValue = {
  originCity: '',
  intercityMode: null,
  lodgingType: null,
  lodgingArea: '',
  lodgingName: '',
  lodgingNights: null,
};

/** 出行设置里的三块：出发城市 / 城际交通 / 终点城市住宿 */
export type TripSettingsSection = 'origin' | 'intercity' | 'lodging';

const ALL_SECTIONS: TripSettingsSection[] = ['origin', 'intercity', 'lodging'];

const INTERCITY_LIST = Object.values(INTERCITY_MODE);
const LODGING_LIST = Object.values(LODGING_TYPE);

/** 城际交通（大交通）图标：高铁 / 飞机 / 自驾 / 大巴 / 卧铺 / 暂不设置 */
const INTERCITY_ICON: Record<IntercityMode, LucideIcon> = {
  [INTERCITY_MODE.HSR]: TrainFront,
  [INTERCITY_MODE.PLANE]: Plane,
  [INTERCITY_MODE.DRIVE]: Car,
  [INTERCITY_MODE.COACH]: Bus,
  [INTERCITY_MODE.SLEEPER]: TrainTrack,
  [INTERCITY_MODE.NONE]: CircleMinus,
};

/** 住宿类型图标：酒店 / 民宿 / 青旅 / 亲友家 / 其他 */
const LODGING_ICON: Record<LodgingType, LucideIcon> = {
  [LODGING_TYPE.HOTEL]: Building2,
  [LODGING_TYPE.HOMESTAY]: House,
  [LODGING_TYPE.HOSTEL]: BedDouble,
  [LODGING_TYPE.RELATIVE]: Users,
  [LODGING_TYPE.OTHER]: Ellipsis,
};

const CARD_CLS = 'mt-5 rounded-2xl border border-stone-200 bg-white p-5 md:p-6';
const HEAD_ICON_CLS = 'grid h-11 w-11 shrink-0 place-items-center rounded-xl';
const LABEL_CLS = 'flex flex-wrap items-center gap-1.5 text-sm font-semibold text-stone-900';
const BADGE_REQ = 'rounded-full bg-primary/5 px-2 py-0.5 text-[11px] font-normal text-primary';
const BADGE_OPT = 'rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-normal text-stone-600';
const BADGE_NEW = 'rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-normal text-amber-700';
const INPUT_CLS =
  'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

/** 城际交通 / 住宿类型候选块（原型 CHIP_ON + 选中态） */
function chipCls(on: boolean, size = 'h-10') {
  return cn(
    'flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 text-sm font-medium',
    size,
    on
      ? 'border-primary bg-primary/5 text-primary'
      : 'border-stone-200 text-stone-600 hover:border-stone-300',
  );
}

/** 出发城市候选块（原型左侧城市名 + 右侧「即旅行城市」/ 选中勾） */
function originChipCls(on: boolean) {
  return cn(
    'flex h-10 items-center justify-between gap-1.5 rounded-xl border-2 px-3 text-sm font-medium',
    on
      ? 'border-primary bg-primary/5 text-primary'
      : 'border-stone-200 text-stone-700 hover:border-stone-300',
  );
}

/**
 * 出行设置三块表单：出发城市（必填）/ 城际交通·去程（选填）/ 终点城市住宿（选填）。
 * 不含提交按钮，U05 与 U08 各自决定保存方式。
 */
export function TripSettingsFields({
  value,
  onChange,
  cityOptions,
  destCity,
  destHint,
  days,
  originError,
  sections = ALL_SECTIONS,
}: {
  value: TripSettingsValue;
  onChange: (patch: Partial<TripSettingsValue>) => void;
  /** 出发城市候选（内置 92 城，来自 cities 字典表） */
  cityOptions: string[];
  /** 旅行城市（目的地），用于「同城出发」提示与文案 */
  destCity: string | null;
  /** 旅行目的地标签（来自 /city 的二级目的地时带括号标注，用于出发城市卡片说明） */
  destHint?: string;
  /** 行程天数，「按行程天数填满」与晚数提示使用 */
  days: number;
  /** 提交时出发城市为空时展示的错误文案 */
  originError?: string;
  /** 需要渲染的区块，默认三块全渲染；游客试用只渲染「出发城市」 */
  sections?: TripSettingsSection[];
}) {
  const M = MESSAGES.TRIP_FORM;
  const [originKeyword, setOriginKeyword] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  /** 手动输入并「使用」过的城市：追加到网格末尾并选中（含 92 城清单外的城市） */
  const [extraCities, setExtraCities] = useState<string[]>([]);

  /**
   * 出发城市候选分组（T-016 口径：网格只展示热门城市，其余城市由搜索框与手动输入兜底）：
   * - 无关键词：热门城市（带小标题）→ 手动添加的城市（若有）；
   * - 有关键词：按名称/拼音过滤后的平铺列表（上限 36）。
   */
  const originGroups = useMemo<{ label: string | null; cities: string[] }[]>(() => {
    const kw = originKeyword.trim().toLowerCase();
    if (kw) {
      const hit = (name: string) => {
        if (name.toLowerCase().includes(kw)) return true;
        const { full, initials } = cityPinyin(name);
        return full.includes(kw) || initials.includes(kw);
      };
      const list = cityOptions.filter(hit);
      const extras = extraCities.filter((n) => !cityOptions.includes(n) && hit(n));
      return [{ label: null, cities: [...list, ...extras].slice(0, 36) }];
    }
    const hotSet = new Set<string>(HOT_CITIES);
    const hot = HOT_CITIES.filter((n) => cityOptions.includes(n));
    const custom = extraCities.filter((n) => !hotSet.has(n));
    const groups: { label: string | null; cities: string[] }[] = [
      { label: M.originHotTitle, cities: hot },
    ];
    if (custom.length) groups.push({ label: M.originCustomTitle, cities: custom });
    return groups;
  }, [cityOptions, originKeyword, extraCities, M.originHotTitle, M.originCustomTitle]);

  const originCount = originGroups.reduce((s, g) => s + g.cities.length, 0);

  const sameCity = Boolean(destCity) && value.originCity === destCity;
  const needLodging = value.lodgingType !== null;
  const nights = value.lodgingNights ?? BUSINESS.MIN_LODGING_NIGHTS;
  const nightsWarn = needLodging
    ? nights > days
      ? M.nightsWarnOver(nights, days)
      : nights < days - 1
        ? M.nightsWarnUnder(days, nights)
        : ''
    : '';

  const intercityHint = !value.originCity
    ? M.intercityHintNoOrigin
    : sameCity
      ? M.intercityHintSameCity
      : value.intercityMode && value.intercityMode !== INTERCITY_MODE.NONE
        ? M.intercityHintSet(
            value.originCity,
            destCity ?? '',
            INTERCITY_MODE_LABEL[value.intercityMode],
          )
        : M.intercityHintNone;

  function stepNights(delta: number) {
    const next = Math.min(
      BUSINESS.MAX_LODGING_NIGHTS,
      Math.max(BUSINESS.MIN_LODGING_NIGHTS, nights + delta),
    );
    onChange({ lodgingNights: next });
  }

  function pickCustomOrigin() {
    const name = customValue.trim();
    if (!name) return;
    onChange({ originCity: name });
    // 手动输入的城市追加进网格并选中（去重；若恰为热门城市则已在置顶组中可见）
    setExtraCities((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setOriginKeyword('');
    setCustomOpen(false);
    setCustomValue('');
  }

  return (
    <div>
      {/* ===== 出发城市（必填，目的地仍为上面的「旅行城市」） ===== */}
      {sections.includes('origin') ? (
      <div className={CARD_CLS}>
        <div className="flex items-start gap-3">
          <span className={cn(HEAD_ICON_CLS, 'bg-sky-50 text-sky-600')}>
            <Building2 className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={LABEL_CLS}>
              <MapPin className="h-4 w-4 text-primary" />
              {M.originTitle}
              <span className={BADGE_REQ}>{M.badgeRequired}</span>
              <span className={BADGE_NEW}>{M.badgeNew}</span>
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {M.originDesc1}
              <span>{destHint ?? MESSAGES.TRIP_CITY.destFallback}</span>
              {M.originDesc2}
            </p>
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
          <input
            value={originKeyword}
            onChange={(e) => {
              setOriginKeyword(e.target.value);
              setCustomOpen(false);
            }}
            placeholder={M.originSearchPlaceholder}
            className={cn(INPUT_CLS, 'pl-10 pr-3')}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" id="originGrid">
          {originGroups.map((g) => (
            <Fragment key={g.label ?? 'kw'}>
              {g.label && g.cities.length ? (
                <p className="col-span-full flex items-center gap-1 text-xs font-semibold text-stone-500">
                  {g.label === M.originHotTitle ? <Flame className="h-3.5 w-3.5 text-orange-500" /> : null}
                  {g.label}
                </p>
              ) : null}
              {g.cities.map((name) => {
                const on = value.originCity === name;
                const same = name === destCity;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onChange({ originCity: name })}
                    className={originChipCls(on)}
                  >
                    <span className="truncate">{name}</span>
                    {same ? (
                      <span className="shrink-0 text-[10px] text-stone-400">
                        {MESSAGES.TRIP_CITY.sameCityTag}
                      </span>
                    ) : on ? (
                      <CircleCheck className="h-4 w-4 shrink-0 text-primary" />
                    ) : null}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>

        {originCount === 0 ? (
          <p className="mt-2 text-xs text-stone-500">{M.originNoResult}</p>
        ) : null}

        {customOpen ? (
          <div className="mt-2 flex gap-2">
            <input
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder={M.originManualPlaceholder}
              className={INPUT_CLS}
            />
            <button
              type="button"
              onClick={pickCustomOrigin}
              className="h-11 shrink-0 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-4 text-sm font-semibold text-white hover:brightness-110"
            >
              {M.originManualUse}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="mt-2 flex h-9 items-center gap-1 rounded-lg border border-dashed border-stone-300 px-3 text-xs text-stone-600 hover:bg-stone-50"
          >
            <SquarePen className="h-4 w-4" />
            {M.originManual}
          </button>
        )}

        {sameCity ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{M.originSame}</span>
          </p>
        ) : null}

        {originError ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{originError}</span>
          </p>
        ) : null}
      </div>
      ) : null}

      {/* ===== 城际交通 · 去程（选填） ===== */}
      {sections.includes('intercity') ? (
      <div className={CARD_CLS}>
        <div className="flex items-start gap-3">
          <span className={cn(HEAD_ICON_CLS, 'bg-indigo-50 text-indigo-600')}>
            <TrainFront className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={LABEL_CLS}>
              <ArrowRight className="h-4 w-4 text-primary" />
              {M.intercityTitle}
              <span className={BADGE_OPT}>{M.badgeOptional}</span>
              <span className={BADGE_NEW}>{M.badgeNew}</span>
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {M.intercityDesc1}
              <strong>{M.intercityDescStrong}</strong>
              {M.intercityDesc2}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {INTERCITY_LIST.map((mode) => {
            const Icon = INTERCITY_ICON[mode];
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onChange({ intercityMode: mode })}
                className={chipCls(value.intercityMode === mode)}
              >
                <Icon className="h-5 w-5" />
                {INTERCITY_MODE_LABEL[mode]}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-stone-500">{intercityHint}</p>
      </div>
      ) : null}

      {/* ===== 终点城市住宿（选填） ===== */}
      {sections.includes('lodging') ? (
      <div className={cn(CARD_CLS, 'space-y-4')}>
        <div className="flex items-start gap-3">
          <span className={cn(HEAD_ICON_CLS, 'bg-violet-50 text-violet-600')}>
            <Bed className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={LABEL_CLS}>
              <House className="h-4 w-4 text-primary" />
              {M.lodgingTitle}
              <span className={BADGE_OPT}>{M.badgeOptional}</span>
              <span className={BADGE_NEW}>{M.badgeNew}</span>
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {M.lodgingDesc1}{' '}
              <span>{destCity ?? M.lodgingDestFallback}</span>{' '}
              {M.lodgingDesc2}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-stone-500">{M.lodgingNeedQ}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                onChange({
                  lodgingType: value.lodgingType ?? LODGING_TYPE.HOTEL,
                  lodgingNights: value.lodgingNights ?? BUSINESS.MIN_LODGING_NIGHTS,
                })
              }
              className={chipCls(needLodging, 'h-11')}
            >
              <Bed className="h-5 w-5" />
              {M.lodgingYes}
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({ lodgingType: null, lodgingArea: '', lodgingName: '', lodgingNights: null })
              }
              className={chipCls(!needLodging, 'h-11')}
            >
              <BedSingle className="h-5 w-5" />
              {M.lodgingNo}
            </button>
          </div>
        </div>

        {needLodging ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-stone-500">{M.lodgingTypeLabel}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {LODGING_LIST.map((type) => {
                  const Icon = LODGING_ICON[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onChange({ lodgingType: type })}
                      className={chipCls(value.lodgingType === type)}
                    >
                      <Icon className="h-5 w-5" />
                      {LODGING_TYPE_LABEL[type]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="lodgingArea"
                  className="text-xs font-semibold text-stone-500"
                >
                  {M.areaLabel}
                </label>
                <input
                  id="lodgingArea"
                  value={value.lodgingArea}
                  maxLength={BUSINESS.MAX_LODGING_AREA_LENGTH}
                  onChange={(e) => onChange({ lodgingArea: e.target.value })}
                  placeholder={M.areaPlaceholder}
                  className={cn(INPUT_CLS, 'mt-1.5 px-3')}
                />
              </div>
              <div>
                <label
                  htmlFor="lodgingName"
                  className="text-xs font-semibold text-stone-500"
                >
                  {M.nameLabel}
                </label>
                <input
                  id="lodgingName"
                  value={value.lodgingName}
                  maxLength={BUSINESS.MAX_LODGING_NAME_LENGTH}
                  onChange={(e) => onChange({ lodgingName: e.target.value })}
                  placeholder={M.namePlaceholder}
                  className={cn(INPUT_CLS, 'mt-1.5 px-3')}
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-stone-500">{M.nightsLabel}</p>
              <div className="mt-2 flex items-center gap-4 rounded-xl bg-stone-100 px-4 py-3">
                <button
                  type="button"
                  aria-label={M.nightsMinus}
                  onClick={() => stepNights(-1)}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-stone-300 bg-white"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="text-sm text-stone-600">{M.nightsText}</span>
                <span className="w-8 text-center text-lg font-semibold">{nights}</span>
                <span className="text-sm text-stone-600">{M.nightsUnit}</span>
                <button
                  type="button"
                  aria-label={M.nightsPlus}
                  onClick={() => stepNights(1)}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-stone-300 bg-white"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      lodgingNights: Math.min(
                        BUSINESS.MAX_LODGING_NIGHTS,
                        Math.max(BUSINESS.MIN_LODGING_NIGHTS, days),
                      ),
                    })
                  }
                  className="ml-auto h-8 rounded-lg border border-stone-300 bg-white px-3 text-xs"
                >
                  {M.nightsSync}
                </button>
              </div>
              {nightsWarn ? (
                <p className="mt-2 flex items-start gap-1 text-xs text-amber-600">
                  <TriangleAlert className="mt-px h-4 w-4 shrink-0" />
                  <span>{nightsWarn}</span>
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-xs text-stone-400">{M.placeholder}</p>
        )}
      </div>
      ) : null}
    </div>
  );
}
