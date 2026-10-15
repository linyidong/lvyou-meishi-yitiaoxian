'use client';

import { useMemo, useState } from 'react';
import { BedDouble, Flag, Minus, Plus, TrainFront } from 'lucide-react';
import { BUSINESS } from '@/config/business';
import {
  INTERCITY_MODE,
  INTERCITY_MODE_LABEL,
  LODGING_TYPE,
  LODGING_TYPE_LABEL,
} from '@/config/enums';
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

const INTERCITY_LIST = Object.values(INTERCITY_MODE);
const LODGING_LIST = Object.values(LODGING_TYPE);

const chipCls = (on: boolean) =>
  `flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 text-sm font-medium ${
    on ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'
  }`;

const cardCls = 'rounded-2xl border border-border bg-background p-5';
const inputCls =
  'h-11 w-full rounded-xl border border-border px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';
const badgeNew = 'rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700';
const badgeRe = 'rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary';
const badgeOpt = 'rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground';

/**
 * 出行设置三块表单：出发城市（必填）/ 城际交通·去程（选填）/ 终点城市住宿（选填）。
 * 不含提交按钮，U05 与 U08 各自决定保存方式。
 */
export function TripSettingsFields({
  value,
  onChange,
  cityOptions,
  destCity,
  days,
  originError,
}: {
  value: TripSettingsValue;
  onChange: (patch: Partial<TripSettingsValue>) => void;
  /** 出发城市候选（内置 92 城，来自 cities 字典表） */
  cityOptions: string[];
  /** 旅行城市（目的地），用于「同城出发」提示与文案 */
  destCity: string | null;
  /** 行程天数，「按行程天数填满」与晚数提示使用 */
  days: number;
  /** 提交时出发城市为空时展示的错误文案 */
  originError?: string;
}) {
  const [originKeyword, setOriginKeyword] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const matches = useMemo(() => {
    const kw = originKeyword.trim();
    const list = kw ? cityOptions.filter((c) => c.includes(kw)) : cityOptions;
    return list.slice(0, 12);
  }, [cityOptions, originKeyword]);

  const sameCity = Boolean(destCity) && value.originCity === destCity;
  const needLodging = value.lodgingType !== null;
  const nights = value.lodgingNights ?? BUSINESS.MIN_LODGING_NIGHTS;
  const nightsWarn =
    needLodging && nights > days
      ? `入住 ${nights} 晚多于行程 ${days} 天，仅作记录，请确认是否填写有误`
      : '';

  function stepNights(delta: number) {
    const next = Math.min(BUSINESS.MAX_LODGING_NIGHTS, Math.max(BUSINESS.MIN_LODGING_NIGHTS, nights + delta));
    onChange({ lodgingNights: next });
  }

  return (
    <div className="space-y-5">
      {/* ===== 出发城市（必填） ===== */}
      <div className={cardCls}>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600">
            <Flag className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              出发城市
              <span className={badgeRe}>必填</span>
              <span className={badgeNew}>本期新增</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              你这次从哪座城市出发（居住地或上一站），用于估算城际交通。它与上面的「旅行城市」
              {destCity ? `（${destCity}）` : ''}是两个不同概念。
            </p>
          </div>
        </div>

        <input
          value={originKeyword}
          onChange={(e) => setOriginKeyword(e.target.value)}
          placeholder="搜索出发城市，如：重庆"
          className={`mt-3 ${inputCls}`}
        />

        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {matches.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange({ originCity: name })}
              className={chipCls(value.originCity === name)}
            >
              {name}
            </button>
          ))}
        </div>
        {matches.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            没有匹配的国内城市，可点下面的「手动输入出发城市名」直接填写
          </p>
        ) : null}

        {customOpen ? (
          <div className="mt-3 flex gap-2">
            <input
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="输入出发城市名"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => {
                const name = customValue.trim();
                if (!name) return;
                onChange({ originCity: name });
                setOriginKeyword('');
                setCustomOpen(false);
                setCustomValue('');
              }}
              className="h-11 shrink-0 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:brightness-110"
            >
              使用
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="mt-3 inline-flex h-9 items-center gap-1 rounded-lg border border-dashed border-border px-3 text-xs text-muted-foreground hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
            没找到？手动输入出发城市名
          </button>
        )}

        {value.originCity ? (
          <p className="mt-3 text-xs text-muted-foreground">
            已选择：<span className="font-semibold text-foreground">{value.originCity}</span>
          </p>
        ) : null}

        {sameCity ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            同城出发，无需城际交通。下面「城际交通 · 去程」可保持「暂不选择」。
          </p>
        ) : null}

        {originError ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {originError}
          </p>
        ) : null}
      </div>

      {/* ===== 城际交通 · 去程（选填） ===== */}
      <div className={cardCls}>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <TrainFront className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              城际交通 · 去程
              <span className={badgeOpt}>选填</span>
              <span className={badgeNew}>本期新增</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              出发城市 → 旅行城市的<strong className="font-semibold">大交通</strong>
              方式，与「市内交通」（步行 / 骑行）是两回事。这里只做行程信息记录，不会查询班次或票价。
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {INTERCITY_LIST.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({ intercityMode: value.intercityMode === mode ? null : mode })}
              className={chipCls(value.intercityMode === mode)}
            >
              {INTERCITY_MODE_LABEL[mode]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {value.intercityMode === null
            ? '暂不设置：不会记录大交通方式，之后可在路线编辑页补充'
            : sameCity
              ? '同城出发：出发城市与旅行城市相同，无需城际交通'
              : `${value.originCity || '出发城市'} → ${destCity ?? '旅行城市'} · ${INTERCITY_MODE_LABEL[value.intercityMode]}`}
        </p>
      </div>

      {/* ===== 终点城市住宿（选填） ===== */}
      <div className={cardCls}>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
            <BedDouble className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              终点城市住宿
              <span className={badgeOpt}>选填</span>
              <span className={badgeNew}>本期新增</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              到{destCity ? ` ${destCity} ` : '旅行城市'}之后的住宿安排，仅记录信息，不代订房。
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              onChange({
                lodgingType: value.lodgingType ?? LODGING_TYPE.HOTEL,
                lodgingNights: value.lodgingNights ?? BUSINESS.MIN_LODGING_NIGHTS,
              })
            }
            className={chipCls(needLodging)}
          >
            需要住宿
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({ lodgingType: null, lodgingArea: '', lodgingName: '', lodgingNights: null })
            }
            className={chipCls(!needLodging)}
          >
            暂不预订
          </button>
        </div>

        {needLodging ? (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">住宿类型</p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {LODGING_LIST.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onChange({ lodgingType: type })}
                    className={chipCls(value.lodgingType === type)}
                  >
                    {LODGING_TYPE_LABEL[type]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground">住宿区域</span>
                <input
                  value={value.lodgingArea}
                  maxLength={BUSINESS.MAX_LODGING_AREA_LENGTH}
                  onChange={(e) => onChange({ lodgingArea: e.target.value })}
                  placeholder="例如：宽窄巷子附近"
                  className={`mt-1.5 ${inputCls}`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground">
                  酒店 / 民宿名称（选填）
                </span>
                <input
                  value={value.lodgingName}
                  maxLength={BUSINESS.MAX_LODGING_NAME_LENGTH}
                  onChange={(e) => onChange({ lodgingName: e.target.value })}
                  placeholder="例如：某民宿（可不填）"
                  className={`mt-1.5 ${inputCls}`}
                />
              </label>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground">入住晚数</p>
              <div className="mt-2 flex items-center gap-3 rounded-xl bg-muted px-4 py-3">
                <button
                  type="button"
                  aria-label="减少入住晚数"
                  onClick={() => stepNights(-1)}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-background"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="text-sm text-muted-foreground">共住</span>
                <span className="w-8 text-center text-lg font-semibold">{nights}</span>
                <span className="text-sm text-muted-foreground">晚</span>
                <button
                  type="button"
                  aria-label="增加入住晚数"
                  onClick={() => stepNights(1)}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-background"
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
                  className="ml-auto h-8 rounded-lg border border-border bg-background px-3 text-xs"
                >
                  按行程天数填满
                </button>
              </div>
              {nightsWarn ? <p className="mt-2 text-xs text-amber-600">{nightsWarn}</p> : null}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            暂不预订：不会记录住宿信息，之后可在路线编辑页补充
          </p>
        )}
      </div>
    </div>
  );
}
