# 在桌面创建「旅行美食一条线」启动/停止快捷方式
$root = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
$ws = New-Object -ComObject WScript.Shell

function New-Shortcut($name, $target, $icon) {
  $p = Join-Path $desktop "$name.lnk"
  $s = $ws.CreateShortcut($p)
  $s.TargetPath = $target
  $s.WorkingDirectory = $root
  $s.IconLocation = $icon
  $s.Description = '旅行美食一条线'
  $s.Save()
  Write-Host "已创建：$p"
}

New-Shortcut '旅行美食一条线-启动' (Join-Path $root 'windows\启动项目.bat') 'shell32.dll,137'
New-Shortcut '旅行美食一条线-停止' (Join-Path $root 'windows\停止项目.bat') 'shell32.dll,131'
New-Shortcut '旅行美食一条线-诊断' (Join-Path $root 'windows\诊断.bat') 'shell32.dll,222'
Write-Host '完成。双击桌面「旅行美食一条线-启动」即可。'
