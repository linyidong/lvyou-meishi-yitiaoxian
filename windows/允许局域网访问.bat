@echo off
chcp 65001 >nul
title 允许局域网访问 3000
net session >nul 2>&1
if errorlevel 1 (
  echo 需要管理员权限：请右键本文件 -^>“以管理员身份运行”
  pause & exit /b 1
)
netsh advfirewall firewall delete rule name="lyytx-3000" >nul 2>nul
netsh advfirewall firewall add rule name="lyytx-3000" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall delete rule name="lyytx-supabase-8000" >nul 2>nul
netsh advfirewall firewall add rule name="lyytx-supabase-8000" dir=in action=allow protocol=TCP localport=8000
echo.
echo 已放行 3000（应用）与 8000（Supabase）。手机连同一 WiFi 即可访问 http://本机IP:3000
pause
