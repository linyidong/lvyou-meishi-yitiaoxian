#!/usr/bin/env node
/**
 * 城市数据一致性校验（T-002；T-042 调整口径）。
 *
 * 核对三处城市来源：
 *   ① Project/config/cities.ts 的 CITIES 数组（name + adcode）
 *   ② 种子迁移 011_seed_cities.sql 与 029_seed_niche_cities.sql 的 seed 行（并集）
 *   ③ 库内 public.cities 实际数据（只读 GET）
 *
 * 口径（T-042）：
 *   - config 与迁移并集必须一致（名称与 adcode 都要一致），否则失败；
 *   - 库里多出的城市（AI 识别自动入库的新城市）只列出提示，不算失败；
 *   - 已应用种子（011）里有而库里没有 → 仍失败；
 *   - 仅存在于待执行迁移（029）里的城市而库里没有 → 只提示「等待迁移执行」，不算失败
 *     （迁移执行后该行自然消失；新增待执行种子迁移时需同步更新本脚本的 PENDING_SEEDS）。
 *
 * 背景：曾按 `grep -c "name: "` 误判为 104 城（见 docs/known-issues.md B9 已撤销）。
 * 本脚本用 AST 计数，避免同类误判。
 *
 * 用法：cd Project && node scripts/check-cities.mjs   （或 npm run check:cities）
 * 只读：不写库、不改文件。触发失败条件 → 退出码 1。
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
const CITIES_TS = path.join(ROOT, 'config/cities.ts');
const APPLIED_SEED_SQL = path.join(ROOT, 'supabase/migrations/011_seed_cities.sql');
/** 待执行种子迁移：库内缺失时只提示，不算失败（T-042） */
const PENDING_SEED_SQLS = [path.join(ROOT, 'supabase/migrations/029_seed_niche_cities.sql')];

