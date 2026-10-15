'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MESSAGES } from '@/config/messages';
import { INTERCITY_MODE_LABEL, LODGING_TYPE_LABEL, TRANSPORT_LABEL } from '@/config/enums';
import { parseTripSettings } from '@/lib/route-settings';
import {
  TripSettingsFields,
  type TripSettingsValue,
} from '@/components/route/TripSettingsFields';
import type { IntercityMode, LodgingType, RouteRow } from '@/types';

const cardCls = 'rounded-2xl border border-border bg-background p-5';

/** U08 出行设置卡：编辑并保存 routes 的出行设置六列 */
export function RouteEditClient({
  route,
  cityName,
  cityOptions,
}: {
  route: Pick<
    RouteRow,
    | 'id'
    | 'title'
    | 'days'
    | 'transport'
    | 'origin_city'
    | 'intercity_mode'
    | 'lodging_type'
    | 'lodging_area'
    | 'lodging_name'
    | 'lodging_nights'
  >;
  cityName: string | null;
  cityOptions: string[];
}) {
  const router = useRouter();
  const [trip, setTrip] = useState<TripSettingsValue>({
    originCity: route.origin_city ?? '',
    intercityMode: route.intercity_mode as IntercityMode | null,
    lodgingType: route.lodging_type as LodgingType | null,
    lodgingArea: route.lodging_area ?? '',
    lodgingName: route.lodging_name ?? '',
    lodgingNights: route.lodging_nights,
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  const [originError, setOriginError] = useState<string | undefined>(undefined);

  function showToast(text: string, tone: 'ok' | 'err') {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 2600);
  }

  async function save() {
    const parsed = parseTripSettings(trip);
    if (!parsed.ok) {
      setOriginError(parsed.message);
      showToast(parsed.message, 'err');
      return;
    }
    setOriginError(undefined);

    setSaving(true);
    try {
      const res = await fetch(`/api/routes/${route.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trip),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        showToast(data.message ?? MESSAGES.NETWORK_ERROR, 'err');
        return;
      }
      showToast(MESSAGES.SAVE_SUCCESS, 'ok');
      router.refresh();
    } catch {
      showToast(MESSAGES.NETWORK_ERROR, 'err');
    } finally {
      setSaving(false);
    }
  }

  const intercityText =
    route.origin_city && route.origin_city === cityName
      ? '同城出发，无需城际交通'
      : route.intercity_mode
        ? `${INTERCITY_MODE_LABEL[route.intercity_mode as IntercityMode]}（${route.origin_city ?? '出发城市'} → ${cityName ?? '旅行城市'}）`
        : '暂不设置';

  const lodgingText = route.lodging_type
    ? [
        LODGING_TYPE_LABEL[route.lodging_type as LodgingType],
        route.lodging_area,
        route.lodging_name,
        route.lodging_nights ? `${route.lodging_nights} 晚` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '暂不预订';

  return (
    <div className="mx-auto max-w-3xl">
      {/* 基本信息（只读） */}
      <div className={cardCls}>
        <h1 className="text-xl font-bold">{route.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {cityName ?? '未指定城市'} · {route.days} 天 · 市内交通
          {TRANSPORT_LABEL[route.transport]} · 出发城市 {route.origin_city ?? '未填写'} · 城际交通{' '}
          {intercityText} · 住宿 {lodgingText}
        </p>
      </div>

      {/* 出行设置卡 */}
      <div className="mt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            出行设置（出发城市 / 城际交通 / 终点住宿）
          </h2>
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
            本原型新增字段，未接入真实票务或住宿服务
          </span>
        </div>
        <TripSettingsFields
          value={trip}
          onChange={(patch) => setTrip((prev) => ({ ...prev, ...patch }))}
          cityOptions={cityOptions}
          destCity={cityName}
          days={route.days}
          originError={originError}
        />
      </div>

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <p className="text-xs text-muted-foreground">
          顺序调整、重新生成等能力待阶段⑥实现；本页只保存出行设置。
        </p>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-6 font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {saving ? '保存中…' : '保存出行设置'}
        </button>
      </div>

      {toast ? (
        <div
          className={`fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm text-white shadow-lg ${
            toast.tone === 'ok' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}
