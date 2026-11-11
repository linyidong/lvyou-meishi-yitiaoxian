# 家机（Windows）：每日从云机拉取最新数据库备份到本机
# 安装：见 docs/deployment.md §4.13「异地备份」
# 计划任务：每日 04:30 + 开机补拉（脚本幂等，重复跑不会重复下载）
$ErrorActionPreference = 'Stop'

$Key   = "$env:USERPROFILE\.ssh\id_lyytx_deploy"
$Host_ = 'ubuntu@139.199.191.102'
$Dest  = 'C:\lyytx-ops\offsite'
$Keep  = 30

New-Item -ItemType Directory -Force $Dest | Out-Null

# 取云端最新一份
$remote = ssh -i $Key -o BatchMode=yes -o StrictHostKeyChecking=accept-new $Host_ "ls -1t /srv/backup/lyytx-*.sql.gz 2>/dev/null | head -1"
if (-not $remote) { throw "云端没有备份文件" }
$name  = Split-Path $remote -Leaf
$local = Join-Path $Dest $name

if (-not (Test-Path $local)) {
    scp -i $Key -o BatchMode=yes -o StrictHostKeyChecking=accept-new "${Host_}:$remote" $local
}

# 字节数校验（远端 vs 本地）
$rsize = [int64](ssh -i $Key -o BatchMode=yes $Host_ "stat -c %s $remote")
$lsize = (Get-Item $local).Length
if ($rsize -ne $lsize) { throw "大小不一致：远端 $rsize / 本地 $lsize" }

# 保留最近 N 份
Get-ChildItem (Join-Path $Dest 'lyytx-*.sql.gz') |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $Keep |
    Remove-Item -Force

"$(Get-Date -Format s) ok $name ($lsize bytes)" | Out-File -Append (Join-Path $Dest 'backup.log')
Write-Output "ok $name ($lsize bytes)"
