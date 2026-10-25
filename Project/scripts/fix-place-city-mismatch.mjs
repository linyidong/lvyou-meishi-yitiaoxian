#!/usr/bin/env node
/**
 * T-058 存量地点「串城」修复脚本（默认 dry-run，--apply 才写库）。
 *
 * 背景：旧版 searchPlaces 未传 citylimit，同名 POI 会被匹配到其它城市
 * （例：东山 350626 的「铜陵夜市」被写成安徽铜陵坐标 117.856/30.960）。
 *
 * 流程：
 *  1. 拉取 geo_status=matched 且有坐标的 places（带所属城市 name/adcode）；
 *  2. 逐条用高德 regeo 反查坐标实际区划：adcode 前 4 位与所属城市前 4 位不一致、
 *     且 cityname 与城市名不同名（兼容直辖市）→ 判为「串城」；
 *  3. 对串城记录用 citylimit=true + adcode 重新解析：
 *     - 命中同城 → 更新 lat/lng/address，geo_status=matched；
 *     - 未命中   → address=null、lat/lng=null、geo_status=unmatched（保留名称与收藏关系）；
 *  4. 默认只打印计划（dry-run）；--apply 才 PATCH 写库（§5.1 写操作由 Harness 执行）。
 *
 * 用法（cd Project）：
 *   node scripts/fix-place-city-mismatch.mjs                  # 全量扫描，dry-run
 *   node scripts/fix-place-city-mismatch.mjs --city=东山      # 只扫某城市
 *   node scripts/fix-place-city-mismatch.mjs --ids=<uuid,...> # 只处理指定记录
 *   node scripts/fix-place-city-mismatch.mjs --apply          # 实际写库
 * 只读凭证来自 .env.local（不打印）；高德请求串行 ≥350ms 限速，与 lib/amap.ts 同口径。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const APPLY = process.argv.includes('--apply');
const cityArg = process.argv.find((a) => a.startsWith('--city='))?.slice(7);
const idsArg = process.argv.find((a) => a.startsWith('--ids='))?.slice(6);
const SLEEP_MS = 350;

function loadEnv() {
  const p = path.join(ROOT, '.env.local');
  if (!fs.existsSync(p)) return {};
  const env = {};
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i > 0) env[s.slice(0, i)] = s.slice(i + 1).replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const BASE = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || '';
const AMAP_KEY = (env.AMAP_WEB_SERVICE_KEY || '').trim();
const AMAP_PK = (env.AMAP_WEB_SERVICE_PRIVATE_KEY || '').trim();
if (!BASE || !KEY) {
  console.error('缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（.env.local）');
  process.exit(1);
}
if (!AMAP_KEY) {
  console.error('缺少 AMAP_WEB_SERVICE_KEY（.env.local）');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 高德请求（带可选数字签名 + 串行限速），返回 JSON；失败返回 null */
let lastAt = 0;
async function amapGet(pathname, params) {
  const wait = SLEEP_MS - (Date.now() - lastAt);
  if (wait > 0) await sleep(wait);
  lastAt = Date.now();
  const q = { key: AMAP_KEY, output: 'JSON', ...params };
  if (AMAP_PK) {
    const raw = Object.keys(q).sort().map((k) => `${k}=${q[k]}`).join('&');
    q.sig = createHash('md5').update(raw + AMAP_PK).digest('hex');
  }
  const url = new URL(`https://restapi.amap.com${pathname}`);
  Object.entries(q).forEach(([k, v]) => url.searchParams.set(k, v));
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const json = await res.json();
    return json.status === '1' ? json : null;
  } catch {
    return null;
  }
}

