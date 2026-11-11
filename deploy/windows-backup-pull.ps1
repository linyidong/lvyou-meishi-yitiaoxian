# Pull the latest database dump from the cloud server to this Windows machine.
# Scheduled: daily 04:30 + at logon (idempotent; re-running does not duplicate).
# Config file (optional): C:\lyytx-ops\backup-pull.conf
#   DEST=E:\lyytx-offsite
#   KEEP=30
$ErrorActionPreference = 'Stop'

$Conf = 'C:\lyytx-ops\backup-pull.conf'
$cfg = @{}
if (Test-Path $Conf) {
    Get-Content $Conf | ForEach-Object {
        if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$') { $cfg[$Matches[1]] = $Matches[2] }
    }
}

$Key   = "$env:USERPROFILE\.ssh\id_lyytx_deploy"
$Host_ = 'ubuntu@139.199.191.102'

if ($cfg['DEST']) {
    $Dest = $cfg['DEST']
} elseif ($env:LYYTX_BACKUP_DEST) {
    $Dest = $env:LYYTX_BACKUP_DEST
} else {
    $drive = Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne 'C' -and $_.Free -gt 1GB } |
        Sort-Object Name |
        Select-Object -First 1
    if ($drive) {
        $Dest = "$($drive.Name):\lyytx-offsite"
    } else {
        $Dest = 'C:\lyytx-ops\offsite'
        Write-Warning 'No non-C drive found; falling back to C:\lyytx-ops\offsite'
    }
}

if ($cfg['KEEP']) {
    $Keep = [int]$cfg['KEEP']
} else {
    $Keep = 30
}

New-Item -ItemType Directory -Force $Dest | Out-Null

$remote = (ssh -i $Key -o BatchMode=yes -o StrictHostKeyChecking=accept-new $Host_ "ls -1t /srv/backup/lyytx-*.sql.gz 2>/dev/null | head -1").Trim()
if (-not $remote) { throw 'No backup file found on server' }
$name  = Split-Path $remote -Leaf
$local = Join-Path $Dest $name

if (-not (Test-Path $local)) {
    scp -i $Key -o BatchMode=yes -o StrictHostKeyChecking=accept-new "${Host_}:$remote" $local
}

$rsize = [int64](ssh -i $Key -o BatchMode=yes $Host_ "stat -c %s $remote")
$lsize = (Get-Item $local).Length
if ($rsize -ne $lsize) { throw "Size mismatch: remote $rsize / local $lsize" }

Get-ChildItem (Join-Path $Dest 'lyytx-*.sql.gz') |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $Keep |
    Remove-Item -Force

$stamp = Get-Date -Format 's'
"$stamp ok $name ($lsize bytes)" | Out-File -Append (Join-Path $Dest 'backup.log')
Write-Output "ok $name ($lsize bytes)"
