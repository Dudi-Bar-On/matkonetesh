<#
.SYNOPSIS
  Start / stop / check the ONE shared, long-lived Serena MCP server —
  docs/process/development-discipline.md §10.17a (owner instruction, 2026-07-24).

.DESCRIPTION
  WHY THIS EXISTS. With the stdio form of `.mcp.json` (`command`/`args`), Claude Code starts a SEPARATE
  `serena start-mcp-server` process for the main session AND for every subagent. Observed 2026-07-24:
  4 concurrent Serena processes, dashboards flapping 24282 -> 24283, 8 language servers duplicated per
  instance. §10.17a: run ONE long-lived server for the machine and point `.mcp.json` at it by URL.

  TRANSPORT (from Serena's own docs, `serena-docs-06.md` "Streamable HTTP Mode", mirrored in the agent-memory
  global graph):
    "When using *Streamable HTTP* mode, you control the server lifecycle yourself, i.e. you start the
     server and provide the client with the URL to connect to it. ... serena start-mcp-server
     --transport streamable-http --port <port> ... and then configure your client to connect to
     http://localhost:9121/mcp"
    "The legacy SSE transport is also supported (via --transport sse with corresponding /sse endpoint),
     its use is discouraged."
  -> we use `--transport streamable-http` (NOT sse) and the `/mcp` endpoint. Port default 9121 is the
  port Serena's own docs use in that example.

  THE ONE-PROJECT CAVEAT (same doc, "When to use"): "Serena is a stateful MCP server, and only one coding
  project can be active at a time. Therefore, starting a single Serena instance and connecting it to
  multiple clients is only appropriate if all clients will be working on the same project." That is
  exactly our case — the main session and all its subagents work on this repo — so a single shared
  instance is correct here. If you ever want Serena on a DIFFERENT repo at the same time, do not point
  that repo at this server; give it its own (see -Port / -ProjectPath).

  DETACHMENT. The server is launched through `Win32_Process.Create` (WMI), so it is NOT a child of the
  shell that started it and does not belong to any job object Claude Code may have created. It therefore
  survives the shell, the agent, and the whole Claude session. stdout/stderr go to
  $HOME\.serena\shared-server\server.log (Serena also writes its own logs under $HOME\.serena\logs).

  TEARDOWN SAFETY (§11a: every SETUP owns a matching verified TEARDOWN). -Action stop only ever kills
  processes whose command line contains BOTH `start-mcp-server` and `--port <Port>` and
  `streamable-http`. It can therefore never kill a stdio Serena instance belonging to a live Claude
  session. After killing it VERIFIES: port free AND zero matching processes left (no orphans).

.PARAMETER Action
  start | stop | status | restart. Default: status.
.PARAMETER Port
  MCP listen port. Default 9121 (must match the url in the repo-root .mcp.json).
.PARAMETER ProjectPath
  Project to activate at startup. Default: the repo root (parent of scripts/).
.PARAMETER TimeoutSec
  How long `start` waits for the port to accept connections. Default 90 (first start may download/boot
  language servers).
.PARAMETER Help
  Print usage and exit.

.EXAMPLE
  pwsh scripts/serena-server.ps1 -Action start
.EXAMPLE
  pwsh scripts/serena-server.ps1 -Action status
.EXAMPLE
  pwsh scripts/serena-server.ps1 -Action stop
#>
[CmdletBinding()]
param(
    [ValidateSet('start', 'stop', 'status', 'restart')]
    [string]$Action = 'status',
    [int]$Port = 9121,
    [string]$ProjectPath,
    [int]$TimeoutSec = 90,
    [switch]$Help
)

$ErrorActionPreference = 'Stop'

