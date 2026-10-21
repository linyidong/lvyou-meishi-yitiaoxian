#!/usr/bin/env node
/**
 * 开工自检：确认「网络 + 自建 Supabase + 本机 dev server」可用。
 *
 * 用法：
 *   cd Project && node scripts/check-env.mjs
 *
 * 只读：不会改数据库、不会重启任何服务。失败时给出下一步该做什么。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

/** 读 .env.local（只取值，不打印任何密钥） */
function loadEnv() {
  const p = path.join(ROOT, '.env.local');
  if (!fs.existsSync(p)) return { error: `找不到 ${p}` };
  const env = {};
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#') || !s.includes('=')) continue;
    const i = s.indexOf('=');
    env[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_AMAP_KEY',
  'AMAP_WEB_SERVICE_KEY',
  'DEEPSEEK_API_KEY',
];

const results = [];
const ok = (name, detail) => results.push({ name, pass: true, detail });
const bad = (name, detail, fix) => results.push({ name, pass: false, detail, fix });

const env = loadEnv();
if (env.error) {
  bad('读取 .env.local', env.error, '确认 Project/.env.local 存在（不要在仓库根，要在 Project/ 下）');
} else {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) {
    bad('环境变量', `缺少 ${missing.join(', ')}`, '补到 Project/.env.local 后重试');
  } else {
    ok('环境变量', `${REQUIRED.length} 个必需变量齐全（值不打印）`);
  }
}

if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')}/rest/v1/cities?select=id&limit=1`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      signal: AbortSignal.timeout(8000),
    });
    const ms = Date.now() - t0;
    if (res.ok) {
      ok('自建 Supabase', `REST 可达（/cities → ${res.status}，${ms}ms）`);
    } else {
      bad(
        '自建 Supabase',
        `HTTP ${res.status}（${ms}ms）`,
        '检查 192.168.1.11 上的 Docker 是否在跑；若刚重启容器，先热身一次 auth 接口再试（历史教训 L43）',
      );
    }
  } catch (e) {
    bad(
      '自建 Supabase',
      `连接失败：${e.name === 'TimeoutError' ? '8s 超时' : e.message}`,
      '① 确认和 192.168.1.11 在同一局域网（ping 一下）；② 在 Windows 那台机器上确认 Supabase Docker 容器在运行；③ 若 TCP 通但无响应，按 L42 用业务接口探活、必要时重启容器',
    );
  }
}

/* dev server：本机与局域网各探一次 */
for (const [label, url] of [
  ['dev server（本机）', 'http://127.0.0.1:3000/'],
  ['dev server（局域网）', 'http://192.168.1.12:3000/'],
]) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) ok(label, `HTTP ${res.status}`);
    else bad(label, `HTTP ${res.status}`, '可能有编译错误，看终端输出');
  } catch {
    bad(label, '未响应', 'cd Project && npm run dev -- -H 0.0.0.0 -p 3000');
  }
}

/* 报告 */
console.log('\n开工自检 · ' + new Date().toLocaleString('zh-CN') + '\n');
for (const r of results) {
  console.log(`${r.pass ? '✅' : '❌'} ${r.name}：${r.detail}`);
  if (!r.pass && r.fix) console.log(`   → ${r.fix}`);
}
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${failed === 0 ? '全部通过，可以开工。' : `${failed} 项未通过，按上面的 → 处理。`}\n`);
process.exit(failed === 0 ? 0 : 1);
