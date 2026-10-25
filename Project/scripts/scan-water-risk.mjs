#!/usr/bin/env node
/**
 * 全库「水体风险」扫描（T-058 追加三，默认只读）。
 *
 * 背景：「南门湾」这类名字，高德第一条常是「自然地名;海湾海峡」的水面中心点，
 * 标注会落在海里。修复后的 searchPlaces 用打分规则优先岸上景区/街道，但存量数据仍是旧点位。
 *
 * 本脚本对每条已定位地点做同城检索（同 app 的 citylimit + adcode 过滤 + 打分），
 * 对比「库内坐标」与「打分后的最佳 POI 坐标」：
 *   - 距离 > 500m → 疑似位置错误（可能是水体中心点/串城/旧数据）
 *   - 最佳 POI 类型属于水体（海湾/河流/湖泊/海域/水库/海峡/自然地名）→ 标水体
 *
 * 用法：
 *   node scripts/scan-water-risk.mjs            # 扫描并打印报告（不写库）
 *   node scripts/scan-water-risk.mjs --json out.json  # 额外落盘 JSON
 * 只读：仅 SELECT + 高德 place/text（不写库）。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST_THRESHOLD_M = 500;
/** 默认只扫前 N 条（防止一次跑满高德单 Key 日配额）；--all 扫全库 */
const DEFAULT_LIMIT = 300;
const CONCURRENCY = 2;
const RETRIES = 5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#') || !s.includes('=')) continue;
    const i = s.indexOf('=');
    env[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const SB = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
// 高德 Key 池：单 Key 可能当日配额用尽（10044），轮换使用
const AMAP_KEYS = [env.AMAP_WEB_SERVICE_KEY, env.AMAP_WEB_SERVICE_KEY_2].filter(Boolean);
const exhausted = new Set();
let keyCursor = 0;
function nextKey() {
  for (let i = 0; i < AMAP_KEYS.length; i += 1) {
    const idx = (keyCursor + i) % AMAP_KEYS.length;
    if (!exhausted.has(idx)) {
      keyCursor = (idx + 1) % AMAP_KEYS.length;
      return AMAP_KEYS[idx];
    }
  }
  return '';
}

async function sql(query) {
  const res = await fetch(`${SB}/pg/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 200));
  const json = JSON.parse(text);
  if (json.error) throw new Error(json.error);
  return json;
}

const WATER = /海湾|河流|湖泊|海域|水库|海峡|滩涂|湿地/;
const GOOD = /风景名胜|餐饮|购物|道路|交通设施|科教文化|体育休闲|住宿服务/;
const FACILITY = /停车场|停车库|公交车站|公交站|出入口|入口|出口|收费站|服务区/;
const asText = (v) => (Array.isArray(v) ? v.join('') : String(v ?? ''));

/** 与 lib/amap.ts adcodeWithin 同规则：直辖市比前2位、地级市比前4位、区县精确相等 */
function adcodeWithin(poiAdcode, targetAdcode) {
  const poi = String(poiAdcode ?? '').trim();
  const target = String(targetAdcode ?? '').trim();
  if (!/^\d{6}$/.test(poi) || !/^\d{6}$/.test(target)) return false;
  if (target.endsWith('0000')) return poi.slice(0, 2) === target.slice(0, 2);
  if (target.endsWith('00')) return poi.slice(0, 4) === target.slice(0, 4);
  return poi === target;
}

function score(p, kw) {
  const type = asText(p.type);
  const addr = asText(p.address).trim();
  let s = 0;
  if (WATER.test(type)) s -= 5;
  if (FACILITY.test(type)) s -= 3;
  if (/风景名胜|景点/.test(type)) s += 5;
  else if (GOOD.test(type)) s += 2;
  if (addr && addr !== '[]' && addr !== p.name) s += 2;
  if (p.name === kw || p.name.startsWith(kw)) s += 2;
  return s;
}

function haversineM(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function searchTop(name, adcode) {
  const url = new URL('https://restapi.amap.com/v3/place/text');
  const key = nextKey();
  if (!key) throw new Error('AMAP_KEYS_EXHAUSTED');
  for (const [k, v] of Object.entries({
    key,
    keywords: name,
    city: adcode,
    citylimit: 'true',
    offset: '20',
    page: '1',
    extensions: 'all',
  })) {
    url.searchParams.set(k, v);
  }
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      if (data.status === '1') {
        return (data.pois ?? [])
          .filter((p) => adcodeWithin(p.adcode, adcode))
          .map((p, i) => ({ p, i, s: score(p, name) }))
          .sort((a, b) => b.s - a.s || a.i - b.i)
          .map((x) => x.p);
      }
      // 配额用尽（10044）→ 标记该 Key 并立刻换 Key 重试；其它错误退避
      if (String(data.infocode) === '10044') {
        const idx = AMAP_KEYS.indexOf(key);
        if (idx >= 0) exhausted.add(idx);
        continue;
      }
      await sleep(600 * attempt);
    } catch {
      await sleep(600 * attempt);
    }
  }
  throw new Error('AMAP_RETRY_EXHAUSTED');}

async function main() {
  const args = process.argv.slice(2);
  const jsonIdx = args.indexOf('--json');
  const jsonPath = jsonIdx >= 0 ? args[jsonIdx + 1] : '';
  const limitIdx = args.indexOf('--limit');
  const scanAll = args.includes('--all');
  const limit = scanAll
    ? Number.POSITIVE_INFINITY
    : limitIdx >= 0
      ? Number(args[limitIdx + 1]) || DEFAULT_LIMIT
      : DEFAULT_LIMIT;

  const allRows = await sql(
    'select p.id,p.name,p.address,p.lat,p.lng,p.geo_status,c.name as city,c.adcode from places p join cities c on c.id=p.city_id where p.geo_status=\'matched\' and p.lat is not null and p.lng is not null order by c.name,p.name',
  );
  const rows = Number.isFinite(limit) ? allRows.slice(0, limit) : allRows;
  console.log(`扫描 ${rows.length}/${allRows.length} 条已定位地点（阈值 ${DIST_THRESHOLD_M}m，并发 ${CONCURRENCY}）${Number.isFinite(limit) ? '\n提示：默认只扫前 ' + DEFAULT_LIMIT + ' 条，全库请加 --all（约 1,400 次高德调用，注意日配额）' : ''}…\n`);

  const findings = [];
  let done = 0;
  let evaluated = 0;
  let noPoi = 0;
  let failed = 0;
  const queue = [...rows];

  async function worker() {
    for (let row; (row = queue.shift()); ) {
      done += 1;
      if (done % 100 === 0) console.log(`  进度 ${done}/${rows.length}`);
      const adcode = String(row.adcode);
      if (!/^\d{6}$/.test(adcode)) continue;
      let pois = [];
      try {
        pois = await searchTop(row.name, adcode);
      } catch {
        failed += 1;
        continue;
      }
      if (pois.length === 0) {
        noPoi += 1;
        continue;
      }
      evaluated += 1;
      const best = pois[0];
      const [lng, lat] = String(best.location ?? '').split(',').map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const dist = haversineM(
        { lat: Number(row.lat), lng: Number(row.lng) },
        { lat, lng },
      );
      const bestType = asText(best.type);
      // 关键判定：库里坐标「离哪个 POI 最近」，若最近的 POI 是水体类型 → 点在水面上
      let nearest = null;
      for (const poi of pois) {
        const [plng, plat] = String(poi.location ?? '').split(',').map(Number);
        if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
        const d = haversineM(
          { lat: Number(row.lat), lng: Number(row.lng) },
          { lat: plat, lng: plng },
        );
        if (!nearest || d < nearest.d) nearest = { d, poi, type: asText(poi.type), name: poi.name };
      }
      const storedIsWaterType =
        !!nearest && nearest.d < 60 && WATER.test(nearest.type);
      if (dist > DIST_THRESHOLD_M || storedIsWaterType) {
        findings.push({
          id: row.id,
          name: row.name,
          city: row.city,
          adcode,
          stored: {
            lat: Number(row.lat),
            lng: Number(row.lng),
            address: row.address,
          },
          suggested: {
            name: best.name,
            type: bestType,
            lat,
            lng,
            address: asText(best.address),
          },
          distanceM: Math.round(dist),
          nearest: nearest
            ? { name: nearest.name, type: nearest.type, distanceM: Math.round(nearest.d) }
            : null,
          reason: storedIsWaterType ? '落在水体 POI 上' : dist > 1000 ? '位置偏差 >1km' : '位置偏差 500m–1km',
        });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  findings.sort((a, b) => b.distanceM - a.distanceM);
  const waterOnes = findings.filter((f) => f.reason === '落在水体 POI 上');
  console.log(`水体点 ${waterOnes.length} 条；其它偏差 ${findings.length - waterOnes.length} 条`);
  for (const f of waterOnes) {
    console.log(
      `- [水体] ${f.city}/${f.name} (${f.id}) 最近POI「${f.nearest?.name ?? ''}」${f.nearest?.type ?? ''} 距 ${f.nearest?.distanceM ?? '?'}m → 建议 ${f.suggested.lng},${f.suggested.lat}「${f.suggested.name}」`,
    );
  }
  console.log(`\n完成：评估 ${evaluated} 条，无同城结果 ${noPoi} 条，接口失败 ${failed} 条；疑似风险 ${findings.length} 条\n`);
  for (const f of findings.slice(0, 40)) {
    console.log(
      `- [${f.reason}] ${f.city}/${f.name} (${f.id})\n    库内 ${f.stored.lng},${f.stored.lat}「${f.stored.address ?? ''}」\n    建议 ${f.suggested.lng},${f.suggested.lat}「${f.suggested.name} / ${f.suggested.type}」 偏差 ${f.distanceM}m`,
    );
  }
  if (findings.length > 40) console.log(`… 其余 ${findings.length - 40} 条见 JSON`);

  if (jsonPath) {
    fs.writeFileSync(jsonPath, JSON.stringify(findings, null, 2));
    console.log(`\nJSON → ${jsonPath}`);
  }
  console.log('\n本脚本只读，未改动数据库。');
}

main().catch((e) => {
  console.error('扫描失败:', e.message);
  process.exit(1);
});