if ($Help) {
    Get-Help -Full $PSCommandPath
    exit 0
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
if (-not $ProjectPath) { $ProjectPath = $RepoRoot }
$ProjectPath = (Resolve-Path $ProjectPath).Path

$StateDir = Join-Path $HOME '.serena\shared-server'
$PidFile = Join-Path $StateDir 'server.pid.json'
$LogFile = Join-Path $StateDir 'server.log'
$McpUrl = "http://127.0.0.1:$Port/mcp"

function Get-SerenaExe {
    $cmd = Get-Command serena -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $fallback = Join-Path $HOME '.local\bin\serena.exe'
    if (Test-Path $fallback) { return $fallback }
    throw "serena executable not found on PATH and not at $fallback"
}

# Every process belonging to THIS shared server (cmd wrapper + serena.exe + python children).
# The triple match is the teardown safety fence: a stdio instance matches none of --port/streamable-http.
function Get-SharedServerProcesses {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -and
            $_.CommandLine -like '*start-mcp-server*' -and
            $_.CommandLine -like '*streamable-http*' -and
            $_.CommandLine -like "*--port $Port*"
        }
}

function Get-ListeningOn([int]$p) {
    Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue
}

# Real MCP handshake against the endpoint: proves it speaks MCP, not merely that a socket is open.
function Invoke-McpProbe {
    $body = @{
        jsonrpc = '2.0'; id = 1; method = 'initialize'
        params  = @{
            protocolVersion = '2025-06-18'
            capabilities    = @{}
            clientInfo      = @{ name = 'serena-server.ps1'; version = '1' }
        }
    } | ConvertTo-Json -Depth 8 -Compress
    try {
        $r = Invoke-WebRequest -Uri $McpUrl -Method Post -Body $body `
            -ContentType 'application/json' `
            -Headers @{ Accept = 'application/json, text/event-stream' } `
            -TimeoutSec 20 -UseBasicParsing
        return [pscustomobject]@{ Ok = $true; Status = $r.StatusCode; Body = ($r.Content -replace '\s+', ' ') }
    } catch {
        $status = $null
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        return [pscustomobject]@{ Ok = $false; Status = $status; Body = $_.Exception.Message }
    }
}

function Show-Status {
    $procs = @(Get-SharedServerProcesses)
    Write-Output "== shared Serena server =="
    Write-Output "  project : $ProjectPath"
    Write-Output "  url     : $McpUrl"
    Write-Output "  pidfile : $PidFile"
    Write-Output "  log     : $LogFile"
    Write-Output ""
    Write-Output "-- processes matching (start-mcp-server + streamable-http + --port $Port): $($procs.Count)"
    foreach ($p in $procs) {
        Write-Output ("   PID {0,-7} PPID {1,-7} {2}" -f $p.ProcessId, $p.ParentProcessId, $p.Name)
    }
    $listen = @(Get-ListeningOn $Port)
    Write-Output "-- listening on $Port : $($listen.Count)"
    foreach ($l in $listen) {
        Write-Output ("   {0}:{1} owner PID {2}" -f $l.LocalAddress, $l.LocalPort, $l.OwningProcess)
    }
    # Serena's dashboard: base 24282, +1 per extra instance (not settable via CLI).
    $dash = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
            Where-Object { $_.LocalPort -ge 24282 -and $_.LocalPort -le 24292 })
    Write-Output "-- Serena dashboard ports listening (24282-24292): $($dash.Count)"
    foreach ($d in $dash) {
        $owner = (Get-CimInstance Win32_Process -Filter "ProcessId=$($d.OwningProcess)" -ErrorAction SilentlyContinue)
        $kind = 'unknown'
        if ($owner -and $owner.CommandLine) {
            $kind = if ($owner.CommandLine -like '*streamable-http*') { 'SHARED (this server)' } else { 'stdio instance' }
        }
        Write-Output ("   {0}:{1} owner PID {2}  [{3}]  http://127.0.0.1:{1}/dashboard/index.html" -f `
                $d.LocalAddress, $d.LocalPort, $d.OwningProcess, $kind)
    }
    $probe = Invoke-McpProbe
    Write-Output "-- MCP probe POST $McpUrl (initialize)"
    Write-Output ("   ok={0} status={1}" -f $probe.Ok, $probe.Status)
    if ($probe.Body) {
        $b = $probe.Body
        if ($b.Length -gt 600) { $b = $b.Substring(0, 600) + ' ...[truncated]' }
        Write-Output "   $b"
    }
    # Report lines go to the pipeline (Write-Output); the pass/fail verdict is returned out-of-band so
    # callers can chain Show-Status without swallowing the report.
    $script:StatusOk = ($procs.Count -gt 0 -and $listen.Count -gt 0 -and $probe.Ok)
}

