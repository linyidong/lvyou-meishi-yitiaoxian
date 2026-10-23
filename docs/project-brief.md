> 状态：已核对（Harness 2026-10-21 00:10 复核：结构、鉴权口径、数据模型均与代码/库一致；偏差记入 known-issues B9）

# 项目简报（定稿版 · 阶段 4 反向恢复）

> 口径：「现状」= 代码可证明的事实（带全路径行号）；「目标」= 用户口述/历史文档中的意图，两者分列不混。细节展开见同目录 `architecture.md`、`feature-status.md`、`data-model.md`、`api-contract.md`、`decisions.md`、`known-issues.md`。

## 1. 一句话描述

**旅行美食一条线**：自助旅行者选城市 → 设置行程 → 挑地点（AI 提取文案 / 勾选收藏 / 搜索）→ 自动排路线（最近邻+2-opt+高德距离矩阵）→ 看地图与分段里程 → 保存为个人路线；游客免登录可完整试用、仅保存需登录，会员分层配额，路线可分享长图与二维码。[已确认]（AGENTS.md §0；链路证据 `docs/architecture.md` §3 四条调用链）

## 2. 背景与问题

- **解决的问题**（目标口径，来源 `File-PRD/` 历史文档与 project_memory）：旅行文案（小红书/朋友圈攻略）里的地点无法直接变成一条顺路可走的行程；手动排顺序费时且容易绕路。
- **已实现的核心应对**：文案 → DeepSeek 提取地点（`Project/lib/deepseek.ts:57`）→ 高德坐标解析与距离矩阵（`Project/lib/amap.ts:650`）→ 排序（`Project/lib/route-order.ts:173`）→ 分段算路展示（`Project/lib/amap.ts:532`）。
- **商业背景**（现状事实）：会员月卡 9.9 元（T-028 调价，价格一律见 `Project/config/business.ts` `MEMBER_PLANS`），收款码扫码 + 管理员人工核销的半自动闭环已上线于代码（`docs/decisions.md` D-11）；全自动回调受限于个人收款码无回调 API，需营业执照后升级（未实现，`docs/feature-status.md` F-44）。

## 3. 目标用户与场景

| 身份 | 场景 | 现状能力（代码证明） |
|---|---|---|
| 游客（未登录） | 先体验再注册 | 完整走通三步试用（`Project/middleware.ts:29-32` 放行 `/try/*`），仅保存需登录；顶部/底部工具栏全置灰；五桶限流（`Project/config/business.ts:72/79/85`） |
| 普通用户 | 免费额度使用 | 1 条路线/日、单日 6 地点、文案识别 10 次/日、1 次多日试用（`Project/lib/member-quota.ts:90` `limitsOf` 档位常量） |
| 会员 | 深度使用 | 每月 5 条路线（T-028 下调；月桶 `Project/supabase/migrations/025:19-27`）、单日 12 地点、识别 20 次/日；分享长图/二维码导出仅会员（`docs/feature-status.md` F-08） |
| 管理员 | 运营 | 后台 7 页 + 6 API（订单核销、用户/地点/路线/导入管理、用量看板、seed-demo）；自身默认最高档会员且不可取消（触发器 `Project/supabase/migrations/015:24-48`） |

## 4. 核心价值

1. **文案到路线的转化**：粘贴攻略文本即可得到含真实里程的排序路线（游客链路 `docs/architecture.md` §3 链路①）。
2. **省额度的可运行性**：Key 池 + 30 天落库缓存 + 串行队列 + 熔断降级，使个人认证高德 Key 的配额能支撑多用户（`docs/decisions.md` D-13）。
3. **零门槛试用漏斗**：免登录全流程 + sessionStorage 草稿 + 登录一键转正（`Project/app/api/try/promote/route.ts:54`）。

## 5. 产品目标与衡量指标

- 产品目标（用户口述，目标口径）：游客 → 注册 → 会员付费的转化闭环可用、可运营（企微提醒 + 后台核销）。
- 可机器核对的现状指标：
  - 库内数据规模：14 表，places 1326 / cities 92 / routes 5 / users 3（Harness 实测，`docs/open-questions.md` Q-101）。
  - 高德用量：`amap_usage` 按 key_slot 落库，80%/95% 阈值预警与降级（`Project/lib/amap-usage.ts:165/:195`）。
  - 转化漏斗指标（注册率、付费率、试用完成率）：**暂无，原因：项目未部署生产、无埋点统计聚合出口；`events` 表仅 42 行开发期数据（`Project/lib/events.ts:7` `trackEvent` 只写不读，无看板消费方）**。

## 6. 第一版范围

**必须做（当前已实现，证据见 `docs/feature-status.md` §1）**：游客三步试用与草稿转正；路线排序与分段里程；地图交互与导航唤起；收藏；文案/链接导入；会员订单半自动闭环；路线分享（令牌+长图+二维码+分享页）；管理后台；防提权（RLS+触发器）；高德省额度体系。

