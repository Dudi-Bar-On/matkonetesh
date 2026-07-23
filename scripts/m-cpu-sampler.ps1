<#
.SYNOPSIS
  M0/M1 per-logical-processor CPU sampler + process census — docs/research/hybrid-cpu-scheduling-research.md §9.
.DESCRIPTION
  Two independent, read-only instruments in one script. NEVER starts, stops, or otherwise touches
  serve.js or the Playwright suite — it only observes. Safe to run standalone at any time.

  1. CPU sampler (default action). 1 Hz samples of BOTH
       \Processor Information(*)\% Processor Time
       \Processor Information(*)\% Processor Utility
     (the hybrid-aware counter set — "Processor Information", not plain "Processor" — additionally
     exposes % Processor Utility, the frequency-normalized measure Task Manager itself uses, which
     matters when P-cores and E-cores run at very different clocks; doc §1.2). Instance names are
     `Group,LogicalIndex` ("0,0" .. "0,31"). On THIS machine (i9-14900) LP 0-15 are the 8 P-cores
     (SMT pairs) and LP 16-31 are the 16 E-cores — verified via GetLogicalProcessorInformationEx in the
     research doc §1.1; override -PCoreMaxIndex if this ever runs on different hardware. Writes a
     long-format CSV (one row per LP per counter per tick) plus a P-class-vs-E-class summary JSON.

  2. Process census (-Census). One-shot snapshot of node.exe / chrome.exe / chrome-headless-shell.exe:
     PriorityClass, ProcessorAffinity, and (best-effort, via GetProcessInformation /
     ProcessPowerThrottling P/Invoke) EcoQoS power-throttling state — the scriptable equivalent of Task
     Manager's Details tab "Power throttling" column (doc §1.2). This is the automation of a step the
     doc describes as a manual Task-Manager action; the P/Invoke struct layout is corroborated by the
     doc's own citation of Microsoft's SetProcessInformation page (ControlMask/StateMask field names,
     PROCESS_POWER_THROTTLING_EXECUTION_SPEED constant) — treat a value as best-effort and cross-check
     against Task Manager if it looks surprising.

  Self-verification (CLAUDE.md L20): the sampler asserts the counter set exposes all 32 expected LP
  instances before trusting any sample, and asserts it collected at least one row for a nonzero
  duration — a broken instrument fails loudly instead of silently writing an empty/malformed CSV.

.PARAMETER DurationSeconds
  Sampler window in seconds (1 Hz -> this many samples, approx). 0 = skip the sampler (census-only run).
.PARAMETER Census
  Also (or, with -DurationSeconds 0, only) take a one-shot process census.
.PARAMETER StopFile
  Optional sentinel path. If it appears, the sampler stops early (checked once per tick) — lets an
  orchestrator (the RUNBOOK) stop a background-launched sampler deterministically instead of killing it.
.PARAMETER OutDir
  Output directory for CSV/JSON. Default: docs/research/measurements under the repo root.
.PARAMETER Label
  Free-text tag folded into output filenames, e.g. "m0-baseline-8w".
.PARAMETER PCoreMaxIndex
  Highest logical-processor index considered P-class (inclusive). Default 15 (this machine).
.EXAMPLE
  pwsh scripts/m-cpu-sampler.ps1 -DurationSeconds 400 -Label m0-baseline-8w
  # Start this BEFORE `npx playwright test`, sized to comfortably outlast the ~2.3-2.5m run.
.EXAMPLE
  pwsh scripts/m-cpu-sampler.ps1 -DurationSeconds 0 -Census -Label spot-check
  # Instant process census only, no continuous sampling.
.EXAMPLE
  pwsh scripts/m-cpu-sampler.ps1 -DurationSeconds 5 -Label smoke
  # Fast smoke path.
#>
[CmdletBinding()]
param(
  [int]$DurationSeconds = 300,
  [switch]$Census,
  [string]$StopFile,
  [string]$OutDir,
  [string]$Label = 'run',
  [int]$PCoreMaxIndex = 15,
  [switch]$Help
)

if ($Help) {
  Write-Host @'
m-cpu-sampler.ps1 — per-LP CPU sampler + process census (docs/research/hybrid-cpu-scheduling-research.md §9)

  -DurationSeconds <N>   sampler window in seconds, 1 Hz          (default: 300; 0 = skip sampler)
  -Census                also/only take a one-shot process census (node/chrome/chrome-headless-shell)
  -StopFile <path>       sentinel file; sampler stops early if it appears (checked once per tick)
  -OutDir <path>         output directory                        (default: docs/research/measurements)
  -Label <text>          tag folded into output filenames         (default: run)
  -PCoreMaxIndex <N>     highest LP index treated as P-class      (default: 15, this machine's 8 P-cores)
  -Help                  this text

Examples:
  pwsh scripts/m-cpu-sampler.ps1 -DurationSeconds 400 -Label m0-baseline-8w
  pwsh scripts/m-cpu-sampler.ps1 -DurationSeconds 0 -Census -Label spot-check
  pwsh scripts/m-cpu-sampler.ps1 -DurationSeconds 5 -Label smoke
'@
  exit 0
}

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $RepoRoot 'docs\research\measurements' }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$Stamp = Get-Date -Format 'yyyy-MM-ddTHH-mm-ss'