/** 用 TypeScript AST 取 CITIES 数组的字面量元素（不执行模块，避免拉入 lucide-react 等运行时依赖） */
function readCitiesFromTs() {
  const src = fs.readFileSync(CITIES_TS, 'utf8');
  const sf = ts.createSourceFile(CITIES_TS, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let found = null;
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'CITIES' &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      found = node.initializer.elements
        .map((el) => {
          // 每个元素形如 { name: '北京', adcode: '110000' }
          let name = null;
          let adcode = null;
          if (ts.isObjectLiteralExpression(el)) {
            for (const p of el.properties) {
              if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && ts.isStringLiteral(p.initializer)) {
                if (p.name.text === 'name') name = p.initializer.text;
                if (p.name.text === 'adcode') adcode = p.initializer.text;
              }
            }
          }
          return name ? { name, adcode } : null;
        })
        .filter(Boolean);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** 从 seed 迁移里取 ('城市名', '110000') 形式 */
function readCitiesFromSeed(file) {
  const sql = fs.readFileSync(file, 'utf8');
  return [...sql.matchAll(/\('([^']+)',\s*'(\d{6})'\)/g)].map((m) => ({ name: m[1], adcode: m[2] }));
}

/** 读 .env.local（只取值，不打印） */
function loadEnv() {
  const p = path.join(ROOT, '.env.local');
  if (!fs.existsSync(p)) return {};
  const env = {};
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#') || !s.includes('=')) continue;
    const i = s.indexOf('=');
    env[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

async function readCitiesFromDb() {
  const env = loadEnv();
  const base = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return { error: '缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' };
  try {
    const res = await fetch(`${base}/rest/v1/cities?select=name,adcode`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const rows = await res.json();
    return { rows: rows.map((r) => ({ name: r.name, adcode: r.adcode })) };
  } catch (e) {
    return { error: e.name === 'TimeoutError' ? '8s 超时' : e.message };
  }
}

const tsCities = readCitiesFromTs();
const appliedSeed = readCitiesFromSeed(APPLIED_SEED_SQL);
const pendingSeed = PENDING_SEED_SQLS.flatMap(readCitiesFromSeed);

/** 迁移并集（name -> adcode）；同名不同 adcode 直接视为迁移自身不一致 */
const seedMap = new Map();
const seedConflicts = [];
for (const c of [...appliedSeed, ...pendingSeed]) {
  const prev = seedMap.get(c.name);
  if (prev === undefined) seedMap.set(c.name, c.adcode);
  else if (prev !== c.adcode) seedConflicts.push(`${c.name}（${prev} vs ${c.adcode}）`);
}

const db = await readCitiesFromDb();

const lines = [];
const push = (s) => lines.push(s);
push('');
push('城市数据一致性校验 · ' + new Date().toLocaleString('zh-CN'));
push('');
push(`① config/cities.ts  CITIES      ：${tsCities ? tsCities.length : '读取失败'} 个`);
push(`② 011_seed_cities.sql           ：${appliedSeed.length} 个（已应用种子）`);
push(`③ 029_seed_niche_cities.sql     ：${pendingSeed.length} 个（待执行种子）`);
push(`④ 库内 public.cities            ：${db.rows ? db.rows.length + ' 个' : '读取失败（' + db.error + '）'}`);
push('');

let ok = true;

if (!tsCities) {
  push('❌ 无法从 config/cities.ts 解析 CITIES');
  ok = false;
}

if (seedConflicts.length) {
  ok = false;
  push(`❌ 迁移种子内部冲突（同名不同 adcode）：[${seedConflicts.join(', ')}]`);
}

// —— config 与迁移并集：必须一致（名称 + adcode）——
if (tsCities) {
  const tsMap = new Map(tsCities.map((c) => [c.name, c.adcode]));
  const onlyTs = [...tsMap.keys()].filter((n) => !seedMap.has(n));
  const onlySeed = [...seedMap.keys()].filter((n) => !tsMap.has(n));
  const adcodeDiff = [...tsMap.entries()].filter(
    ([n, a]) => seedMap.has(n) && seedMap.get(n) !== a,
  );
  if (onlyTs.length || onlySeed.length || adcodeDiff.length) {
    ok = false;
    if (onlyTs.length || onlySeed.length) {
      push(`❌ config 与迁移不一致：仅 config 有 [${onlyTs.join(', ') || '无'}]；仅迁移有 [${onlySeed.join(', ') || '无'}]`);
    }
    if (adcodeDiff.length) {
      push(`❌ adcode 不一致：[${adcodeDiff.map(([n, a]) => `${n} config=${a} 迁移=${seedMap.get(n)}`).join(', ')}]`);
    }
  } else {
    push(`✅ config/cities.ts 与迁移种子（011+029）一致：${tsMap.size} 城`);
  }
}

// —— 库内比对：多出的只提示；已应用种子缺失才失败 ——
if (db.rows && tsCities) {
  const tsMap = new Map(tsCities.map((c) => [c.name, c.adcode]));
  const dbMap = new Map(db.rows.map((c) => [c.name, c.adcode]));
  const pendingNames = new Set(pendingSeed.map((c) => c.name));

  const onlyDb = [...dbMap.keys()].filter((n) => !tsMap.has(n));
  const missingDb = [...tsMap.keys()].filter((n) => !dbMap.has(n));
  const missingApplied = missingDb.filter((n) => !pendingNames.has(n));
  const missingPending = missingDb.filter((n) => pendingNames.has(n));

  if (onlyDb.length) {
    push(`ℹ️ 库里多出 ${onlyDb.length} 个 config/迁移之外的城市（AI 自动入库，不算失败）：[${onlyDb.join(', ')}]`);
  }
  if (missingApplied.length) {
    ok = false;
    push(`❌ config/已应用种子里有而库里没有：[${missingApplied.join(', ')}]`);
  }
  if (missingPending.length) {
    push(`ℹ️ 待执行迁移 029 有而库里没有（执行迁移后消失，不算失败）：[${missingPending.join(', ')}]`);
  }
  const adcodeMismatch = [...dbMap.entries()].filter(
    ([n, a]) => tsMap.has(n) && tsMap.get(n) !== a,
  );
  if (adcodeMismatch.length) {
    ok = false;
    push(`❌ 库里 adcode 与 config 不一致：[${adcodeMismatch.map(([n, a]) => `${n} 库=${a} config=${tsMap.get(n)}`).join(', ')}]`);
  }
  if (!onlyDb.length && !missingApplied.length && !missingPending.length && !adcodeMismatch.length) {
    push('✅ config/cities.ts 与库内 cities 一致');
  }
}

push('');
push(ok ? '校验通过。' : '存在不一致，见上方明细。');
push('');
console.log(lines.join('\n'));
process.exit(ok ? 0 : 1);
