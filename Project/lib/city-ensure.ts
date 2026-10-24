/**
 * T-043：城市自动入库公共逻辑（原 api/places 内 ensureCityInDb 抽出，两处共用）。
 * /api/ai/extract 识别出城市后立即调用（仅登录用户；游客只读不写），
 * api/places 收藏时仍作为兜底（幂等：同名城市已存在则直接返回原 id）。
 */
import { CITIES } from '@/config/cities';
import { resolveCityAdcode } from '@/lib/amap';
import { createAdminClient } from '@/lib/supabase/admin';

/** 入库结果：新加入 isNew=true；已存在（或并发撞唯一索引回查命中）isNew=false */
export interface EnsuredCity {
  id: string;
  isNew: boolean;
}

/**
 * 确保城市存在于 public.cities，返回 { id, isNew }；确实写不进返回 null。
 * cities 表 RLS 只有 SELECT 策略，写入走 service_role 客户端；
 * adcode 优先取 config/cities.ts 已核实的编码（保证与种子迁移一致，如喀什=653101），
 * 不在 config 里再用高德 config/district 解析（返回名与查询词完全一致才采用），
 * 解析不到写空串（字段 NOT NULL 但允许空串；注意 adcode 有唯一索引，
 * 两个都解析失败的空串行会冲突，此时按插入失败降级）。
 */
export async function ensureCityInDb(name: string): Promise<EnsuredCity | null> {
  const admin = createAdminClient();

  // 前置查询：已在库 → 幂等返回，不重复写（extract 阶段入库后，places 收藏兜底调用走这里）
  const { data: existing } = await admin
    .from('cities')
    .select('id')
    .eq('name', name)
    .maybeSingle();
  if (existing?.id) return { id: existing.id as string, isNew: false };

  const adcode = CITIES.find((c) => c.name === name)?.adcode ?? (await resolveCityAdcode(name));

  const { data: inserted, error } = await admin
    .from('cities')
    .insert({ name, adcode })
    .select('id')
    .maybeSingle();
  if (!error && inserted?.id) return { id: inserted.id as string, isNew: true };

  // 唯一索引冲突多半是并发同名插入：按名称回查
  const { data: recheck } = await admin
    .from('cities')
    .select('id')
    .eq('name', name)
    .maybeSingle();
  return recheck?.id ? { id: recheck.id as string, isNew: false } : null;
}
