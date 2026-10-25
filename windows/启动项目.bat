@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title 旅行美食一条线 · 启动
mode con: cols=100 lines=30 >nul 2>nul

REM ============================================================
REM  一键启动：查环境 → 起 Supabase → 构建/启动应用 → 自动开浏览器
REM  T-063：自动挑选"手机可访问"的局域网 IP；自动打开电脑浏览器；
REM         醒目标注手机测试地址并复制到剪贴板。
REM ============================================================

cd /d "%~dp0.."
set "ROOT=%CD%"
set "APP=%ROOT%\Project"
set "PORT=3000"
set "SUPABASE_DIR="
if exist "%ROOT%\windows\config.bat" call "%ROOT%\windows\config.bat"

echo ============================================================
echo   旅行美食一条线 · 一键启动
echo   项目根：%ROOT%
echo ============================================================
echo.

REM ---------- 1/5 Node ----------
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 Node.js，请先安装 Node.js 18 或更高版本
  pause & exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo [1/5] Node.js %%v  ✓

REM ---------- 2/5 配置 ----------
if not exist "%APP%\.env.local" (
  echo.
  echo [错误] 缺少 %APP%\.env.local
  echo        请把开发机上的 Project\.env.local 复制到这台电脑的同名位置
  pause & exit /b 1
)
findstr /C:"NEXT_PUBLIC_SUPABASE_URL=" "%APP%\.env.local" >nul || (
  echo [错误] .env.local 缺少 NEXT_PUBLIC_SUPABASE_URL
  pause & exit /b 1
)
echo [2/5] 配置文件就绪  ✓

REM ---------- 3/5 Supabase ----------
call :probe_supabase
if "!SUP_OK!"=="1" (
  echo [3/5] Supabase 已在线  ✓
) else (
  echo [3/5] Supabase 未响应，尝试启动 Docker 容器...
  if not "%SUPABASE_DIR%"=="" (
    if exist "%SUPABASE_DIR%\docker-compose.yml" (
      pushd "%SUPABASE_DIR%"
      docker compose up -d
      popd
    ) else (
      echo [警告] 未找到 %SUPABASE_DIR%\docker-compose.yml
    )
  ) else (
    echo [提示] 未配置 SUPABASE_DIR（可在 windows\config.bat 中设置）
  )
  set "SUP_OK=0"
  for /l %%i in (1,1,30) do (
    if "!SUP_OK!"=="0" (
      call :probe_supabase
      if "!SUP_OK!"=="0" timeout /t 2 >nul
    )
  )
  if "!SUP_OK!"=="1" (
    echo        Supabase 已就绪  ✓
  ) else (
    echo [警告] 30 秒内 Supabase 仍不可用：应用能启动，但登录/数据会失败
    echo        请确认 Docker Desktop 正在运行
  )
)

REM ---------- 4/5 依赖与构建 ----------
if not exist "%APP%\node_modules" (
  echo [4/5] 首次运行，安装依赖（约 1-3 分钟，请勿关闭窗口）...
  pushd "%APP%" & call npm ci & popd
) else (
  echo [4/5] 依赖已存在  ✓
)
if not exist "%APP%\.next\BUILD_ID" (
  echo       首次运行，构建生产版本（约 1-2 分钟，请勿关闭窗口）...
  pushd "%APP%" & call npm run build & popd
  if not exist "%APP%\.next\BUILD_ID" (
    echo [警告] 构建失败，本次改用开发模式启动（可用但较慢）
    set "MODE=dev"
  )
)

REM ---------- 5/5 启动应用 ----------
echo [5/5] 启动应用（端口 %PORT%）...
if /i "%MODE%"=="dev" (
  start "lyytx-app" /D "%APP%" cmd /c "npm run dev -- -H 0.0.0.0 -p %PORT%"
) else (
  start "lyytx-app" /D "%APP%" cmd /c "npm run start -- -H 0.0.0.0 -p %PORT%"
)

REM 等待端口就绪（最多 90 秒）
set "UP=0"
for /l %%i in (1,1,90) do (
  if "!UP!"=="0" (
    powershell -NoProfile -Command "try{ $null=Invoke-WebRequest -Uri 'http://127.0.0.1:%PORT%/' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; exit 0 }catch{ exit 1 }"
    if not errorlevel 1 set "UP=1"
    if "!UP!"=="0" timeout /t 1 >nul
  )
)

REM ---------- 自动获取局域网 IP（排除虚拟网卡） ----------
set "LANIP="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\windows\get-ip.ps1"`) do if not defined LANIP set "LANIP=%%i"

echo.
echo ============================================================
if "!UP!"=="1" (
  echo   启动成功
) else (
  echo   应用可能仍在启动中（稍等 10 秒再刷新浏览器）
)
echo ------------------------------------------------------------
echo   电脑访问：   http://localhost:%PORT%
if defined LANIP (
  echo   手机访问：   http://!LANIP!:%PORT%
  echo                （手机连同一个 WiFi，直接打开上面的地址）
) else (
  echo   手机访问：   未检测到局域网 IP，请运行 windows\诊断.bat 查看网卡
)
echo ============================================================
echo.

if defined LANIP (
  echo http://!LANIP!:%PORT% | clip >nul 2>nul && echo   手机地址已复制到剪贴板，可直接粘给朋友
  echo.
)

echo   关闭服务：双击 windows\停止项目.bat
echo   环境体检：双击 windows\诊断.bat
echo.

REM 自动打开电脑浏览器
start "" "http://localhost:%PORT%"

echo 本窗口可以最小化，但请不要关闭（关闭不影响服务，服务在独立窗口运行）。
pause
exit /b 0

REM ---------- 子过程 ----------
:probe_supabase
set "SUP_OK=0"
powershell -NoProfile -Command "try{ $null=Invoke-WebRequest -Uri 'http://127.0.0.1:8000/rest/v1/' -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop; exit 0 }catch{ exit 1 }"
if not errorlevel 1 set "SUP_OK=1"
exit /b 0
