@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title 旅行美食一条线 · 环境诊断
cd /d "%~dp0.."
set "ROOT=%CD%"
set "APP=%ROOT%\Project"
set "SUPABASE_DIR="
if exist "%ROOT%\windows\config.bat" call "%ROOT%\windows\config.bat"

echo ============ 环境诊断 ============
echo.
echo [Node]
where node >nul 2>nul && (for /f "delims=" %%v in ('node -v') do echo   Node.js %%v) || echo   未安装 Node.js
where npm  >nul 2>nul && (for /f "delims=" %%v in ('npm -v')  do echo   npm %%v) || echo   未安装 npm
echo.
echo [Python]
where python >nul 2>nul && (for /f "delims=" %%v in ('python --version 2^>^&1') do echo   %%v) || echo   未安装 Python（本应用不需要，装 Supabase 时可能用到）
echo.
echo [配置]
if exist "%APP%\.env.local" (
  for /f %%c in ('findstr /R /C:"^[A-Z_]*=" "%APP%\.env.local" ^| find /c /v ""') do echo   .env.local 存在，含 %%c 个变量
) else (
  echo   [缺失] %APP%\.env.local
)
echo.
echo [依赖]
if exist "%APP%\node_modules" (echo   node_modules 已安装) else (echo   [缺失] node_modules，运行 npm ci)
if exist "%APP%\.next\BUILD_ID" (echo   已构建生产版本) else (echo   未构建，启动时会自动 npm run build)
echo.
echo [Supabase]
powershell -NoProfile -Command "try{ $r=Invoke-WebRequest -Uri 'http://127.0.0.1:8000/rest/v1/' -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop; Write-Host ('  在线 HTTP ' + [int]$r.StatusCode) }catch{ Write-Host '  [离线] 127.0.0.1:8000 不可达' }"
echo.
echo [端口 3000]
powershell -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if($c){ Write-Host '  已被占用（应用可能已在运行）' } else { Write-Host '  空闲' }"
echo.
echo [局域网地址]
powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*'} | ForEach-Object { Write-Host ('  http://' + $_.IPAddress + ':3000') })"
echo.
echo [防火墙 3000 端口]
powershell -NoProfile -Command "$r=Get-NetFirewallRule -DisplayName 'lyytx-3000' -ErrorAction SilentlyContinue; if($r){ Write-Host '  规则已存在' } else { Write-Host '  未放行（手机访问不了时，右键以管理员运行 windows\允许局域网访问.bat）' }"
echo.
pause
