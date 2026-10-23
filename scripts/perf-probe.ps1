# Sonda de desempenho do app em modo dev (ASCII de proposito: o PowerShell 5.1 le .ps1 sem BOM como ANSI).
# Uso: powershell -ExecutionPolicy Bypass -File scripts\perf-probe.ps1 -Modo hold|idle -Segundos 60 -Intervalo 5
#   hold = MW_SELFTEST=hold (captura uma janela de teste sem fechar); idle = app normal (sem janela do jogo aberta).
# Inicia node_modules\electron\dist\electron.exe . (o mesmo binario que `npx electron .` abre, sem os processos do npx),
# espera -Aquecimento s, amostra CPU e working set de cada processo da arvore e encerra SO a arvore que iniciou.
# Tipos: main (sem --type=), gpu-process, renderer overlay (--mw-overlay), renderer capturadora (--mw-capturador),
# renderer outro (janela de teste do selftest), utility, outros.
param(
  [ValidateSet('hold', 'idle')][string]$Modo = 'hold',
  [int]$Segundos = 60,
  [int]$Intervalo = 5,
  [int]$Aquecimento = 15
)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $raiz 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path (Join-Path $raiz 'dist\main.js'))) { throw 'dist\main.js nao existe: rode node build.mjs antes' }

$antes = $env:MW_SELFTEST
if ($Modo -eq 'hold') { $env:MW_SELFTEST = 'hold' } else { Remove-Item Env:MW_SELFTEST -ErrorAction SilentlyContinue }
$p = Start-Process -FilePath $exe -ArgumentList '.' -WorkingDirectory $raiz -PassThru -WindowStyle Normal
if ($null -eq $antes) { Remove-Item Env:MW_SELFTEST -ErrorAction SilentlyContinue } else { $env:MW_SELFTEST = $antes }

$vistos = @{}  # pid -> tipo (so processos da arvore iniciada aqui)
function Arvore {
  $todos = Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId, CommandLine
  $ids = @{ $p.Id = $true }; $mudou = $true
  while ($mudou) {
    $mudou = $false
    foreach ($x in $todos) { if ($ids.ContainsKey([int]$x.ParentProcessId) -and -not $ids.ContainsKey([int]$x.ProcessId)) { $ids[[int]$x.ProcessId] = $true; $mudou = $true } }
  }
  $todos | Where-Object { $ids.ContainsKey([int]$_.ProcessId) }
}
function Tipo($cmd) {
  if ($cmd -notmatch '--type=(\S+)') { return 'main' }
  $t = $Matches[1]
  if ($t -eq 'renderer') {
    if ($cmd -match '--mw-capturador') { return 'renderer capturadora' }
    if ($cmd -match '--mw-overlay') { return 'renderer overlay' }
    return 'renderer outro'
  }
  if ($t -eq 'gpu-process' -or $t -eq 'utility') { return $t }
  return $t
}

try {
  Start-Sleep -Seconds $Aquecimento
  $cpu0 = @{}; $cpu1 = @{}; $picoTipo = @{}; $picoTotal = 0
  $t0 = Get-Date
  $fim = $t0.AddSeconds($Segundos)
  $primeira = $true
  while ($true) {
    $ws = @{}; $total = 0
    foreach ($x in Arvore) {
      $id = [int]$x.ProcessId
      if (-not $vistos.ContainsKey($id)) { $vistos[$id] = Tipo $x.CommandLine }
      $gp = Get-Process -Id $id -ErrorAction SilentlyContinue
      if ($null -eq $gp) { continue }
      $c = $gp.TotalProcessorTime.TotalSeconds
      # processo que ja existia na 1a amostra conta a partir dela; um que nasceu depois conta desde 0
      if (-not $cpu0.ContainsKey($id)) { $cpu0[$id] = $(if ($primeira) { $c } else { 0 }) }
      $cpu1[$id] = $c
      $tp = $vistos[$id]
      $ws[$tp] = [double]$ws[$tp] + $gp.WorkingSet64 / 1MB
      $total += $gp.WorkingSet64 / 1MB
    }
    foreach ($k in $ws.Keys) { if ($ws[$k] -gt [double]$picoTipo[$k]) { $picoTipo[$k] = $ws[$k] } }
    if ($total -gt $picoTotal) { $picoTotal = $total }
    $primeira = $false
    if ((Get-Date) -ge $fim) { break }
    Start-Sleep -Seconds $Intervalo
  }
  $dur = ((Get-Date) - $t0).TotalSeconds
  $cpuTipo = @{}
  foreach ($id in $cpu1.Keys) { $tp = $vistos[$id]; $cpuTipo[$tp] = [double]$cpuTipo[$tp] + ($cpu1[$id] - $cpu0[$id]) }
  $linhas = foreach ($k in ($vistos.Values | Sort-Object -Unique)) {
    [pscustomobject]@{
      Tipo = $k
      Processos = @($vistos.Values | Where-Object { $_ -eq $k }).Count
      'CPU % (1 nucleo)' = [math]::Round(100 * [double]$cpuTipo[$k] / $dur, 1)
      'Pico MB' = [math]::Round([double]$picoTipo[$k], 0)
    }
  }
  $somaCpu = ($cpuTipo.Values | Measure-Object -Sum).Sum
  $linhas = @($linhas) + [pscustomobject]@{ Tipo = 'TOTAL'; Processos = $vistos.Count; 'CPU % (1 nucleo)' = [math]::Round(100 * $somaCpu / $dur, 1); 'Pico MB' = [math]::Round($picoTotal, 0) }
  Write-Output ("Modo {0}, {1:N0} s medidos (apos {2} s de aquecimento), amostra a cada {3} s" -f $Modo, $dur, $Aquecimento, $Intervalo)
  $linhas | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
} finally {
  $ErrorActionPreference = 'SilentlyContinue'
  # encerra so a arvore iniciada aqui (e qualquer processo dela que tenha ficado orfao)
  & taskkill.exe /PID $p.Id /T /F 2>$null | Out-Null
  foreach ($id in $vistos.Keys) {
    $g = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($g -and $g.ProcessName -eq 'electron') { & taskkill.exe /PID $id /T /F 2>$null | Out-Null }
  }
}
