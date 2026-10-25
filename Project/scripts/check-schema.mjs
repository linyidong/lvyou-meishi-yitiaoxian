#!/usr/bin/env node
/**
 * 库结构体检（Q-002）。
 *
 * 背景：项目 31 份迁移都是手工用 `/pg/query` 执行的，库里**没有** supabase_migrations 记录表，
 * 所以无法用"迁移表"核对是否都应用过。本脚本改为按**对象存在性**核对：
 * 表 / 函数 / 约束 / 关键列 / pg_cron 任务 / RLS 开关。
 *
 * 清单来源：`supabase/migrations/*.sql` 里 grep 出的 create table / function / constraint / add column。
 * 迁移新增对象时应同步更新本文件（否则会出现漏检而不是误报）。
 *
 * 用法：cd Project && npm run check:schema
 * 只读：仅 SELECT information_schema / pg_catalog / cron.job。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const EXPECT = {
  tables: [
    'users', 'places', 'cities', 'routes', 'route_places', 'route_shares',
    'member_orders', 'member_logs', 'user_daily_usage', 'amap_usage',
    'amap_leg_cache', 'amap_geocode_cache', 'imports', 'events', 'app_settings',
  ],
  functions: [
    'handle_new_user', 'is_admin', 'prevent_member_self_grant', 'prevent_role_change',
    'sync_admin_member', 'bump_amap_usage', 'bump_user_daily_usage', 'get_user_daily_usage',
    'replace_route_places', 'approve_member_order',
  ],
  constraints: [
    'route_places_slot_uniq', 'route_places_route_place_uniq',
    'user_daily_usage_kind_check', 'users_member_source_check',
    'routes_transport_check', 'routes_intercity_mode_check', 'routes_lodging_type_check',
    'places_source_check', 'places_geo_status_check', 'member_orders_pay_channel_check',
  ],
  columns: {
    routes: ['imported_from', 'origin_city', 'intercity_mode', 'lodging_type', 'lodging_name', 'lodging_area', 'lodging_nights'],
    users: ['member', 'member_since', 'member_source', 'member_until', 'trial_multi_day_used'],
    places: ['is_collected', 'source', 'geo_status'],
    amap_usage: ['key_slot'],
    member_orders: ['pay_channel'],
  },
  cronJobs: ['expire-members'],
  rlsTables: ['users', 'places', 'routes', 'route_places', 'route_shares', 'member_orders', 'member_logs', 'user_daily_usage', 'app_settings'],
};

function loadEnv() {
  const p = path.join(ROOT, '.env.local');
  const env = {};
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#') || !s.includes('=')) continue;
    const i = s.indexOf('=');
    env[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const base = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) {
  console.error('缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(`${base}/pg/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL 失败: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

const rows = [];

function report(group, name, ok, detail = '') {
  rows.push({ group, name, ok, detail });
}

const tables = new Set(
  (await sql(`select table_name from information_schema.tables where table_schema='public'`)).map((r) => r.table_name),
);
for (const t of EXPECT.tables) report('表', t, tables.has(t));

const funcs = new Set(
  (await sql(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`)).map((r) => r.proname),
);
for (const f of EXPECT.functions) report('函数', f, funcs.has(f));

const cons = new Set(
  (await sql(`select conname from pg_constraint`)).map((r) => r.conname),
);
for (const c of EXPECT.constraints) report('约束', c, cons.has(c));

for (const [table, cols] of Object.entries(EXPECT.columns)) {
  const actual = new Set(
    (await sql(`select column_name from information_schema.columns where table_schema='public' and table_name='${table}'`)).map((r) => r.column_name),
  );
  for (const c of cols) report('列', `${table}.${c}`, actual.has(c));
}

const cronExists = (await sql(`select count(*)::int as n from pg_extension where extname='pg_cron'`))[0].n > 0;
report('扩展', 'pg_cron', cronExists);
if (cronExists) {
  const jobs = new Set((await sql(`select jobname from cron.job`)).map((r) => r.jobname));
  for (const j of EXPECT.cronJobs) report('定时任务', j, jobs.has(j));
} else {
  for (const j of EXPECT.cronJobs) report('定时任务', j, false, 'pg_cron 未安装');
}

const rls = new Map(
  (await sql(`select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r'`))
    .map((r) => [r.relname, r.relrowsecurity]),
);
for (const t of EXPECT.rlsTables) report('RLS', t, rls.get(t) === true);

const bad = rows.filter((r) => !r.ok);
const lines = [];
lines.push('');
lines.push(`库结构体检 · ${new Date().toLocaleString('zh-CN')} · ${base}`);
lines.push('');
let lastGroup = '';
for (const r of rows) {
  if (r.group !== lastGroup) {
    lines.push(`【${r.group}】`);
    lastGroup = r.group;
  }
  lines.push(`  ${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? `（${r.detail}）` : ''}`);
}
lines.push('');
lines.push(bad.length === 0 ? `全部通过（${rows.length} 项）。` : `缺失 ${bad.length} 项：${bad.map((b) => b.name).join(', ')}`);
lines.push('');
console.log(lines.join('\n'));
process.exit(bad.length === 0 ? 0 : 1);