**明确不做（第一版排除，均有证据）**：
- 付款全自动回调（个人收款码无 API，待营业执照——`docs/feature-status.md` F-44）。
- 年卡/永久会员购买（`Project/config/business.ts:145` 仅月卡）。
- 分享页地图与导航（仅快照展示，零高德调用——F-08）。
- 短信提醒通道（无代码——F-43）。
- 服务端定时任务/事件队列（无——`docs/module-map.md` §1.6）。
- 自动化测试与 CI（无——F-41/F-42）。

## 7. 关键假设与证据

| 假设 | 支撑证据 | 状态 |
|---|---|---|
| 粘贴文案是最稳的提取路径（链接抓取有登录墙） | 历史教训（小红书登录墙）+ `Project/lib/link-fetch.ts:145` 回退设计 | [已确认]（代码含回退；平台成功率未本轮实测） |
| 惰性会员判定可免定时任务 | `Project/lib/member-quota.ts:78`；到期读取即回落 | [已确认]（存储值不自动翻转的边界见 `docs/architecture.md` T-10） |
| 游客读示例池经 service_role 是正确实现 | places RLS 仅授 authenticated 属设计如此（Harness 复核 `docs/known-issues.md` §0） | [已确认] |
| 92 城固定 + 单日 ≤12 + 单路线 ≤30 上限够用 | `Project/config/business.ts:7/9/37`；迁移 011 seed 92 城 | [已确认]（`Project/config/cities.ts` name 计数 104 与 92 不一致，Q-005 待核） |
| 单实例部署下限流进程内 Map 可接受 | `Project/lib/guest-rate-limit.ts:109-134` | [风险]（重启清零；部署形态确定后重评） |

## 8. 约束（硬性）

- **地区**：必须部署在国内，不接受境外生产环境（用户硬性要求；当前 Supabase 自建在局域网宿主机，生产部署未开始）。
- **技术**：Next.js 14 App Router + 自建 Supabase + 高德 + DeepSeek + 企微，不得擅换公共接口/数据结构（AGENTS.md §2）；高德 Web 服务与 JS API 两类 Key 不可选错平台。
- **预算/成本**：高德个人 Key 配额是核心成本约束，一切设计围绕省额度（D-13）；腾讯云轻量 2核4G 起步、包年包月 ≥3 个月为备案硬性条件（用户调研记录，目标口径）。
- **合规**：收款码隐藏经营隐私信息；`.env.local`/生产数据/`File-PRD/`/收款码原图禁触；数据库写操作须先报备（AGENTS.md §5.1）。
- **验证**：无测试框架 → 改动至少 `npm run typecheck`（当前 EXIT=0），运行时行为必须人工走查并写「未覆盖」。

## 9. 当前状态（以 docs/progress.md 为唯一事实源）

- **已完成**：阶段 1 审计（199 文件）、阶段 2 CodeGraph 地图（module-map 448 行）、阶段 3 项目状态理解 5 份文档（G3 已通过，Harness 2026-10-20 复核）、阶段 4 本文档组（7 份，本轮产出）。功能层「已完成」清单 = `docs/feature-status.md` §1（F-01~F-13）。
- **进行中**：阶段 4 交付待 Harness 核对（G4）。
- **未开始**：生产部署（国内云）、A5 鉴权修复（已决策，排入阶段 7，`docs/decisions.md` D-10）、测试框架引入（未立项）。
- **已知阻塞**：无硬阻塞；11 笔本地提交未 push（`docs/progress.md`）。

## 10. 证据来源

- AGENTS.md §0/§2.1（项目速览与铁律）；`docs/progress.md`（进度唯一事实源）；`docs/module-map.md`（448 行，阶段 2）。
- 本轮产出：`docs/architecture.md`、`docs/feature-status.md`、`docs/data-model.md`、`docs/api-contract.md`、`docs/decisions.md`、`docs/known-issues.md`（§0 Harness 复核）、`docs/open-questions.md`（Q-001~Q-008、Q-101~Q-104）。
- 源码行号（本文内联）：`Project/middleware.ts:29-32`、`Project/config/business.ts:72/79/85/145`、`Project/lib/member-quota.ts:78/90`、`Project/lib/route-order.ts:173`、`Project/lib/amap.ts:650`、`Project/lib/deepseek.ts:57`、`Project/app/api/try/promote/route.ts:54`、`Project/supabase/migrations/015:24-48`、`025:19-27`、`Project/lib/guest-rate-limit.ts:109-134`、`Project/lib/amap-usage.ts:165/195`、`Project/lib/events.ts:7`、`Project/lib/link-fetch.ts:145`、`Project/config/cities.ts`。
- Harness 实测：14 表行数、RLS 匿名 0 行、typecheck EXIT=0。

## 11. 待确认事项

1. 第 5 节转化指标：`events` 表是否有既定看板消费方（当前 grep 未见读取端）[未知]。
2. 92 城 vs `Project/config/cities.ts` 104 条 name 的差异（Q-005）[未知]。
3. 「第一版」的正式边界文档在 `File-PRD/`（只读历史），其范围与当前代码差异未逐项对照 [未知]。
4. 生产部署的目标云形态（轻量单机 or 其他）用户尚未最终拍板，本文只记录「国内」硬约束 [未知]。
5. 衡量指标的可接受基线（注册转化率目标等）无任何历史记录，需用户补充 [未知]。