function Start-Server {
    if (@(Get-ListeningOn $Port).Count -gt 0) {
        Write-Output "[start] port $Port is already listening — not starting a second instance."
        Show-Status
        return
    }
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
    $exe = Get-SerenaExe
    # cmd.exe wrapper: gives the detached process valid stdout/stderr handles (a log file).
    $inner = '"{0}" start-mcp-server --transport streamable-http --host 127.0.0.1 --port {1} --context claude-code --project "{2}" --enable-web-dashboard true --open-web-dashboard false' -f $exe, $Port, $ProjectPath
    # $inner already carries its own quotes; cmd /c strips exactly the outer pair it sees first/last.
    $cmdLine = 'cmd.exe /c "{0} >> "{1}" 2>&1"' -f $inner, $LogFile
    Write-Output "[start] $inner"
    $res = Invoke-CimMethod -ClassName Win32_Process -MethodName Create `
        -Arguments @{ CommandLine = $cmdLine; CurrentDirectory = $ProjectPath }
    if ($res.ReturnValue -ne 0) { throw "Win32_Process.Create failed with ReturnValue=$($res.ReturnValue)" }
    $rootPid = $res.ProcessId
    Write-Output "[start] detached launcher PID $rootPid (WMI — no parent shell, survives this session)"

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (@(Get-ListeningOn $Port).Count -gt 0) { break }
        Start-Sleep -Milliseconds 500
    }
    if (@(Get-ListeningOn $Port).Count -eq 0) {
        Write-Output "[start] FAILED: port $Port never started listening within ${TimeoutSec}s. Last log lines:"
        if (Test-Path $LogFile) { Get-Content $LogFile -Tail 40 }
        exit 1
    }
    @{
        rootPid     = $rootPid
        port        = $Port
        url         = $McpUrl
        project     = $ProjectPath
        startedUtc  = (Get-Date).ToUniversalTime().ToString('o')
    } | ConvertTo-Json | Set-Content -Path $PidFile -Encoding utf8
    Write-Output "[start] listening. Status:"
    Show-Status
}

function Stop-Server {
    $procs = @(Get-SharedServerProcesses)
    if ($procs.Count -eq 0) {
        Write-Output "[stop] no shared-server process matched — nothing to stop."
    } else {
        # Kill roots first with /T so the whole tree (serena.exe -> python -> python) goes with them.
        $ids = $procs | Select-Object -ExpandProperty ProcessId
        $roots = $procs | Where-Object { $ids -notcontains $_.ParentProcessId } | Select-Object -ExpandProperty ProcessId
        foreach ($rootPid in $roots) {
            Write-Output "[stop] taskkill /PID $rootPid /T /F"
            & taskkill.exe /PID $rootPid /T /F 2>&1 | ForEach-Object { Write-Output "   $_" }
        }
        Start-Sleep -Seconds 2
    }
    # VERIFY teardown: zero matching processes, port free.
    $left = @(Get-SharedServerProcesses)
    $listen = @(Get-ListeningOn $Port)
    Write-Output "[stop] verify: matching processes left = $($left.Count); listeners on $Port = $($listen.Count)"
    foreach ($p in $left) { Write-Output ("   ORPHAN PID {0} {1}" -f $p.ProcessId, $p.Name) }
    if (Test-Path $PidFile) { Remove-Item $PidFile -Force }
    if ($left.Count -eq 0 -and $listen.Count -eq 0) {
        Write-Output "[stop] clean — no orphans, port $Port free."
    } else {
        Write-Output "[stop] NOT CLEAN — see above."
        exit 1
    }
}

switch ($Action) {
    'start' { Start-Server }
    'stop' { Stop-Server }
    'restart' { Stop-Server; Start-Server }
    'status' { Show-Status; if (-not $script:StatusOk) { exit 1 } }
}
