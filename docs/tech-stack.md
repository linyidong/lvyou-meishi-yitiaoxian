> 状态：已核对（Harness 2026-10-20 23:58 复核：版本/命令/风险均已抽样验证，数据库事实见 `known-issues.md` §0）

# 技术栈与运行环境（阶段 3 · P3）

> 证据口径：版本号一律以 `Project/package-lock.json` 锁定值为准（`node -e "require('./package-lock.json').packages[...]"` 实测输出），不采信 README/口头声明。
> 标记：`[已确认]`（带 文件:行 或命令输出）/ `[高度可能]` / `[未知]` / `[风险]`。

## 1. 语言 / 框架 / 运行时

| 项 | 版本 | 证据 | 标记 |
|---|---|---|---|
| Node.js（本机） | v24.21.0 | `node -v` 输出 `[已确认]` | `[已确认]` |
| npm（本机） | 11.19.0 | `npm -v` 输出 `[已确认]` | `[已确认]` |
| 项目声明的 Node 要求 | **无**（package.json 无 `engines` 字段） | `Project/package.json`（1-30 行无 engines）`[已确认]` | `[风险]` 版本约束未固化，换机器可能踩兼容坑 |
| TypeScript | 5.9.3 | `Project/package-lock.json` → `node_modules/typescript` `[已确认]` | `[已确认]` |
| TS 编译口径 | `strict: true`、target ES2017、`noEmit`、`moduleResolution: bundler`、别名 `@/* → ./*` | `Project/tsconfig.json`（compilerOptions 全量）`[已确认]` | `[已确认]` |
| Next.js | 14.2.15（App Router） | lock `node_modules/next`；`Project/package.json` dependencies `"next": "14.2.15"` `[已确认]` | `[已确认]` |
| React / React DOM | 18.3.1 / 18.3.1 | lock `node_modules/react`、`node_modules/react-dom` `[已确认]` | `[已确认]` |
| TailwindCSS | 3.4.19 | lock `node_modules/tailwindcss`；配置 `Project/tailwind.config.ts` `[已确认]` | `[已确认]` |
| 样式工具 | clsx 2.1.1、tailwind-merge 2.6.1、class-variance-authority 0.7.1 | lock 对应条目 `[已确认]` | `[已确认]` |
| 图标 | lucide-react 0.447.0 | lock `[已确认]` | `[已确认]` |
| 二维码 | qrcode 1.5.4 | lock；用于分享长图二维码 `[已确认]` | `[已确认]` |
| 拖拽 | @dnd-kit/core 6.3.1、@dnd-kit/sortable 10.0.0、@dnd-kit/utilities 3.2.2 | lock `[已确认]` | `[已确认]` |
| Supabase SDK | @supabase/supabase-js 2.117.3、@supabase/ssr 0.5.2 | lock `[已确认]`；package.json 声明 `^2.45.4` / `^0.5.2`，实际锁定 2.117.3 `[已确认]` | `[已确认]` |
| 锁文件 | lockfileVersion 3，包名 `travel-food-line@0.1.0` | lock 头部 `[已确认]` | `[已确认]` |
| 依赖管理 | npm（仅 `Project/package-lock.json`，无 pnpm/yarn/bun 锁文件） | `ls Project` 只见 package-lock.json `[已确认]` | `[已确认]` |

## 2. 关键第三方服务（非 npm 依赖）

| 服务 | 用途 | 代码位置（全路径） | 标记 |
|---|---|---|---|
| 自建 Supabase（Postgres/Auth/PostgREST，Docker） | 数据库 + 认证 | 客户端工厂 `Project/lib/supabase/admin.ts`、`server.ts`、`client.ts`、`middleware.ts`；超时/no-store 注入 `Project/lib/supabase/fetch.ts:22`（`noStoreFetch`）`[已确认]` | `[已确认]` |
| 高德 Web 服务 API | 搜索 / 距离矩阵 / 算路 / 地理编码 | `Project/lib/amap.ts`（`distanceMatrix`:576、`planDayRoute`:532、`searchPlaces`:778）；Key 池 `Project/lib/amap-key-pool.ts:34`（`pickWebKeySlot`）；用量 `Project/lib/amap-usage.ts:165` | `[已确认]` |
| 高德 JS API 1.4.15 | 前端地图 | 动态脚本注入 `Project/lib/amap-loader.ts:68-69`（`script.src = https://webapi.amap.com/maps?v=1.4.15&key=...`）`[已确认]` | `[已确认]` |
| DeepSeek API | 文案提取地点/城市 | `Project/lib/deepseek.ts:57`（`extractPlacesAndCity`）`[已确认]` | `[已确认]` |
| 企业微信群机器人 Webhook | 订单/改密提醒 | `Project/lib/order-notify.ts:73`（`ENV.ORDER_NOTIFY_WECOM_WEBHOOK`）`:166` `[已确认]` | `[已确认]` |
| 企业微信自建应用 | 个人微信通知（**上线后启用**） | `Project/lib/order-notify.ts:100`（gettoken）、`:143`（agentid）、`:167`（三项 env 齐全才启用）`[已确认]` | `[已确认]` |

