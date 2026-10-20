# 接管审计报告（Repository Audit）

> 阶段 1 产出。本阶段只读：未改代码、未装依赖、未跑迁移。
> 口径：`[事实]` 必须带命令输出或文件路径；`[推断]` 未经证实；`[待确认]` 需用户决定。

- 项目名称：AI-lvcingyitiaoxian（产品名：旅行美食一条线）
- 项目路径：`/Volumes/Programming/Project-File/AI-lvcingyitiaoxian`
- 审计时间：2026-10-20 22:36–22:41
- 审计执行：Trae（Mac-Trae，job `tj_20261020-223621_bnsk`）+ DeepSeek Harness 独立复核
- 审计范围：只读（除网关约定的 jobs 目录外，未新增/修改任何项目文件）

## 1. 结论摘要

- 是否具备安全接手条件：**是**
- 阻断项（必须先解决）：**无**
- 一句话现状：`main` 工作区干净、基线 tag 可用、盘外备份已就位；199 个追踪文件、55 个路由入口、25 份数据库迁移；**无任何自动化测试**；CodeGraph CLI 可用但 **Trae 侧 MCP 未接入**（阶段 2 必须决定接入或降级）。

## 2. Git 与备份

| 项 | 实际值 | 证据 |
|---|---|---|
| 是否 Git 仓库 | 是 | `git rev-parse --is-inside-work-tree` |
| 当前分支 | `main`（追踪 `origin/main`，ahead 3） | `git status --short --branch` |
| HEAD commit | `1707589` docs: 阶段 0 交接摘要 | `git log -1 --oneline` |
| remote | `origin https://github.com/linyidong/lvyou-meishi-yitiaoxian.git` | `git remote -v` |
| 未提交文件数 | 1（未跟踪：`Project/public/750x750png`） | `git status --porcelain=v1` |
| 已修改 / 已暂存 | 0 / 0 | 同上 |
| 基线 tag | `baseline-before-takeover` → `c6be7ca` | `git tag -l` |
| 追踪文件总数 | 199 | `git ls-files \| wc -l` |
| 备份位置 | `/Volumes/Programming/Project-File/_backups/AI-lvcingyitiaoxian-backup-20261020/` | 阶段 0 产出 |
| 备份时间 / 内容 | 2026-10-20 22:12，315 文件 / 4.9M，**含 `.env.local`**，排除 `node_modules`、`.next` | `du -sh` + 文件核对 |

## 3. 未提交改动

| 文件 | 类型 | 建议处置 |
|---|---|---|
| `Project/public/750x750png` | 新增（未跟踪，750×750 PNG，36,926 B，mtime 10-20 15:19） | 派单前既已存在，**不是本次审计产生**。文件名缺扩展名，用途无法从内容确证。建议：先确认是素材还是下载残留 → 素材则改名 `logo-750.png` 后入库，残留则删除。**不直接提交、不擅自删除。** |

> 处置由用户决定。**AI 不清理工作区。**

## 4. 敏感文件（只写路径与类型，不写内容）

| 路径 | 类型 | 是否已入库 | 处置建议 |
|---|---|---|---|
| `Project/.env.local` | 环境变量（9 个变量：Supabase ×3、高德 ×3、DeepSeek ×1、企微 Webhook ×1） | **否**，`.gitignore:31` 已忽略 | 仅本地保留；不打印、不入库、不进备份报告 |
| `Project/.env.example` | 环境变量模板（18 个变量，无真实值） | 是 | 正常 |
| `Project/public/pay-qr.jpeg`、`pay-qr.png` | 收款码原图（含经营信息） | **否**，`.gitignore:51-52` | 保持忽略 |
| `Project/public/pay-qr-wechat.png`、`pay-qr-alipay.png` | 裁剪后的对外收款码 | 是 | `[待确认]` 需人工确认裁剪后无头像/昵称残留 |
| `Project/public/logo.svg.zip`、`Project/travel-food-route.zip` | 压缩包 | **否**，`*.zip` 已忽略 | 保持忽略 |
| `.codegraph/codegraph.db` | 代码图谱索引（6.21 MB，含全量源码指纹） | **否**，`.gitignore:55` | 保持忽略 |

