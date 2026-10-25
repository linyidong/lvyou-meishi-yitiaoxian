# Windows 端使用说明（Supabase + 应用都跑在这台机器）

> 目标：**Mac 关机也能测试**。Windows 负责 Supabase（Docker）与应用（Next.js），电脑和手机都能访问。

## 一、首次准备（只做一次）

1. 安装 **Node.js 18+**（已装可跳过）、**Docker Desktop**（Supabase 容器依赖它）
2. 把 Mac 上的 `Project\.env.local` 复制到本目录同级的 `Project\.env.local`
   - 里面含数据库/高德/AI 密钥，**不要通过群聊或邮件传输**，用 U 盘或局域网共享
   - 若本机 Supabase 是 `127.0.0.1:8000`，把 `NEXT_PUBLIC_SUPABASE_URL` 保持 `http://127.0.0.1:8000` 即可
3. 如果 Supabase 的 `docker-compose.yml` 不在默认位置，编辑 `windows\config.bat`，取消注释并填写：
   ```bat
   set "SUPABASE_DIR=D:\你的\supabase\目录"
   ```
4. **右键「以管理员身份运行」** `windows\允许局域网访问.bat`（放行 3000 与 8000）
5. 右键「使用 PowerShell 运行」`windows\创建桌面快捷方式.ps1` → 桌面出现三个图标

## 二、日常使用

| 操作 | 方式 |
|---|---|
| 启动 | 双击桌面 **旅行美食一条线-启动**：弹出的终端窗口会依次显示 5 步进度（Node → 配置 → Supabase → 依赖/构建 → 启动应用），完成后**自动打开电脑浏览器** |
| 手机访问 | 窗口会用醒目的方框打印 **`http://<自动识别的局域网IP>:3000`**，并**自动复制到剪贴板**；手机连同一 WiFi 打开即可 |
| IP 会自动选对 | `windows\get-ip.ps1` 会排除 Docker/WSL/Hyper-V/VMware/VirtualBox 等虚拟网卡，优先选"有默认网关"的真实网卡（192.168 > 10 > 其它） |
| 停止 | 双击 **旅行美食一条线-停止**（关闭 3000 端口进程；Supabase 默认保留） |
| 体检 | 双击 **旅行美食一条线-诊断**（Node/npm/配置/依赖/Supabase/端口/IP/防火墙 全打印） |

## 三、首次启动会发生什么

- 没有 `node_modules` → 自动 `npm ci`（1–3 分钟）
- 没有 `.next` → 自动 `npm run build`（1–2 分钟）
- 构建失败 → 自动降级为 `npm run dev`（慢但能用）
- 之后启动一般 **10 秒内**完成

## 四、常见问题

| 现象 | 处理 |
|---|---|
| 提示缺少 `.env.local` | 从 Mac 复制 `Project\.env.local` 过来 |
| 提示 Supabase 离线 | 打开 Docker Desktop，等容器 Running；或在 `config.bat` 配好 `SUPABASE_DIR` 让脚本自动 `docker compose up -d` |
| 手机打不开 | 管理员运行 `允许局域网访问.bat`；确认同一 WiFi；用诊断脚本里的 IP |
| 端口被占用 | 先运行 `停止项目.bat`，或改 `PORT`（需同时改 `.env`/访问地址） |
| 页面很慢 | 首次访问要编译路由；后续会快；也可等构建完成后用 `npm run start` |

## 五、注意事项

- 本机作为服务端时，**不要把 3000 端口直接暴露到公网**（无 HTTPS、无防护）
- 关机前建议先运行 `停止项目.bat`，避免端口占用
- Supabase 的 `docker compose down` 不会删数据（数据在卷里），但 **不要 `down -v`**