## 3. 构建配置要点

| 文件 | 关键内容 | 标记 |
|---|---|---|
| `Project/next.config.js` | `reactStrictMode: true`；`images.dangerouslyAllowSVG: true` + `contentDispositionType: 'attachment'`（放行自有 logo.svg 并降低 SVG 脚本风险）——全文已读 `[已确认]` | `[已确认]` |
| `Project/tsconfig.json` | strict、`incremental: true`（存在 `Project/tsconfig.tsbuildinfo` 缓存文件）`[已确认]` | `[已确认]` |
| `Project/tailwind.config.ts` | 主色 `primary` + 渐变两端 `primary-from` / `primary-to` 从 `PRODUCT.COLOR_PRIMARY_FROM/TO` 读取（`:37-38`）`[已确认]` | `[已确认]` |
| `Project/config/product.ts` | G1 渐变 = `#E11D48`（玫红）→ `#7C3AED`（紫），`:25/:27/:29` `[已确认]` | `[已确认]` |
| `Project/postcss.config.js` | Tailwind + autoprefixer 常规挂载 `[高度可能]`（未读全文） | `[未知]` |

## 4. 环境变量清单（只列名字与用途，真实值一律不写）

完整口径见 `docs/人工参数与环境配置.md`。共 18 个变量名（`Project/.env.example` 实测计数），核心分组：

| 组 | 变量名 | 用途 |
|---|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | 库地址 / 前端公开 key / 服务端 secret key `[已确认]`（`Project/config/env.ts:52-56`） |
| 高德 JS | `NEXT_PUBLIC_AMAP_KEY` / `NEXT_PUBLIC_AMAP_KEY_2` / `NEXT_PUBLIC_AMAP_SECURITY_CODE` | 前端地图 Key 池（1-2 槽）+ 安全密钥 `[已确认]`（`Project/config/env.ts:58-60`） |
| 高德 Web 服务 | `AMAP_WEB_SERVICE_KEY` / `_PRIVATE_KEY` / `_KEY_2` / `_PRIVATE_KEY_2` / `_KEY_3` / `_PRIVATE_KEY_3` | 服务端 Key 池 3 槽 + 各槽数字签名私钥 `[已确认]`（`Project/config/env.ts:66`，`AMAP_WEB_KEYS`） |
| DeepSeek | `DEEPSEEK_API_KEY` | 文案提取 `[已确认]`（`Project/config/env.ts:68`） |
| 企业微信 | `ORDER_NOTIFY_WECOM_WEBHOOK` / `WECOM_CORP_ID` / `WECOM_APP_SECRET` / `WECOM_AGENT_ID` / `WECOM_APP_TOUSER` | 群机器人提醒 + 自建应用通道 `[已确认]`（`Project/config/env.ts:74-85`） |

## 5. 代码规模（复核值）

| 目录 | 行数 | 证据 | 标记 |
|---|---|---|---|
| `Project/app` | 5,930 | 阶段 2 `wc -l` 实测 `[已确认]` | `[已确认]` |
| `Project/components` | 13,748 | 同上 `[已确认]` | `[已确认]` |
| `Project/lib` | 3,252 | 同上 `[已确认]` | `[已确认]` |
| `Project/config` | 2,800 | 同上 `[已确认]` | `[已确认]` |
| `Project/types` | 302 | 同上 `[已确认]` | `[已确认]` |
| `Project/supabase/migrations` | 2,972（25 份） | 同上 `[已确认]` | `[已确认]` |
