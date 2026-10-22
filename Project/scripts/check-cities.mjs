#!/usr/bin/env node
/**
 * 城市数据一致性校验（T-002）。
 *
 * 核对三处必须一致的城市来源：
 *   ① Project/config/cities.ts 的 CITIES 数组
 *   ② Project/supabase/migrations/011_seed_cities.sql 的 seed 行
 *   ③ 库内 public.cities 实际行数（只读 GET）
 *
 * 背景：曾按 `grep -c "name: "` 误判为 104 城，实际 CITIES 为 92 城，与库、迁移完全一致
 * （见 docs/known-issues.md B9 已撤销）。本脚本用 AST 计数，避免同类误判。
 *
 * 用法：cd Project && node scripts/check-cities.mjs   （或 npm run check:cities）
 * 只读：不写库、不改文件。任一处不一致 → 退出码 1。
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');
const CITIES_TS = path.join(ROOT, 'config/cities.ts');
const SEED_SQL = path.join(ROOT, 'supabase/migrations/011_seed_cities.sql');

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
      found = node.initializer.elements.map((el) => {
        // 每个元素形如 { name: '北京', adcode: '110000' }
        let name = null;
        if (ts.isObjectLiteralExpression(el)) {
          for (const p of el.properties) {
            if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'name') {
              if (ts.isStringLiteral(p.initializer)) name = p.initializer.text;
            }
          }
        }
        return name;
      }).filter(Boolean);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** 从 seed 迁移里取 ('城市名', '110000') 形式 */
function readCitiesFromSeed() {
  const sql = fs.readFileSync(SEED_SQL, 'utf8');
  const names = [...sql.matchAll(/\('([^']+)',\s*'(\d{6})'\)/g)].map((m) => m[1]);
  return names;
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
    const res = await fetch(`${base}/rest/v1/cities?select=name`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const rows = await res.json();
    return { names: rows.map((r) => r.name) };
  } catch (e) {
    return { error: e.name === 'TimeoutError' ? '8s 超时' : e.message };
  }
}

const tsNames = readCitiesFromTs();
const seedNames = readCitiesFromSeed();
const db = await readCitiesFromDb();

const lines = [];
const push = (s) => lines.push(s);
push('');
push('城市数据一致性校验 · ' + new Date().toLocaleString('zh-CN'));
push('');
push(`① config/cities.ts  CITIES      ：${tsNames ? tsNames.length : '读取失败'} 个`);
push(`② 011_seed_cities.sql           ：${seedNames.length} 个`);
push(`③ 库内 public.cities            ：${db.names ? db.names.length + ' 个' : '读取失败（' + db.error + '）'}`);
push('');

let ok = true;

if (!tsNames) {
  push('❌ 无法从 config/cities.ts 解析 CITIES');
  ok = false;
}

if (tsNames && seedNames.length) {
  const a = new Set(tsNames), b = new Set(seedNames);
  const onlyTs = [...a].filter((n) => !b.has(n));
  const onlySeed = [...b].filter((n) => !a.has(n));
  if (onlyTs.length || onlySeed.length) {
    ok = false;
    push(`❌ config 与 011 迁移不一致：仅 config 有 [${onlyTs.join(', ') || '无'}]；仅迁移有 [${onlySeed.join(', ') || '无'}]`);
  } else {
    push('✅ config/cities.ts 与 011_seed_cities.sql 城市集合一致');
  }
}

if (db.names) {
  const a = new Set(tsNames || []);
  const c = new Set(db.names);
  const onlyCfg = [...a].filter((n) => !c.has(n));
  const onlyDb = [...c].filter((n) => !a.has(n));
  if (onlyCfg.length || onlyDb.length) {
    ok = false;
    push(`❌ config 与库内不一致：仅 config 有 [${onlyCfg.join(', ') || '无'}]；仅库内有 [${onlyDb.join(', ') || '无'}]`);
  } else {
    push('✅ config/cities.ts 与库内 cities 城市集合一致');
  }
}

if (tsNames && db.names && tsNames.length !== db.names.length) {
  ok = false;
  push(`❌ 数量不一致：config ${tsNames.length} vs 库内 ${db.names.length}`);
}

push('');
push(ok ? '三处一致。' : '存在不一致，见上方明细。');
push('');
console.log(lines.join('\n'));
process.exit(ok ? 0 : 1);