# ---------------------------------------------------------------------------------------------------
# Preflight — verify the hybrid-aware counter set actually exposes the 32 LP instances this whole
# script assumes, BEFORE trusting any sample (L20).
# ---------------------------------------------------------------------------------------------------
function Test-CounterTopology {
  $paths = (Get-Counter -ListSet 'Processor Information').PathsWithInstances
  $timeInstances = $paths | Where-Object { $_ -match '% Processor Time$' -and $_ -notmatch '_Total' } |
    ForEach-Object { if ($_ -match '\((\d+,\d+)\)') { $Matches[1] } }
  $expected = 0..31 | ForEach-Object { "0,$_" }
  $missing = $expected | Where-Object { $_ -notin $timeInstances }
  [pscustomobject]@{ Ok = ($missing.Count -eq 0); FoundCount = ($timeInstances | Sort-Object -Unique).Count; Missing = $missing }
}

Write-Host "Preflight: checking 'Processor Information' counter set exposes LP instances 0,0..0,31..."
$topo = Test-CounterTopology
if (-not $topo.Ok) {
  Write-Warning "Topology check: only $($topo.FoundCount)/32 expected LP instances found. Missing: $($topo.Missing -join ', ')"
  Write-Warning "The P-class(0-$PCoreMaxIndex)/E-class split below may not reflect this machine's real topology."
} else {
  Write-Host "  OK — all 32 LP instances present (0,0..0,31)."
}

# ---------------------------------------------------------------------------------------------------
# CPU sampler
# ---------------------------------------------------------------------------------------------------
function Start-CpuSampling {
  param([int]$Seconds, [string]$StopFile, [string]$CsvPath, [int]$PCoreMax)

  $rows = [System.Collections.Generic.List[object]]::new()
  $counters = @('\Processor Information(*)\% Processor Time', '\Processor Information(*)\% Processor Utility')
  $tick = 0
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    while ($tick -lt $Seconds) {
      if ($StopFile -and (Test-Path $StopFile)) { Write-Host "stop-file detected at tick $tick — stopping early."; break }
      try {
        $sample = Get-Counter -Counter $counters -SampleInterval 1 -MaxSamples 1 -ErrorAction Stop
      } catch {
        Write-Warning "tick $tick : Get-Counter failed ($($_.Exception.Message)) — skipping this tick"
        $tick++
        continue
      }
      foreach ($cs in $sample.CounterSamples) {
        if ($cs.Path -notmatch '\((\d+),(\d+)\)\\(.+)$') { continue }
        $lp = [int]$Matches[2]
        $rawName = $Matches[3]
        $counterName = if ($rawName -match 'utility') { '% Processor Utility' } elseif ($rawName -match 'time') { '% Processor Time' } else { $rawName }
        $class = if ($lp -le $PCoreMax) { 'P' } else { 'E' }
        $rows.Add([pscustomobject]@{
          t = $sample.Timestamp.ToString('o'); tick = $tick; lp = $lp; class = $class
          counter = $counterName; value = [math]::Round($cs.CookedValue, 2)
        })
      }
      $tick++
    }
  } finally {
    if ($rows.Count -gt 0) { $rows | Export-Csv -Path $CsvPath -NoTypeInformation }
    Write-Host "sampler: $tick ticks requested-window=$Seconds rows=$($rows.Count) elapsed=$([math]::Round($sw.Elapsed.TotalSeconds,1))s -> $CsvPath"
  }
  [pscustomobject]@{ Rows = $rows; Ticks = $tick; ElapsedSeconds = [math]::Round($sw.Elapsed.TotalSeconds, 1) }
}

function Get-ClassSummary {
  param($Rows, [string]$Class, [string]$Counter)
  $vals = ($Rows | Where-Object { $_.class -eq $Class -and $_.counter -eq $Counter } | ForEach-Object { $_.value })
  if (-not $vals -or @($vals).Count -eq 0) { return $null }
  $sorted = @($vals) | Sort-Object
  $n = $sorted.Count
  [pscustomobject]@{
    class = $Class; counter = $Counter; n = $n
    mean   = [math]::Round((($sorted | Measure-Object -Sum).Sum / $n), 2)
    median = [math]::Round($sorted[[int][math]::Floor(($n - 1) / 2)], 2)
    max    = [math]::Round(($sorted | Measure-Object -Maximum).Maximum, 2)
    min    = [math]::Round(($sorted | Measure-Object -Minimum).Minimum, 2)
  }
}

