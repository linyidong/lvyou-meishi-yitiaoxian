@echo off
chcp 65001 >nul
title 旅行美食一条线 · 停止
echo 正在停止占用 3000 端口的应用...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { try { Stop-Process -Id $_ -Force; Write-Host ('已结束进程 ' + $_) } catch {} }"
echo.
echo 完成。Supabase（Docker）默认保持运行；如需一并关闭，执行：
echo    docker compose down   （在 Supabase 的 docker-compose 目录下）
pause