复核证据：`git check-ignore -v` 四条全部命中对应规则；`grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' .env.local` 只输出变量名。

**配置缺口 `[事实]`**：`.env.example` 有 18 个变量名，`.env.local` 只有 9 个，缺 `AMAP_WEB_SERVICE_KEY_3`、`AMAP_WEB_SERVICE_PRIVATE_KEY(_2/_3)`、`NEXT_PUBLIC_AMAP_KEY_2`、`WECOM_CORP_ID`、`WECOM_AGENT_ID`、`WECOM_APP_SECRET`、`WECOM_APP_TOUSER` → 说明**高德 Key 池第 3 槽位与企业微信自建应用通道当前未配置**。

## 5. AI 实际访问范围

| 范围 | 内容 | 说明 |
|---|---|---|
| 可读目录 | 项目根及全部子目录（`Project/`、`File-PRD/`、`docs/`、`tasks/`、`.codegraph/`） | 无权限阻挡 |
| 被忽略目录 | `node_modules/`、`.next/`、`.git/` | 体积/缓存，未纳入分析 |
| 既有文档 | `docs/handover/` 1 份；`Project/docs/` 4 份（人工必填清单、原型页面对照表、同步清单参数、项目结构目录）；`File-PRD/` 9 份 | `[事实]` `find docs -type f` = 1、`find Project/docs -type f` = 4 |
| 代码规模 | `app/` 55 个 page/layout/route 入口（另有 1 个 `not-found.tsx`）、`lib/` 20 个模块、`config/` 7 个配置文件、`supabase/migrations/` 25 份 | `[事实]` `find` 计数 |
| 越界声明 | 未访问 Trae 的另一工作区 `/Volumes/Programming/project/AI-lvcingyitiaoxian`，未读写 DeepSeek-harness 项目 | Trae 自述 + 网关目录边界（`workspace_root` 已锁本项目） |

## 6. CodeGraph 状态

| 项 | 结果 |
|---|---|
| CLI 是否可用 | **可用**：`codegraph 1.6.2`，路径 `/Volumes/Programming/Applications/nodejs/bin/codegraph` |
| `.codegraph/` 是否存在 | 存在（6.21 MB，WAL） |
| 索引是否覆盖本项目 | **是**：145 文件 / 2,364 节点 / 5,220 边；tsx 74 / typescript 69 / javascript 2 |
| 真实查询样例 | `codegraph callers dailyLimitOf` → `Project/lib/guest-rate-limit.ts:99`，调用方 `checkGuestRateLimit` @ `:109` |
| **Trae 侧 MCP** | **未接入**。Trae 会话内 `ToolSearch` 无任何 `codegraph_*` 工具；本机核查 `~/Library/Application Support/Trae CN/User/settings.json` 无 MCP 配置、无 `~/.trae-cn/mcp.json`，仅有内置 `computer-use` |
| 降级方案 | 阶段 2 二选一：① 按 CodeGraph 指南第 3 节在 Trae 里注册 MCP（一次性配置，之后可 `codegraph_explore/callers/impact`）；② 声明降级，全部用 CLI 取证（`codegraph callers/callees/impact`），报告里如实写明「非 MCP」 |

## 7. 初步风险

| 风险 | 证据 | 影响 | 优先级 |
|---|---|---|---|
| 无任何自动化测试（无 jest/vitest/playwright） | `package.json` 无测试脚本与相关依赖 | 所有改动只能靠 `typecheck` + 人工实测，回归靠人 | **高** |
| Trae 侧 CodeGraph MCP 未接入 | 见 §6 | 影响面分析只能 CLI 单点查询，效率与覆盖率下降 | 中 |
| `.env.local` 与 `.env.example` 不对齐 | §4 配置缺口 | 误以为企微应用通道/Key 池第 3 槽可用会踩坑 | 中 |
| 本地 3 笔提交未推送 | `git log origin/main..HEAD` = 3 | 磁盘故障时仅剩本地与盘外备份 | 中 |
| `docs/` 六个子目录全空 | `find docs -type f` = 1 | 决策缺依据，PRD/架构无从对照 | 中（阶段 4–5 补齐） |
| `750x750png` 无扩展名残留 | `file` 判定 PNG 但无后缀 | 误提交污染仓库 / 误删丢素材 | 低 |
| 对外收款码已入库 | `git ls-files Project/public` 含两张 | 若裁剪不彻底会泄露经营信息 | 低（待人工确认） |