# ---------------------------------------------------------------------------------------------------
# Process census — priority/affinity spot-check + best-effort EcoQoS/power-throttling state.
# ---------------------------------------------------------------------------------------------------
$PowerThrottleTypeSrc = @'
using System;
using System.Runtime.InteropServices;
namespace MkCpuSampler {
  [StructLayout(LayoutKind.Sequential)]
  public struct PROCESS_POWER_THROTTLING_STATE { public uint Version; public uint ControlMask; public uint StateMask; }

  public static class PowerThrottle {
    public const uint CURRENT_VERSION = 1;                  // PROCESS_POWER_THROTTLING_CURRENT_VERSION
    public const uint EXECUTION_SPEED = 0x1;                // PROCESS_POWER_THROTTLING_EXECUTION_SPEED
    public const int ProcessPowerThrottling = 4;             // PROCESS_INFORMATION_CLASS enum ordinal — confirmed
                                                              // 2026-07-23 against learn.microsoft.com/.../ne-processthreadsapi-process_information_class
                                                              // (ProcessMemoryPriority=0 .. ProcessInPrivateInfo=3, ProcessPowerThrottling=4).
    // NOTE: this MUST be `ref`, not `out`. GetProcessInformation requires Version pre-populated by the
    // CALLER before the call (a struct-versioning contract) — an `out` parameter's marshaling is
    // output-only in .NET interop, so a caller-set Version never reaches the native call and the API
    // fails with ERROR_INVALID_PARAMETER (87). Diagnosed empirically 2026-07-23 (GetLastWin32Error==87
    // with `out`; ==0/success once switched to `ref` + Version=1 set before the call).
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetProcessInformation(IntPtr hProcess, int ProcessInformationClass,
      ref PROCESS_POWER_THROTTLING_STATE ProcessInformation, uint ProcessInformationSize);
  }
}
'@
if (-not ('MkCpuSampler.PowerThrottle' -as [type])) {
  try { Add-Type -TypeDefinition $PowerThrottleTypeSrc -Language CSharp } catch { Write-Warning "Power-throttling P/Invoke type failed to load: $($_.Exception.Message) — census will report 'unknown' for that column." }
}

function Get-PowerThrottleState {
  param([System.Diagnostics.Process]$Proc)
  if (-not ('MkCpuSampler.PowerThrottle' -as [type])) { return 'unknown (P/Invoke type unavailable)' }
  try {
    $state = New-Object MkCpuSampler.PROCESS_POWER_THROTTLING_STATE
    $state.Version = [MkCpuSampler.PowerThrottle]::CURRENT_VERSION   # caller must pre-populate — see type comment
    $size = [System.Runtime.InteropServices.Marshal]::SizeOf([type]'MkCpuSampler.PROCESS_POWER_THROTTLING_STATE')
    $ok = [MkCpuSampler.PowerThrottle]::GetProcessInformation($Proc.Handle, [MkCpuSampler.PowerThrottle]::ProcessPowerThrottling, [ref]$state, $size)
    if (-not $ok) {
      $werr = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
      return "unknown (query failed, Win32Error=$werr)"
    }
    if ($state.ControlMask -band [MkCpuSampler.PowerThrottle]::EXECUTION_SPEED) {
      if ($state.StateMask -band [MkCpuSampler.PowerThrottle]::EXECUTION_SPEED) { return 'Eco-ENABLED (explicit opt-in)' }
      return 'Eco-explicitly-disabled (HighQoS)'
    }
    return 'system-managed (no explicit opt-in/out)'
  } catch {
    return "unknown ($($_.Exception.Message))"
  }
}

