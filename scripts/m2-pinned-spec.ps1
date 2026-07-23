<#
.SYNOPSIS
  M2 calibration harness — E/P init-time ratio for one spec, affinity-pinned "airtight" —
  docs/research/hybrid-cpu-scheduling-research.md §9 (M2) and §3.2/§3.3.
.DESCRIPTION
  Runs `npx playwright test <spec>` with the WHOLE process tree pinned to a P-core mask (0xFFFF, the
  16 P-threads) or an E-core mask (0xFFFF0000, the 16 E-cores) on THIS machine (i9-14900; see the
  research doc §1.1 — override via -Mask <hex> on different hardware) and reports wall time. Two
  invocations (one per mask) give the real E/P init-time ratio the doc's §5.2 light-class timeout is
  sized from.

  AFFINITY MECHANICS (doc §3.2/§3.3): child processes inherit their parent's affinity mask
  (SetProcessAffinityMask docs, verified locally in the research doc §1.3), so pinning ONE process at
  the top of the tree pins every worker/browser/renderer under it. The doc flags a caveat with the
  naive "Start-Process then set .ProcessorAffinity" approach: children spawned in the race window
  BEFORE the property assignment keep the OLD mask. This script avoids that race entirely by using the
  "airtight" mechanism the doc names (mirrors what `start /affinity` does internally): CreateProcess
  with CREATE_SUSPENDED, SetProcessAffinityMask on the still-suspended process, THEN ResumeThread — the
  mask is baked in before the process executes a single instruction, let alone spawns a child.

  This script NEVER modifies serve.js or playwright.config.ts. It launches a completely normal
  `npx playwright test <spec>` — the config's own webServer (build.py + serve.js on port 8123,
  reuseExistingServer:false) runs exactly as it does for any other invocation. Because of
  reuseExistingServer:false, a busy port 8123 would make Playwright itself fail with EADDRINUSE — this
  script checks that PRECONDITION itself first and refuses to even launch, per CLAUDE.md §11a's
  port-8123 collision lesson (L18).

.PARAMETER SpecPath
  Path to a single spec file, e.g. tests/active-hub.spec.ts (repo's own heaviest-init specs per §11a).
.PARAMETER Mask
  'P' (0xFFFF, the 16 P-threads), 'E' (0xFFFF0000, the 16 E-cores), or a raw hex mask (e.g. 0xFF).
.PARAMETER Port
  Port to precondition-check for "already busy" (default 8123 — playwright.config.ts's default).
.PARAMETER OutDir
  Output directory for the result JSON. Default: docs/research/measurements under the repo root.
.PARAMETER SelfTest
  Smoke-test / integrity-check mode: ignores -SpecPath, instead pins a trivial child (a nested pwsh
  that writes its OWN observed ProcessorAffinity to a temp file) and verifies the observed mask matches
  the requested one exactly. Proves the CreateProcess-suspended pinning mechanism itself works, in
  under a second, with no build/server/browser cost — this is the instrument's own correctness check,
  not a placeholder.
.PARAMETER Help
  Print usage and exit.
.EXAMPLE
  pwsh scripts/m2-pinned-spec.ps1 -SelfTest
.EXAMPLE
  pwsh scripts/m2-pinned-spec.ps1 -SpecPath tests/active-hub.spec.ts -Mask P
  pwsh scripts/m2-pinned-spec.ps1 -SpecPath tests/active-hub.spec.ts -Mask E
#>
[CmdletBinding()]
param(
  [string]$SpecPath,
  [string]$Mask,
  [int]$Port = 8123,
  [string]$OutDir,
  [switch]$SelfTest,
  [switch]$Help
)

function Write-Usage {
  Write-Host @'
m2-pinned-spec.ps1 — affinity-pinned single-spec run (docs/research/hybrid-cpu-scheduling-research.md §9 M2)

  -SpecPath <path>   spec file to run, e.g. tests/active-hub.spec.ts   (required unless -SelfTest)
  -Mask <P|E|hex>    P = 0xFFFF (16 P-threads); E = 0xFFFF0000 (16 E-cores); or a raw hex mask
                     (required unless -SelfTest)
  -Port <N>          port to precondition-check as "already busy"      (default: 8123)
  -OutDir <path>     output directory for the result JSON              (default: docs/research/measurements)
  -SelfTest          verify the pinning mechanism itself (no build/server/browser cost) — smoke path
  -Help              this text

Examples:
  pwsh scripts/m2-pinned-spec.ps1 -SelfTest
  pwsh scripts/m2-pinned-spec.ps1 -SpecPath tests/active-hub.spec.ts -Mask P
  pwsh scripts/m2-pinned-spec.ps1 -SpecPath tests/active-hub.spec.ts -Mask E
'@
}

if ($Help) { Write-Usage; exit 0 }
if (-not $SelfTest -and -not $SpecPath) { Write-Usage; Write-Error "Need -SpecPath (or pass -SelfTest)."; exit 1 }
if (-not $SelfTest -and -not $Mask) { Write-Usage; Write-Error "Need -Mask: P, E, or a hex mask."; exit 1 }

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $RepoRoot 'docs\research\measurements' }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$Stamp = Get-Date -Format 'yyyy-MM-ddTHH-mm-ss'

function Resolve-Mask {
  param([string]$MaskArg)
  switch -Regex ($MaskArg) {
    '^[Pp]$' { return [uint64]0xFFFF }        # 16 P-threads (LP 0-15) — this machine, doc §1.1
    '^[Ee]$' { return [uint64]0xFFFF0000 }    # 16 E-cores (LP 16-31) — this machine, doc §1.1
    '^(0x)?[0-9A-Fa-f]+$' { return [Convert]::ToUInt64(($MaskArg -replace '^0x', ''), 16) }
    default { throw "Invalid mask '$MaskArg' — use P, E, or a hex mask like 0xFFFF" }
  }
}

function Test-PortBusy {
  param([int]$Port)
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    $connected = $iar.AsyncWaitHandle.WaitOne(500) -and $client.Connected
    return [bool]$connected
  } catch { return $false }
  finally { $client.Close() }
}

