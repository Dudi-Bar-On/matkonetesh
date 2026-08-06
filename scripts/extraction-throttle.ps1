# extraction-throttle — get the extraction out of development's way, and put it back.
#
#   powershell -ExecutionPolicy Bypass -File scripts\extraction-throttle.ps1 -Pause
#   powershell -ExecutionPolicy Bypass -File scripts\extraction-throttle.ps1 -Resume
#   powershell -ExecutionPolicy Bypass -File scripts\extraction-throttle.ps1 -Status
#
# THE RULE THIS SERVES (owner, 2026-08-06): the extraction may run during the day as long as it does
# not interfere with development. When it does, DEVELOPMENT WINS and the extraction waits for night.
# In practice "interferes" means one thing above all: §11a requires the Playwright suite to run on an
# a quiet machine, and a 27B model saturating the GPU is not a quiet machine.
#
# WHY SUSPEND THE CLIENT AND NOT STOP THE TASK. Stopping the scheduled task kills the extractor
# mid-document; `--pending` resumes correctly, but the document in flight is redone, and at ~5
# minutes each a day of suite runs would throw away most of an hour. Suspending the Python process
# costs nothing: it stops issuing requests, ollama finishes the one generation already in flight
# (seconds), and the GPU goes idle. On resume it continues from exactly where it was.
#
# WHY NOT SUSPEND OLLAMA TOO — and this is the expensive half of the lesson. Suspending the ollama
# server, a Go process with 300+ threads, preceded a fully wedged daemon on 2026-08-06: /api/ps
# stopped answering, no model runner existed, and the extraction lost time until the daemon was
# restarted. The timeline could not attribute it beyond doubt, which is exactly why it is treated as
# a hazard rather than a coincidence. The client alone is enough: with nothing feeding it, ollama
# idles within seconds.
param(
  [switch]$Pause,
  [switch]$Resume,
  [switch]$Status
)

$sig = @'
using System;
using System.Runtime.InteropServices;
public static class ProcCtl {
  [DllImport("ntdll.dll")] public static extern uint NtSuspendProcess(IntPtr h);
  [DllImport("ntdll.dll")] public static extern uint NtResumeProcess(IntPtr h);
}
'@
if (-not ('ProcCtl' -as [type])) { Add-Type -TypeDefinition $sig }

function Get-Extractors {
  Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'extract_graph' }
}

$procs = @(Get-Extractors)

if ($Status -or (-not $Pause -and -not $Resume)) {
  if (-not $procs) { Write-Output "extraction: NOT RUNNING" }
  else {
    foreach ($p in $procs) {
      $o = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue
      # CPU TIME IS THE WRONG SIGNAL HERE, and the first version of this script used it and lied.
      # The extractor is an HTTP client waiting on a 27B model: it burns almost no CPU whether it is
      # running or suspended, so "no cpu movement" reported IDLE for a perfectly healthy process.
      # Windows exposes the real thing — a suspended process has every thread in the Suspended wait
      # state — so ask that instead of inferring from a number that cannot distinguish the two.
      $threads = @($o.Threads)
      $suspended = @($threads | Where-Object { $_.ThreadState -eq 'Wait' -and $_.WaitReason -eq 'Suspended' }).Count
      $moving = -not ($threads.Count -gt 0 -and $suspended -eq $threads.Count)
      Write-Output ("extraction: pid {0} · {1}" -f $p.ProcessId, $(if ($moving) { "RUNNING ($suspended of $($threads.Count) threads suspended)" } else { "SUSPENDED (all $($threads.Count) threads)" }))
    }
  }
  try {
    $ps = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/ps' -TimeoutSec 8
    if ($ps.models) { foreach ($m in $ps.models) { Write-Output ("ollama: {0} resident, {1} GB VRAM" -f $m.name, [math]::Round($m.size_vram/1GB,1)) } }
    else { Write-Output "ollama: answering, no model resident" }
  } catch { Write-Output "ollama: NOT ANSWERING — $($_.Exception.Message)" }
  exit 0
}

if (-not $procs) { Write-Output "no extractor process found — nothing to do."; exit 0 }

foreach ($p in $procs) {
  $o = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue
  if (-not $o) { continue }
  if ($Pause)  { [void][ProcCtl]::NtSuspendProcess($o.Handle); Write-Output "paused  pid $($p.ProcessId) — progress kept, resume when the suite is done" }
  if ($Resume) { [void][ProcCtl]::NtResumeProcess($o.Handle);  Write-Output "resumed pid $($p.ProcessId)" }
}