/** PostgREST 读（分页取全量） */
async function dbGet(resource, query) {
  const out = [];
  const PAGE = 500;
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${BASE}/rest/v1/${resource}?${query}&limit=${PAGE}&offset=${from}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    if (!res.ok) throw new Error(`读取 ${resource} 失败 HTTP ${res.status}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/** PostgREST 写（PATCH 单行） */
async function dbPatch(id, payload) {
  const res = await fetch(`${BASE}/rest/v1/places?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`更新 ${id} 失败 HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()).length;
}

/**
 * 与 lib/amap.ts searchPlaces 相同的同城判定：前 4 位一致 或 cityname 同名（兼容直辖市加「市」）。
 * 直辖市补充规则：库内 adcode 形如 110000/500000（后 4 位为 0），而 POI/regeo 返回区级
 * 110101/500103，前 4 位必然不等；此时改比前 2 位。regeo 对直辖市 city 字段为空数组，
 * 也拿不到 cityname，故该规则是直辖市唯一的可靠判定路径。
 */
function sameCity(poiAdcode, poiCityname, cityName, cityAdcode) {
  const poi = String(poiAdcode ?? '').trim();
  const target = String(cityAdcode ?? '').trim();
  if (!/^\d{6}$/.test(poi) || !/^\d{6}$/.test(target)) {
    return poiCityname === cityName || poiCityname === `${cityName}市`;
  }
  // 与 lib/amap.ts adcodeWithin 同规则：直辖市比前 2 位、地级市比前 4 位、区县必须精确相等
  if (target.endsWith('0000')) return poi.slice(0, 2) === target.slice(0, 2);
  if (target.endsWith('00')) return poi.slice(0, 4) === target.slice(0, 4);
  if (poi === target) return true;
  // 区县级目标不应靠 cityname 兜底（漳州市 ≠ 东山县），仅当地级市时才有意义
  return false;
}

async function main() {
  let query = 'select=id,name,address,lat,lng,geo_status,city_id,cities(name,adcode)&geo_status=eq.matched&lat=not.is.null&lng=not.is.null';
  if (idsArg) query += `&id=in.(${idsArg.split(',').map((s) => s.trim()).join(',')})`;
  const rows = await dbGet('places', query);
  const scoped = cityArg ? rows.filter((r) => r.cities?.name === cityArg) : rows;
  const withCity = scoped.filter((r) => r.cities?.name && /^\d{6}$/.test(String(r.cities.adcode ?? '')));
  console.log(`扫描范围：matched 且有坐标 ${rows.length} 条${cityArg ? `，城市=${cityArg}` : ''}；可判定（城市有 adcode）${withCity.length} 条`);

  // 1. regeo 反查找串城
  const mismatches = [];
  for (const row of withCity) {
    const rg = await amapGet('/v3/geocode/regeo', { location: `${row.lng},${row.lat}`, extensions: 'base' });
    if (!rg) continue;
    const comp = rg.regeocode?.addressComponent ?? {};
    const adcode = String(comp.adcode ?? '');
    const cityname = String(comp.city ?? '');
    if (adcode && !sameCity(adcode, cityname, row.cities.name, String(row.cities.adcode))) {
      mismatches.push({ row, actualAdcode: adcode, actualCity: cityname });
    }
  }
  console.log(`反查完成：疑似串城 ${mismatches.length} 条`);

  // 2. 重新解析 + 计划
  const plans = [];
  for (const m of mismatches) {
    const { row } = m;
    const cityAdcode = String(row.cities.adcode);
    const data = await amapGet('/v3/place/text', {
      keywords: row.name,
      city: cityAdcode,
      citylimit: 'true',
      offset: '20',
      page: '1',
      extensions: 'all',
    });
    const pois = data?.pois ?? [];
    const hit = pois.find((p) => {
      const loc = String(p.location ?? '').split(',').map(Number);
      return Number.isFinite(loc[0]) && Number.isFinite(loc[1]) &&
        sameCity(String(p.adcode ?? ''), String(p.cityname ?? ''), row.cities.name, cityAdcode);
    });
    if (hit) {
      const [lng, lat] = String(hit.location).split(',').map(Number);
      plans.push({
        id: row.id, name: row.name, city: row.cities.name,
        from: `${row.lng},${row.lat} 「${row.address ?? ''}」(实际 ${m.actualCity}/${m.actualAdcode})`,
        action: 'matched',
        payload: { lat, lng, address: String(hit.address ?? '') || hit.name, geo_status: 'matched' },
      });
    } else {
      plans.push({
        id: row.id, name: row.name, city: row.cities.name,
        from: `${row.lng},${row.lat} 「${row.address ?? ''}」(实际 ${m.actualCity}/${m.actualAdcode})`,
        action: 'unmatched',
        payload: { lat: null, lng: null, address: null, geo_status: 'unmatched' },
      });
    }
  }

  // 3. 输出 / 写库
  for (const p of plans) {
    console.log(`- [${p.action}] ${p.city}/${p.name} (${p.id})\n    现状: ${p.from}\n    计划: ${JSON.stringify(p.payload, null, 0)}`);
  }
  if (plans.length === 0) {
    console.log('没有需要修正的记录。');
    return;
  }
  if (!APPLY) {
    console.log(`\ndry-run：共 ${plans.length} 条待修正（matched ${plans.filter((p) => p.action === 'matched').length} / unmatched ${plans.filter((p) => p.action === 'unmatched').length}）。加 --apply 执行写库。`);
    return;
  }
  let done = 0;
  for (const p of plans) {
    done += await dbPatch(p.id, p.payload);
    await sleep(50);
  }
  console.log(`\n已写库：更新 ${done} 行（matched ${plans.filter((p) => p.action === 'matched').length} / unmatched ${plans.filter((p) => p.action === 'unmatched').length}）。`);
}

main().catch((err) => {
  console.error('脚本失败：', err);
  process.exit(1);
});
