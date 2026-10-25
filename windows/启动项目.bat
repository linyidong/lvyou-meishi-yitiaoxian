@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title 旅行美食一条线 · 启动

REM ============================================================
REM  一键启动：检查环境 → 检查/启动 Supabase → 启动 Next → 开浏览器
REM  适用：Windows 10/11，已装 Node.js 18+ 与 Docker Desktop（Supabase）
REM  目录约定：本文件位于 <项目根>\windows\，项目根需含 Project\ 与 docs\
REM ============================================================

cd /d "%~dp0.."
set "ROOT=%CD%"
set "APP=%ROOT%\Project"
set "PORT=3000"
REM 若 Supabase 的 docker-compose 不在默认位置，可在 windows\config.bat 里覆盖 SUPABASE_DIR
set "SUPABASE_DIR="
if exist "%ROOT%\windows\config.bat" call "%ROOT%\windows\config.bat"

echo ============================================================
echo   旅行美食一条线 · 一键启动
echo   项目根：%ROOT%
echo ============================================================

REM ---------- 1. Node ----------
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 Node.js，请先安装 Node.js 18 或更高版本
  pause & exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo [1/5] Node.js %%v

REM ---------- 2. 配置 ----------
if not exist "%APP%\.env.local" (
  echo [错误] 缺少 %APP%\.env.local
  echo        请把 Mac 上的 Project\.env.local 复制到这台电脑的同名位置
  pause & exit /b 1
)
findstr /C:"NEXT_PUBLIC_SUPABASE_URL=" "%APP%\.env.local" >nul || (
  echo [错误] .env.local 里没有 NEXT_PUBLIC_SUPABASE_URL
  pause & exit /b 1
)
echo [2/5] 配置文件就绪

REM ---------- 3. Supabase ----------
powershell -NoProfile -Command "try{ $null=Invoke-WebRequest -Uri 'http://127.0.0.1:8000/rest/v1/' -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop; exit 0 }catch{ exit 1 }"
if errorlevel 1 (
  echo [3/5] 本机 Supabase 未响应，尝试启动 Docker 容器...
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
  set "SUP=0"
  for /l %%i in (1,1,30) do (
    if "!SUP!"=="0" (
      powershell -NoProfile -Command "try{ $null=Invoke-WebRequest -Uri 'http://127.0.0.1:8000/rest/v1/' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; exit 0 }catch{ exit 1 }"
      if not errorlevel 1 set "SUP=1"
      if "!SUP!"=="0" timeout /t 2 >nul
    )
  )
  if "!SUP!"=="0" (
    echo [警告] 30 秒内 Supabase 仍不可用；应用会启动，但登录/数据会失败
    echo        请检查 Docker Desktop 是否运行、Supabase 容器是否正常
  ) else (
    echo        Supabase 已就绪
  )
) else (
  echo [3/5] Supabase 已在线
)

REM ---------- 4. 依赖与构建 ----------
if not exist "%APP%\node_modules" (
  echo [4/5] 首次运行，安装依赖（约 1-3 分钟）...
  pushd "%APP%" & call npm ci & popd
) else (
  echo [4/5] 依赖已存在
)
if not exist "%APP%\.next\BUILD_ID" (
  echo       首次运行，构建生产版本（约 1-2 分钟）...
  pushd "%APP%" & call npm run build & popd
  if not exist "%APP%\.next\BUILD_ID" (
    echo [警告] 构建失败，改用开发模式启动（较慢但可用）
    set "MODE=dev"
  )
)

REM ---------- 5. 启动 ----------
echo [5/5] 启动应用（端口 %PORT%）...
if /i "%MODE%"=="dev" (
  start "lyytx-app" /D "%APP%" cmd /c "npm run dev -- -H 0.0.0.0 -p %PORT%"
) else (
  start "lyytx-app" /D "%APP%" cmd /c "npm run start -- -H 0.0.0.0 -p %PORT%"
)

REM 等端口
set "UP=0"
for /l %%i in (1,1,60) do (
  if "!UP!"=="0" (
    powershell -NoProfile -Command "try{ $null=Invoke-WebRequest -Uri 'http://127.0.0.1:%PORT%/' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; exit 0 }catch{ exit 1 }"
    if not errorlevel 1 set "UP=1"
    if "!UP!"=="0" timeout /t 1 >nul
  )
)

REM 取本机局域网 IP
set "LANIP="
for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object {$_.IPAddress -notlike ''127.*'' -and $_.IPAddress -notlike ''169.254.*''} ^| Select-Object -First 1 -ExpandProperty IPAddress)"') do set "LANIP=%%i"

echo.
if "!UP!"=="1" (
  echo ============================================================
  echo   启动成功
  echo   本机打开：   http://localhost:%PORT%
  if not "!LANIP!"=="" echo   手机/局域网： http://!LANIP!:%PORT%
  echo ============================================================
  start "" "http://localhost:%PORT%"
) else (
  echo [警告] 应用可能还在启动中，请稍等 10 秒后手动打开 http://localhost:%PORT%
)
echo.
echo 关闭服务：双击 windows\停止项目.bat
pause
