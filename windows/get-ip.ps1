<#
  输出本机"可被手机访问"的局域网 IP（T-063）。
  规则：
    1. 只看 Status=Up 的网卡，IPv4，排除 169.254.*（未获取到地址）
    2. 排除虚拟网卡（Docker / WSL / Hyper-V / VMware / VirtualBox / Tailscale / ZeroTier / Loopback）
    3. 优先选有默认网关的网卡（通常就是连路由器的真实网卡），再按 InterfaceMetric 从小到大
    4. 没有网关时退回第一条私网地址
  用法：
    powershell -File get-ip.ps1         → 只输出一个 IP（脚本用）
    powershell -File get-ip.ps1 -All    → 输出所有候选（诊断用，含网卡名）
#>
param([switch]$All)

$virtualPattern = 'Docker|vEthernet|WSL|Hyper-V|VMware|VirtualBox|Loopback|Tailscale|ZeroTier|VPN|TAP-'

$configs = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
  Where-Object {
    $_.NetAdapter.Status -eq 'Up' -and
    $_.IPv4Address -and
    $_.InterfaceAlias -notmatch $virtualPattern -and
    $_.InterfaceDescription -notmatch $virtualPattern
  }

$rows = foreach ($c in $configs) {
  foreach ($a in @($c.IPv4Address)) {
    $ip = $a.IPAddress
    if (-not $ip) { continue }
    if ($ip -like '169.254.*') { continue }
    if ($ip -like '127.*') { continue }
    [pscustomobject]@{
      IP      = $ip
      Alias   = $c.InterfaceAlias
      Gateway = if ($c.IPv4DefaultGateway) { ($c.IPv4DefaultGateway | Select-Object -First 1).NextHop } else { '' }
      Metric  = $c.InterfaceMetric
    }
  }
}

if (-not $rows) {
  # 兜底：所有非回环地址里挑第一个私网段
  $fallback = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -First 1
  if ($fallback) { $rows = @([pscustomobject]@{ IP = $fallback.IPAddress; Alias = $fallback.InterfaceAlias; Gateway = ''; Metric = 9999 }) }
}

# 排序：有网关优先 → 家用/办公常见私网段优先（192.168 > 10 > 其它）→ 跳数小的优先
$sorted = $rows | Sort-Object `
  @{ Expression = { if ($_.Gateway) { 0 } else { 1 } } }, `
  @{ Expression = {
      if ($_.IP -like '192.168.*') { 0 }
      elseif ($_.IP -like '10.*') { 1 }
      elseif ($_.IP -like '172.1[6-9].*' -or $_.IP -like '172.2[0-9].*' -or $_.IP -like '172.3[01].*') { 3 }
      else { 2 }
    } }, `
  Metric

if ($All) {
  if (-not $sorted) { Write-Output '(未找到可用局域网 IP)' ; exit 0 }
  foreach ($r in $sorted) {
    $gw = if ($r.Gateway) { "  网关=$($r.Gateway)" } else { '' }
    Write-Output ("{0,-16} 网卡={1,-24}{2}" -f $r.IP, $r.Alias, $gw)
  }
  exit 0
}

if ($sorted) { Write-Output ($sorted | Select-Object -First 1).IP }