# ---------------------------------------------------------------------------------------------------
# P/Invoke: CreateProcess(CREATE_SUSPENDED) -> SetProcessAffinityMask -> ResumeThread.
# The "airtight" mechanism per the research doc §3.2 — mask is applied before the process runs a single
# instruction, closing the race window a plain Start-Process + post-hoc .ProcessorAffinity assignment has.
# ---------------------------------------------------------------------------------------------------
$PinTypeSrc = @'
using System;
using System.Text;
using System.Runtime.InteropServices;
namespace MkPin {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct STARTUPINFO {
    public int cb; public string lpReserved; public string lpDesktop; public string lpTitle;
    public int dwX; public int dwY; public int dwXSize; public int dwYSize;
    public int dwXCountChars; public int dwYCountChars; public int dwFillAttribute;
    public int dwFlags; public short wShowWindow; public short cbReserved2;
    public IntPtr lpReserved2; public IntPtr hStdInput; public IntPtr hStdOutput; public IntPtr hStdError;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct PROCESS_INFORMATION { public IntPtr hProcess; public IntPtr hThread; public int dwProcessId; public int dwThreadId; }

  public static class Native {
    public const uint CREATE_SUSPENDED = 0x00000004;
    public const uint INFINITE = 0xFFFFFFFF;

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CreateProcess(string lpApplicationName, StringBuilder lpCommandLine,
      IntPtr lpProcessAttributes, IntPtr lpThreadAttributes, bool bInheritHandles, uint dwCreationFlags,
      IntPtr lpEnvironment, string lpCurrentDirectory, ref STARTUPINFO lpStartupInfo, out PROCESS_INFORMATION lpProcessInformation);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetProcessAffinityMask(IntPtr hProcess, UIntPtr dwProcessAffinityMask);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern uint ResumeThread(IntPtr hThread);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool CloseHandle(IntPtr hObject);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern uint WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetExitCodeProcess(IntPtr hProcess, out uint lpExitCode);
  }
}
'@
if (-not ('MkPin.Native' -as [type])) { Add-Type -TypeDefinition $PinTypeSrc -Language CSharp }

function Start-PinnedProcess {
  param([string]$AppPath, [string]$CommandLine, [string]$WorkDir, [uint64]$MaskValue)
  $si = New-Object MkPin.STARTUPINFO
  $si.cb = [System.Runtime.InteropServices.Marshal]::SizeOf([type]'MkPin.STARTUPINFO')
  $pi = New-Object MkPin.PROCESS_INFORMATION
  $sb = New-Object System.Text.StringBuilder($CommandLine, 32768)

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  # lpApplicationName MUST be explicit — passing $null (letting CreateProcess parse the executable out of
  # lpCommandLine's first quoted token) failed with ERROR_PATH_NOT_FOUND (3) on this system even for a
  # verified-correct, verified-existing quoted path; diagnosed empirically 2026-07-23. An explicit AppPath
  # is also simply more correct (removes any path-search ambiguity), so this isn't a workaround, it's the
  # better call shape.
  $ok = [MkPin.Native]::CreateProcess($AppPath, $sb, [IntPtr]::Zero, [IntPtr]::Zero, $false, `
    [MkPin.Native]::CREATE_SUSPENDED, [IntPtr]::Zero, $WorkDir, [ref]$si, [ref]$pi)
  if (-not $ok) {
    $werr = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    throw "CreateProcess failed, Win32Error=$werr, appPath=$AppPath, commandLine=$CommandLine"
  }
  try {
    $maskPtr = [UIntPtr]::new($MaskValue)
    $affOk = [MkPin.Native]::SetProcessAffinityMask($pi.hProcess, $maskPtr)
    $affErr = if (-not $affOk) { [System.Runtime.InteropServices.Marshal]::GetLastWin32Error() } else { 0 }
    if (-not $affOk) { Write-Warning "SetProcessAffinityMask failed, Win32Error=$affErr — resuming UNPINNED anyway." }
    [void][MkPin.Native]::ResumeThread($pi.hThread)

    # Wait + read exit code via the RAW handle we created, not System.Diagnostics.Process.GetProcessById().
    # .NET's Process.ExitCode is unreliable for a process object attached post-hoc via GetProcessById (it
    # opens its OWN internal handle rather than reusing ours) — diagnosed empirically 2026-07-23: HasExited
    # correctly read True, but .ExitCode then returned an empty value instead of the real code, while
    # GetExitCodeProcess() on OUR OWN CreateProcess-returned handle read the correct value every time.
    [void][MkPin.Native]::WaitForSingleObject($pi.hProcess, [MkPin.Native]::INFINITE)
    $sw.Stop()
    [uint32]$exitCode = 0
    [void][MkPin.Native]::GetExitCodeProcess($pi.hProcess, [ref]$exitCode)
    [pscustomobject]@{
      Pid = $pi.dwProcessId; ExitCode = [int]$exitCode; ElapsedSeconds = [math]::Round($sw.Elapsed.TotalSeconds, 3)
      AffinityApplied = [bool]$affOk; AffinityError = $affErr
    }
  } finally {
    [void][MkPin.Native]::CloseHandle($pi.hProcess)
    [void][MkPin.Native]::CloseHandle($pi.hThread)
  }
}

# ---------------------------------------------------------------------------------------------------
# -SelfTest: prove the pinning mechanism itself is correct — no build/server/browser cost.
# The pinned child is a nested pwsh that writes its OWN observed ProcessorAffinity to a temp file;
# THIS script then reads that file back and asserts it matches the requested mask exactly.
# ---------------------------------------------------------------------------------------------------
if ($SelfTest) {
  $maskVal = Resolve-Mask -MaskArg 'P'   # fixed, deterministic self-test mask — doesn't need -Mask
  $tmpFile = Join-Path ([System.IO.Path]::GetTempPath()) "mk-m2-selftest-$([guid]::NewGuid().ToString('N')).txt"
  $childCmd = "[System.Diagnostics.Process]::GetCurrentProcess().ProcessorAffinity.ToString('X') | Out-File -FilePath '$tmpFile' -Encoding ascii"
  $pwshPath = Join-Path $PSHOME 'pwsh.exe'
  $commandLine = "`"$pwshPath`" -NoLogo -NoProfile -Command `"$childCmd`""
  Write-Host "SelfTest: pinning a nested pwsh to 0x$('{0:X}' -f $maskVal) and reading back its OWN observed affinity..."
  try {
    $result = Start-PinnedProcess -AppPath $pwshPath -CommandLine $commandLine -WorkDir $RepoRoot -MaskValue $maskVal
    Start-Sleep -Milliseconds 200   # tiny buffer for the file write to flush after process exit
    $observed = if (Test-Path $tmpFile) { (Get-Content $tmpFile -Raw).Trim() } else { $null }
    $expected = '{0:X}' -f $maskVal
    $matched = ($observed -eq $expected)
    Write-Host "  requested mask=0x$expected  observed (child-reported)=0x$observed  match=$matched"
    Write-Host "  child pid=$($result.Pid) exitCode=$($result.ExitCode) elapsed=$($result.ElapsedSeconds)s AffinityApplied=$($result.AffinityApplied)"
    $ok = $matched -and $result.AffinityApplied -and $result.ExitCode -eq 0
    if ($ok) { Write-Host "SELF-TEST PASSED — the CreateProcess(SUSPENDED)->SetProcessAffinityMask->ResumeThread mechanism works." }
    else { Write-Error "SELF-TEST FAILED — pinning mechanism did not produce the expected observed affinity."; exit 1 }
  } finally {
    Remove-Item -Path $tmpFile -Force -ErrorAction SilentlyContinue
  }
  exit 0
}

# ---------------------------------------------------------------------------------------------------
# Real path: refuse if port busy (precondition), then run the pinned spec.
# ---------------------------------------------------------------------------------------------------
if (Test-PortBusy -Port $Port) {
  Write-Error "Port $Port is already in use — refusing to run (CLAUDE.md §11a: a busy 8123 wedges Playwright's own managed webServer since reuseExistingServer:false). Stop whatever is listening on $Port first (a manual serve.js, another suite run, etc.) and retry."
  exit 1
}
$specFull = Join-Path $RepoRoot $SpecPath
if (-not (Test-Path $specFull) -and -not (Test-Path $SpecPath)) {
  Write-Error "Spec not found: $SpecPath (checked relative to repo root and as given)."
  exit 1
}

$maskVal = Resolve-Mask -MaskArg $Mask
$maskHex = '0x{0:X}' -f $maskVal
$commandLine = "`"$env:ComSpec`" /c `"npx playwright test $SpecPath`""

Write-Host "M2 pinned run: spec=$SpecPath mask=$maskHex workdir=$RepoRoot"
Write-Host "(this runs the REAL config's webServer — python build.py && node serve.js $Port — same as any normal `npx playwright test` invocation)"
$result = Start-PinnedProcess -AppPath $env:ComSpec -CommandLine $commandLine -WorkDir $RepoRoot -MaskValue $maskVal

# ---- Self-verification (L20) ----
$checks = @()
$checks += [pscustomobject]@{ name = 'child process was created'; ok = ($result.Pid -gt 0); detail = "pid=$($result.Pid)" }
$checks += [pscustomobject]@{ name = 'affinity mask was applied'; ok = $result.AffinityApplied; detail = "AffinityApplied=$($result.AffinityApplied) win32Error=$($result.AffinityError)" }
$checks += [pscustomobject]@{ name = 'run took a non-trivial duration (>2s — build.py+serve.js+browser boot floor)'; ok = ($result.ElapsedSeconds -gt 2.0); detail = "elapsedSeconds=$($result.ElapsedSeconds)" }
$hardFails = $checks | Where-Object { -not $_.ok }
$selfVerification = [pscustomobject]@{ ok = ($hardFails.Count -eq 0); checks = $checks }

$payload = [pscustomobject]@{
  generatedAt = (Get-Date).ToString('o'); specPath = $SpecPath; mask = $Mask; maskHex = $maskHex
  port = $Port; pid = $result.Pid; exitCode = $result.ExitCode; wallTimeSeconds = $result.ElapsedSeconds
  affinityApplied = $result.AffinityApplied; selfVerification = $selfVerification
}
$outPath = Join-Path $OutDir "m2-$($Mask)-$Stamp.json"
$payload | ConvertTo-Json -Depth 6 | Out-File -FilePath $outPath -Encoding utf8

Write-Host "`n=== M2 result ==="
Write-Host "  spec           : $SpecPath"
Write-Host "  mask           : $Mask ($maskHex)"
Write-Host "  exit code      : $($result.ExitCode)"
Write-Host "  wall time      : $($result.ElapsedSeconds)s"
Write-Host "  affinity applied: $($result.AffinityApplied)"
Write-Host "  JSON -> $outPath"
Write-Host "`n=== Self-verification ==="
foreach ($c in $checks) { Write-Host "  [$(if ($c.ok) { 'OK' } else { 'FAIL' })] $($c.name) ($($c.detail))" }

if ($result.ExitCode -ne 0) { Write-Warning "Playwright exited non-zero ($($result.ExitCode)) — the TIMING is still recorded, but check the console output above for a real test failure vs an environment problem." }
if (-not $selfVerification.ok) { Write-Error "SELF-VERIFICATION FAILED — treat this run's wall time as UNTRUSTED."; exit 1 }
exit 0