## 8. 阶段 1 四问回答

- **A. 是否处于安全、可检查的状态**：**是**。`main` 干净（仅 1 个未跟踪残留）、基线 tag 可用、盘外备份含密钥文件、敏感文件全部已被 `.gitignore` 覆盖。
- **B. 实际能访问哪些目录和文件**：项目根及全部子目录；实际逐行读取了 `AGENTS.md`（99 行）、阶段 0 交接摘要（70 行）、`Project/package.json`（39 行）、`Project/lib/supabase/admin.ts`（19 行）、`.gitignore`（55 行）。
- **C. CodeGraph MCP 是否已连接且可调用**：**MCP 未连接**（Trae 侧无该服务器，本机配置也已核实）；**CLI 可用**且索引覆盖本项目，已做 1 次真实查询取证；**未使用图谱做事务分析**，不声称「已用图谱分析项目」。
- **D. 下一步检查计划**：D1 文档缺口清单 → D2 路由清单（55 入口 × 身份门槛）→ D3 认证与身份边界 → D4 配额与限流矩阵 → D5 数据模型（25 份迁移，只读 SQL 文本不连库）→ D6 外部依赖面（高德/DeepSeek/企微）→ D7 L 系列教训索引 → D8 `tsc --noEmit` 基线。计划内**不含**修改/安装/迁移动作。

## 9. 证据来源

- Trae 原始报告：`/Users/aquarius/Documents/deepseek-harness/default-workspace/trae-gateway/jobs/tj_20261020-223621_bnsk/RESULT.md`（19,715 B）
- 网关任务：`tj_20261020-223621_bnsk`，`completed`，耗时 120s，消耗 6.76
- Harness 独立复核命令与结果：

| 复核项 | 命令 | 结果 |
|---|---|---|
| 是否偷改文件 | `diff` 派单前 `git status` 基线与收尾 | **完全一致**，除 jobs 目录外无任何改动 |
| 追踪文件数 | `git ls-files \| wc -l` | 199 ✅ 与报告一致 |
| 路由入口数 | `find app -name page.tsx/route.ts/layout.tsx` | **55**（报告写 56，见 §11） |
| 迁移数 | `ls supabase/migrations \| wc -l` | 25 ✅ |
| 文档数 | `find docs / Project/docs` | 1 / 4 ✅ |
| 敏感文件忽略 | `git check-ignore -v` ×4 | 全部命中 ✅ |
| 配置缺口 | `.env.example` 与 `.env.local` 变量名求差 | 缺 9 个，与报告一致 ✅ |
| 依赖版本 | `package.json` | next 14.2.15、@dnd-kit/core 6.3.1、@dnd-kit/sortable 10.0.0、@supabase/supabase-js 2.45.4 ✅ |
| Trae MCP 配置 | 读 `Trae CN/User/settings.json` 与 `.trae-cn/` | 无 MCP 注册，仅 builtin computer-use ✅ 佐证「MCP 未接入」 |

## 10. 待确认事项

1. `Project/public/750x750png` 处置（删除 / 改名入库 / 原样保留）。
2. 本地 3 笔提交是否推送到 `origin/main`。
3. 阶段 2 起 CodeGraph 走哪条路：**接入 Trae MCP** 还是**声明 CLI 降级**。
4. `pay-qr-wechat.png` / `pay-qr-alipay.png` 裁剪是否彻底（需人眼看图）。

## 11. 本次复核发现的问题

| # | 问题 | 处理 |
|---|---|---|
| 1 | Trae 报告称「`app/` 下 56 个 page/layout/route 文件」，实测 **55**（23 page + 30 route + 2 layout）；应为「55 个入口 + 1 个 `not-found.tsx`」 | 已在 §5 更正。**不影响结论**，但在阶段 2 的路由清单里必须用 55 这个数，否则后续「56 个入口全覆盖」的覆盖率会被虚报 |
| 2 | Trae 报告把「被读取的只读文件」也列进了「关键产物」 | 表述不严谨，已在 §9 只保留唯一真实新增文件（RESULT.md）；`git status` 复核确认这些文件均未修改 |