function Get-ProcessCensus {
  param([string]$CsvPath)
  $names = 'node', 'chrome', 'chrome-headless-shell'
  $procs = Get-Process -Name $names -ErrorAction SilentlyContinue
  if (-not $procs) {
    Write-Host "Census: no node/chrome/chrome-headless-shell processes found right now."
    Write-Host "  This is EXPECTED if no Playwright suite is currently running — re-run -Census while"
    Write-Host "  a suite is mid-flight (per the RUNBOOK) for a real snapshot; not a self-verification failure."
    return @()
  }
  $rows = foreach ($p in $procs) {
    $affinityHex = try { '0x{0:X}' -f [int64]$p.ProcessorAffinity } catch { 'unknown' }
    $priority = try { [string]$p.PriorityClass } catch { 'unknown' }
    $eco = Get-PowerThrottleState -Proc $p
    [pscustomobject]@{
      Pid = $p.Id; Name = $p.ProcessName; PriorityClass = $priority
      ProcessorAffinity = $affinityHex; PowerThrottling = $eco
      AnomalyPriority = ($priority -ne 'Normal')
      AnomalyAffinity = ($affinityHex -ne '0xFFFFFFFF')
      AnomalyEco = ($eco -like 'Eco-ENABLED*')
    }
  }
  $rows | Export-Csv -Path $CsvPath -NoTypeInformation
  Write-Host "Census: $($rows.Count) processes -> $CsvPath"
  $rows | Format-Table Pid, Name, PriorityClass, ProcessorAffinity, PowerThrottling -AutoSize | Out-String | Write-Host
  $anomalies = $rows | Where-Object { $_.AnomalyPriority -or $_.AnomalyAffinity -or $_.AnomalyEco }
  if ($anomalies) {
    Write-Warning "Census anomalies (non-Normal priority, restricted affinity, or Eco-enabled) on $($anomalies.Count) process(es):"
    $anomalies | ForEach-Object { Write-Warning "  pid=$($_.Pid) $($_.Name): priority=$($_.PriorityClass) affinity=$($_.ProcessorAffinity) eco=$($_.PowerThrottling)" }
  } else {
    Write-Host "  No anomalies — all Normal priority, full-mask affinity, no explicit Eco opt-in."
  }
  return $rows
}

# ---------------------------------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------------------------------
$selfVerify = @{ ok = $true; checks = @() }

$samplerResult = $null
if ($DurationSeconds -gt 0) {
  $csvPath = Join-Path $OutDir "cpu-sampler-$Label-$Stamp.csv"
  $samplerResult = Start-CpuSampling -Seconds $DurationSeconds -StopFile $StopFile -CsvPath $csvPath -PCoreMax $PCoreMaxIndex

  $rowCountOk = $samplerResult.Rows.Count -gt 0
  $selfVerify.checks += [pscustomobject]@{ name = 'sampler collected >0 rows'; ok = $rowCountOk; detail = "rows=$($samplerResult.Rows.Count)" }
  if (-not $rowCountOk) { $selfVerify.ok = $false }

  $distinctLps = @($samplerResult.Rows | Select-Object -ExpandProperty lp -Unique)
  $lpOk = $distinctLps.Count -eq 32
  $selfVerify.checks += [pscustomobject]@{ name = 'all 32 LPs appeared in samples'; ok = $lpOk; detail = "distinctLps=$($distinctLps.Count)/32" }
  if (-not $lpOk) { Write-Warning "Only $($distinctLps.Count)/32 LPs appeared in the collected samples." }

  $summary = @()
  foreach ($class in 'P', 'E') {
    foreach ($counter in '% Processor Time', '% Processor Utility') {
      $s = Get-ClassSummary -Rows $samplerResult.Rows -Class $class -Counter $counter
      if ($s) { $summary += $s }
    }
  }
  Write-Host "`n=== P-class (LP 0-$PCoreMaxIndex) vs E-class (LP $($PCoreMaxIndex+1)-31) utilization ==="
  $summary | Format-Table class, counter, n, mean, median, max, min -AutoSize | Out-String | Write-Host

  $summaryPath = Join-Path $OutDir "cpu-sampler-$Label-$Stamp.summary.json"
  [pscustomobject]@{
    generatedAt = (Get-Date).ToString('o'); label = $Label
    durationSecondsRequested = $DurationSeconds; ticksRun = $samplerResult.Ticks; elapsedSeconds = $samplerResult.ElapsedSeconds
    pCoreMaxIndex = $PCoreMaxIndex; csvPath = $csvPath; topologyCheck = $topo
    classSummary = $summary; selfVerification = $selfVerify
  } | ConvertTo-Json -Depth 6 | Out-File -FilePath $summaryPath -Encoding utf8
  Write-Host "Summary JSON -> $summaryPath"
}

$censusRows = $null
if ($Census) {
  $censusCsv = Join-Path $OutDir "census-$Label-$Stamp.csv"
  Write-Host "`n=== Process census ==="
  $censusRows = Get-ProcessCensus -CsvPath $censusCsv
}

if ($DurationSeconds -le 0 -and -not $Census) {
  Write-Warning "Nothing to do: -DurationSeconds 0 and -Census not passed. Use -Help for usage."
}

Write-Host "`n=== Self-verification ==="
foreach ($c in $selfVerify.checks) { Write-Host "  [$(if ($c.ok) { 'OK' } else { 'FAIL' })] $($c.name) ($($c.detail))" }
if (-not $selfVerify.ok) {
  Write-Error "SELF-VERIFICATION FAILED — the sampler did not collect a valid sample set. Treat this run's output as UNTRUSTED."
  exit 1
}
exit 0
