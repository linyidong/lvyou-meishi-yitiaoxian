'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, MapPin, Minus, Plus } from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { TRANSPORT, TRANSPORT_LABEL } from '@/config/enums';
import { parseTripSettings } from '@/lib/route-settings';
import {
  EMPTY_TRIP_SETTINGS,
  TripSettingsFields,
  type TripSettingsValue,
} from '@/components/route/TripSettingsFields';
import type { Transport } from '@/types';

const cardCls = 'rounded-2xl border border-border bg-background p-5';
const inputCls =
  'h-11 w-full rounded-xl border border-border px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';
const chipCls = (on: boolean) =>
  `flex h-12 items-center justify-center gap-1.5 rounded-xl border-2 text-sm font-medium ${
    on ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'
  }`;

/** U05 新建路线：城市 → 出行设置 → 标题 / 天数 / 市内交通，保存后进入导入地点（U06）。 */
export function RouteNewClient({
  cities,
  initialCityParam,
}: {
  cities: { id: string; name: string }[];
  /** 来自 /city 的跳转参数，允许是城市 id 或城市名 */
  initialCityParam: string | null;
}) {
  const router = useRouter();

  const cityNames = useMemo(() => cities.map((c) => c.name), [cities]);
  const initialCity = useMemo(() => {
    if (!initialCityParam) return null;
    const hit = cities.find((c) => c.id === initialCityParam);
    if (hit) return hit.name;
    return cities.find((c) => c.name === initialCityParam)?.name ?? null;
  }, [cities, initialCityParam]);

  const [cityName, setCityName] = useState<string | null>(initialCity);
  const [cityPickerOpen, setCityPickerOpen] = useState(!initialCity);
  const [cityKeyword, setCityKeyword] = useState('');
  const [title, setTitle] = useState('');
  const [days, setDays] = useState<number>(BUSINESS.MIN_DAYS);
  const [transport, setTransport] = useState<Transport>(TRANSPORT.WALK);
  const [trip, setTrip] = useState<TripSettingsValue>(EMPTY_TRIP_SETTINGS);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ city?: string; title?: string; origin?: string }>({});
  const [notice, setNotice] = useState('');

  const cityMatches = useMemo(() => {
    const kw = cityKeyword.trim();
    return (kw ? cities.filter((c) => c.name.includes(kw)) : cities).slice(0, 12);
  }, [cities, cityKeyword]);

  const fullTitle = cityName ? `${cityName} · ${title.trim()}` : title.trim();
  const isMultiDay = days > 1;

  function patchTrip(patch: Partial<TripSettingsValue>) {
    setTrip((prev) => ({ ...prev, ...patch }));
  }

  function pickCity(name: string) {
    setCityName(name);
    setCityPickerOpen(false);
    setCityKeyword('');
    setErrors((prev) => ({ ...prev, city: undefined }));
  }

  async function submit() {
    const nextErrors: typeof errors = {};
    if (!cityName) nextErrors.city = MESSAGES.TRIP_CITY_REQUIRED;
    if (!title.trim()) nextErrors.title = MESSAGES.ROUTE_TITLE_REQUIRED;

    const parsed = parseTripSettings(trip);
    if (!parsed.ok) nextErrors.origin = parsed.message;
    else if (!parsed.value.origin_city) nextErrors.origin = MESSAGES.ORIGIN_CITY_REQUIRED;

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
        setNotice(data.message ?? MESSAGES.NETWORK_ERROR);
        return;
      }
      setNotice(MESSAGES.ROUTE_SETTINGS_SAVED);
      router.push(ROUTES.ROUTE_ADD(data.id));
    } catch {
      setNotice(MESSAGES.NETWORK_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* 步骤条 */}
      <ol className="mb-6 flex items-center gap-2 overflow-x-auto text-xs whitespace-nowrap">
        <li className="text-muted-foreground">1 选城市</li>
        <li className="h-px w-6 bg-border" />
        <li className="font-semibold text-primary">2 设置路线</li>
        <li className="h-px w-6 bg-border" />
        <li className="text-muted-foreground">3 导入地点</li>
        <li className="h-px w-6 bg-border" />
        <li className="text-muted-foreground">4 勾选地点</li>
        <li className="h-px w-6 bg-border" />
        <li className="text-muted-foreground">5 调整路线</li>
        <li className="h-px w-6 bg-border" />
        <li className="text-muted-foreground">6 查看结果</li>
      </ol>

      <h1 className="text-2xl font-bold">设置这条路线</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        先给路线起个名字，再决定从哪出发、怎么去、玩几天、到了住哪儿。这些设置之后都能在路线编辑页里随时改。
      </p>

      {notice ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {notice}
        </p>
      ) : null}

      {/* 旅行城市 */}
      <div className={`mt-5 ${cardCls}`}>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600">
            <MapPin className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">旅行城市（目的地）</p>
            <p className="truncate font-semibold">{cityName ?? '—'}</p>
          </div>
          <button
            type="button"
            onClick={() => setCityPickerOpen((v) => !v)}
            className="h-9 shrink-0 rounded-lg border border-border px-3 text-sm hover:bg-muted"
          >
            {cityName ? '更换城市' : '选择城市'}
          </button>
        </div>

        {cityPickerOpen ? (
          <div className="mt-3">
            <input
              value={cityKeyword}
              onChange={(e) => setCityKeyword(e.target.value)}
              placeholder="搜索旅行城市，如：成都"
              className={inputCls}
            />
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {cityMatches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickCity(c.name)}
                  className={chipCls(cityName === c.name)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {errors.city ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errors.city}
          </p>
        ) : null}
      </div>

      {/* 出行设置（本期新增） */}
      <div className="mt-5">
        <TripSettingsFields
          value={trip}
          onChange={patchTrip}
          cityOptions={cityNames}
          destCity={cityName}
          days={days}
          originError={errors.origin}
        />
      </div>

      {/* 标题 / 天数 / 市内交通 */}
      <div className={`mt-5 space-y-7 ${cardCls}`}>
        <div>
          <p className="text-sm font-semibold">路线标题</p>
          <p className="mt-1 text-xs text-muted-foreground">
            标题会自动带上当前城市名，你只需要填写城市名后面的部分，最多 {BUSINESS.MAX_ROUTE_TITLE_LENGTH} 字
          </p>
          <div className="mt-3 flex h-11 items-stretch overflow-hidden rounded-xl border border-border bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <span className="flex shrink-0 items-center gap-1 border-r border-border bg-muted px-3 text-sm font-semibold text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> {cityName ?? '—'} ·
            </span>
            <input
              value={title}
              maxLength={BUSINESS.MAX_ROUTE_TITLE_LENGTH}
              onChange={(e) => {
                setTitle(e.target.value);
                setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              placeholder="例如：老城区半日骑行"
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span>前缀是当前城市，不可直接修改；重新选择城市后前缀会自动同步</span>
            <span>
              {title.trim().length} / {BUSINESS.MAX_ROUTE_TITLE_LENGTH}
            </span>
          </div>
          {fullTitle ? <p className="mt-1 text-xs text-muted-foreground">预览：{fullTitle}</p> : null}
          {errors.title ? <p className="mt-1 text-xs text-red-600">{errors.title}</p> : null}
        </div>

        <div>
          <p className="text-sm font-semibold">行程天数</p>
          <p className="mt-1 text-xs text-muted-foreground">
            多日路线会先按距离聚类，再把每天的地点均匀分配
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDays(1)}
              className={chipCls(days === 1)}
            >
              单日 · 1 天走完
            </button>
            <button
              type="button"
              onClick={() => setDays(BUSINESS.MIN_DAYS)}
              className={chipCls(isMultiDay)}
            >
              多日 · {BUSINESS.MIN_DAYS}–{BUSINESS.MAX_DAYS} 天
            </button>
          </div>
          {isMultiDay ? (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-muted px-4 py-3">
              <span className="text-sm text-muted-foreground">共</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="减少天数"
                  onClick={() => setDays(Math.max(BUSINESS.MIN_DAYS, days - 1))}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-background"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-lg font-semibold">{days}</span>
                <button
                  type="button"
                  aria-label="增加天数"
                  onClick={() => setDays(Math.min(BUSINESS.MAX_DAYS, days + 1))}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-background"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <span className="text-sm text-muted-foreground">天</span>
            </div>
          ) : null}
        </div>

        <div>
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
            市内交通
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              默认步行
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            整条路线在<strong className="font-semibold">旅行城市内</strong>
            统一使用一种交通方式，用于估算距离和时间；与上面的「城际交通 · 去程」不是同一件事。
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {Object.values(TRANSPORT).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTransport(mode)}
                className={chipCls(transport === mode)}
              >
                {TRANSPORT_LABEL[mode]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 操作 */}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Link
          href={ROUTES.CITY}
          className="flex h-12 items-center justify-center rounded-xl border border-border px-6 text-sm font-medium hover:bg-muted"
        >
          去选择城市
        </Link>
        <button
          type="button"
          disabled={submitting}
          onClick={submit}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-7 font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? '保存中…' : '下一步：导入地点'}
        </button>
      </div>
    </div>
  );
}
