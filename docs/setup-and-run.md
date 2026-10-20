> 状态：已核对（Harness 2026-10-20 23:58 复核：版本/命令/风险均已抽样验证，数据库事实见 `known-issues.md` §0）

# 安装 / 启动 / 构建 / 测试（阶段 3 · P3）

> 命令定义一律以 `Project/package.json` 的 `scripts` 字段为准（`:6-10`）。
> 「已验证」= 本轮在本机真实执行并贴出输出与 exit code；「未执行」= 写明原因。

## 1. 命令清单

| 动作 | 命令 | 定义位置 | 本轮状态 |
|---|---|---|---|
| 安装依赖 | `npm install`（隐含，无专用 script） | `Project/package.json` 无 postinstall 等钩子 `[已确认]` | **未执行**——任务禁止 `npm install`；`Project/node_modules/` 已存在 `[已确认]` |
| 开发服务器 | `npm run dev` → `next dev` | `Project/package.json:6` `[已确认]` | **未执行**——启动 dev 会连自建 Supabase（数据库侧核实归 Harness）；且前序会话已人工验证过运行（见 §4） |
| 类型检查 | `npm run typecheck` → `tsc --noEmit` | `Project/package.json:10` `[已确认]` | **已验证（通过）**——见 §2 |
| 构建 | `npm run build` → `next build` | `Project/package.json:7` `[已确认]` | **未执行**——任务禁止；另有教训：build 会覆盖 dev 产物导致 dev 异常（项目记忆 L 系列），不应在 dev 在跑时执行 |
| 生产启动 | `npm run start` → `next start` | `Project/package.json:8` `[已确认]` | **未执行**——依赖 build 产物，同上 |
| Lint | `npm run lint` → `next lint` | `Project/package.json:9` `[已确认]` | **未执行**——任务只要求 typecheck；`next lint` 会触发 ESLint 依赖解析，属可选检查 |
| 测试 | **无测试命令**（scripts 中无 test） | `Project/package.json:6-10` 全文核对 `[已确认]` | 项目无任何自动化测试（见 §5） |

## 2. 已验证命令：npm run typecheck

- 执行目录：`/Volumes/Programming/Project-File/AI-lvcingyitiaoxian/Project`
- 命令：`npm run typecheck 2>&1; echo "EXIT_CODE=$?"`（后台任务 `job-63ad069e...`）
- 原始输出：

```text
> travel-food-line@0.1.0 typecheck
> tsc --noEmit

EXIT_CODE=0
```

- 结论：**通过，exit code 0**，零类型错误 `[已确认]`
- 注意：`tsc --noEmit` 只验证类型，不验证运行时行为；AGENTS.md §0 明确「运行时行为必须人工走一遍」。

## 3. 运行前置条件（启动本项目实际需要什么）

| 依赖 | 要求 | 证据 | 标记 |
|---|---|---|---|
| `Project/.env.local` | 必须与 `package.json` 同目录（历史教训：放错层会导致全站 500）；需含 Supabase 3 项、高德 JS/Web Key、DeepSeek 等（当前实测 9 个变量名，见 `docs/人工参数与环境配置.md`） | `grep -oE '^[A-Z_0-9]+=' Project/.env.local` 只取名不取值实测 `[已确认]` | `[已确认]` |
| 自建 Supabase 服务 | 必须在线（地址在 `.env.local` 的 `NEXT_PUBLIC_SUPABASE_URL`）。当前部署在 Windows 宿主机 Docker Desktop，**存在假死史**：TCP 握手成功但 HTTP 不回字节，导致查库页面全部挂死 | 项目记忆教训（症状/恢复方式已记录）；本轮未探测（任务禁止连库）`[已确认]`（历史事实）| `[风险]` |
| 高德 Web 服务 Key | 至少 1 个；若控制台开启数字签名则必须配对应私钥，否则报 10007 | `Project/config/env.ts:62-66` 注释 `[已确认]` | `[已确认]` |
| Node 版本 | 未声明 engines；本机 v24.21.0 可跑 typecheck | `Project/package.json` 无 engines `[已确认]` | `[风险]` |

## 4. 历史人工验证记录（非本轮，来源为项目记忆与阶段 1/2 交接）

| 项 | 状态 | 说明 |
|---|---|---|
| dev 服务 3000 端口启动 | 已通过（2026-10-20 白天多次人工实测） | 游客三步链路、登录、订单、后台均真人浏览器走查过 `[已确认]`（历史） |
| 企业微信 Webhook 推送 | 已通过（2026-10-20 两轮实测） | 直发 + 真实下单链路各验证一次 `[已确认]`（历史） |
| 忘记密码 15 项端到端 | 已通过（2026-10-20） | 含会员权益不变校验 `[已确认]`（历史） |
| 92 城示例数据 | 已补齐（2026-10-20，places 共 1,307 条） | 数据库侧数字需 Harness 只读复核 `[高度可能]` |
| 本轮运行时 | **未执行** | 见 §1 原因 |

## 5. 测试现状

| 项 | 结论 | 证据 | 标记 |
|---|---|---|---|
| 测试框架 | 无（无 jest / vitest / playwright 依赖与配置） | `Project/package.json` devDependencies 无测试库；`find Project -name "*.test.*" -o -name "*.spec.*"`（排除 node_modules）→ 空 `[已确认]` | `[已确认]` |
| 测试数量 | 0 | 同上 `[已确认]` | `[已确认]` |
| 覆盖率 | **无从谈起，不编造数字** | 无测试 `[已确认]` | `[风险]` |
| 替代验证手段 | `npm run typecheck`（本轮通过）+ 人工浏览器走查（历史） | §2、§4 `[已确认]` | `[已确认]` |

## 6. 部署与 CI/CD

| 项 | 结论 | 证据 | 标记 |
|---|---|---|---|
| CI/CD | **无** | 仓库根无 `.github/`（`ls -d .github` → 不存在）`[已确认]` | `[已确认]` |
| 部署方式 | 尚未部署到任何生产环境；当前仅本地 dev（Mac 代码 + Windows 宿主机 Docker 跑 Supabase） | `docs/progress.md` 阶段 8 未开始；无 Dockerfile/部署配置于 `Project/` `[已确认]` | `[已确认]` |
| 迁移执行方式 | 手工经 Supabase SQL Editor / `/pg/query` 通道执行（迁移 025 即如此） | 项目记忆 `[已确认]` | `[已确认]` |
| 上线计划 | 腾讯云轻量服务器 + 整套 Supabase Docker 迁移（国内），域名备案为前置 | 2026-10-20 决策记录（项目记忆）`[已确认]`（决策已定，未实施） | `[已确认]` |
| Git 状态 | `main` 领先 `origin/main` 9 个提交未 push；工作区仅 `?? Project/public/750x750png` 残留 | `git status -sb` → `## main...origin/main [ahead 9]` `[已确认]` | `[已确认]` |
