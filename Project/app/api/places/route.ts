import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { IMPORT_SOURCE, IMPORT_STATUS, PLACE_TYPE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { createClient } from '@/lib/supabase/server';
import type { ImportSource, PlaceType } from '@/types';

/**
 * U06 批量写入地点（AI 提取结果 / 手动添加统一走这里）
 * POST /api/places
 * body: { routeId?, cityId?, source?, rawText?, items: { name, type, note? }[] }
 *
 * 只写 places（is_collected = true，进入收藏库）与可选的 imports 记录；
 * 是否加入路线由 U07 勾选后经 PUT /api/routes/[id]/places 完成。
 */

const PLACE_TYPE_VALUES: readonly string[] = Object.values(PLACE_TYPE);
const IMPORT_SOURCE_VALUES: readonly string[] = Object.values(IMPORT_SOURCE);

interface ItemInput {
  name?: unknown;
  type?: unknown;
  note?: unknown;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: '请先登录' }, { status: 401 });
  }

  let body: {
    routeId?: unknown;
    cityId?: unknown;
    source?: unknown;
    rawText?: unknown;
    items?: unknown;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }
  if (body.items.length > BUSINESS.MAX_AI_EXTRACT) {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const items: { name: string; type: PlaceType; note: string | null }[] = [];
  for (const raw of body.items as ItemInput[]) {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    const type = raw?.type;
    if (!name || typeof type !== 'string' || !PLACE_TYPE_VALUES.includes(type)) {
      return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
    }
    const note = typeof raw?.note === 'string' ? raw.note.trim() : '';
    items.push({ name, type: type as PlaceType, note: note || null });
  }

  const cityId = typeof body.cityId === 'string' && body.cityId ? body.cityId : null;

  const sourceRaw = body.source;
  const source: ImportSource | null =
    typeof sourceRaw === 'string' && IMPORT_SOURCE_VALUES.includes(sourceRaw)
      ? (sourceRaw as ImportSource)
      : null;

  const rawText = typeof body.rawText === 'string' ? body.rawText.trim() : '';

  // 同一用户 + 同城市下按 name 去重
  const { data: existing, error: readError } = await supabase
    .from('places')
    .select('name,city_id')
    .eq('user_id', user.id);
  if (readError) {
    return NextResponse.json({ ok: false, message: MESSAGES.NETWORK_ERROR }, { status: 500 });
  }

  const existingKeys = new Set(
    (existing ?? [])
      .filter((p) => (cityId ? p.city_id === cityId : p.city_id === null))
      .map((p) => p.name),
  );

  const toInsert = items.filter((it) => {
    if (existingKeys.has(it.name)) return false;
    // 同一次提交内的重名也要跳过
    existingKeys.add(it.name);
    return true;
  });

  const skipped = items.length - toInsert.length;

  if (toInsert.length === 0) {
    if (rawText) {
      await supabase.from('imports').insert({
        user_id: user.id,
        raw_text: rawText,
        source: source ?? IMPORT_SOURCE.MANUAL,
        status: IMPORT_STATUS.UNRECOGNIZED,
      });
    }
    return NextResponse.json({ ok: true, inserted: 0, skipped });
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from('places')
    .insert(
      toInsert.map((it) => ({
        user_id: user.id,
        city_id: cityId,
        name: it.name,
        type: it.type,
        note: it.note,
        source,
        is_collected: true,
        geo_status: 'pending',
      })),
    )
    .select('id');

  if (insertError) {
    return NextResponse.json({ ok: false, message: MESSAGES.NETWORK_ERROR }, { status: 500 });
  }

  const inserted = insertedRows?.length ?? 0;

  // 导入记录为审计用途，写入失败不阻断主流程
  if (rawText) {
    await supabase.from('imports').insert({
      user_id: user.id,
      raw_text: rawText,
      source: source ?? IMPORT_SOURCE.MANUAL,
      status: inserted > 0 ? IMPORT_STATUS.SUCCESS : IMPORT_STATUS.UNRECOGNIZED,
    });
  }

  return NextResponse.json({ ok: true, inserted, skipped });
}
