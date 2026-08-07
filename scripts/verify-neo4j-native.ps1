<#
.SYNOPSIS
    Proves (or disproves) that the native Neo4j Windows service install landed correctly.

.DESCRIPTION
    Runs without elevation. Exits non-zero on ANY failure and prints exactly what it checked, so an
    empty/missing finding FAILS rather than silently passing:

      1. A Windows service named 'neo4j' exists and its Status is Running.
      2. Its StartupType is Automatic.
      3. The live sockets (Get-NetTCPConnection - the actual OS socket table, not the config file's
         stated intent) show LISTEN only on 127.0.0.1 for the bolt and http ports from infra/.env -
         never 0.0.0.0, never ::, never any other address.
      4. It answers a real Cypher query (RETURN 1) via cypher-shell using the credential in
         infra/.env - a port that accepts TCP and refuses every query is not a pass.
      5. The installed version matches the intended 2026.06.0.

    Run BEFORE any install, this script is expected to FAIL - that failure is Task 2's RED, proving
    the verifier can actually detect an absent install rather than being a decoration that has
    never been seen failing.
#>

[CmdletBinding()]
param(
    [string]$ExpectedVersion = "2026.06.0"
)

$RepoRoot = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $RepoRoot "infra\.env"
$failures = @()
$checks = @()

function Add-Check($name, $passed, $detail) {
    $script:checks += [PSCustomObject]@{ Name = $name; Passed = $passed; Detail = $detail }
    if (-not $passed) { $script:failures += $name }
}

Write-Host "=== verify-neo4j-native: checking the live machine, not intent ===" -ForegroundColor Cyan

# --- Load infra/.env (best-effort; needed for port numbers + the auth check) ---------------------
$envVars = @{}
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
        if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') { $envVars[$matches[1]] = $matches[2] }
    }
}
$BoltPort = if ($envVars["NEO4J_BOLT_PORT"]) { $envVars["NEO4J_BOLT_PORT"] } else { "7687" }
$HttpPort = if ($envVars["NEO4J_HTTP_PORT"]) { $envVars["NEO4J_HTTP_PORT"] } else { "7474" }
$Neo4jUser = $envVars["NEO4J_USER"]
$Neo4jPassword = $envVars["NEO4J_PASSWORD"]

# --- 1 & 2. Service state -------------------------------------------------------------------------
$svc = Get-Service -Name "neo4j" -ErrorAction SilentlyContinue
if (-not $svc) {
    Add-Check "service exists" $false "no Windows service named 'neo4j' was found."
} else {
    Add-Check "service exists" $true "found, Status=$($svc.Status)"
    Add-Check "service running" ($svc.Status -eq "Running") "Status=$($svc.Status)"
    $wmiSvc = Get-CimInstance -ClassName Win32_Service -Filter "Name='neo4j'" -ErrorAction SilentlyContinue
    if ($wmiSvc) {
        Add-Check "automatic startup" ($wmiSvc.StartMode -eq "Auto") "StartMode=$($wmiSvc.StartMode)"
    } else {
        Add-Check "automatic startup" $false "could not read StartMode via CIM."
    }
}

# --- 3. Live sockets, not config ------------------------------------------------------------------
foreach ($portInfo in @(@{Name = "bolt"; Port = $BoltPort }, @{Name = "http"; Port = $HttpPort })) {
    $conns = Get-NetTCPConnection -LocalPort $portInfo.Port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) {
        Add-Check "$($portInfo.Name) port $($portInfo.Port) listening" $false "nothing is listening on this port at all."
        continue
    }
    Add-Check "$($portInfo.Name) port $($portInfo.Port) listening" $true "listener(s) found: $(($conns | Select-Object -ExpandProperty LocalAddress) -join ', ')"
    $badAddrs = $conns | Where-Object { $_.LocalAddress -notin @("127.0.0.1", "::1") }
    if ($badAddrs) {
        $addrList = ($badAddrs | Select-Object -ExpandProperty LocalAddress) -join ", "
        Add-Check "$($portInfo.Name) loopback-only" $false "listening on non-loopback address(es): $addrList - the A6 gate forbids this."
    } else {
        Add-Check "$($portInfo.Name) loopback-only" $true "127.0.0.1/::1 only"
    }
}

# --- 4. Answers a real query -------------------------------------------------------------------------
$neo4jHome = $env:NEO4J_HOME
if (-not $neo4jHome) {
    $neo4jHome = [System.Environment]::GetEnvironmentVariable("NEO4J_HOME", "Machine")
}
$cypherShell = if ($neo4jHome) { Join-Path $neo4jHome "bin\cypher-shell.bat" } else { $null }
if (-not $Neo4jUser -or -not $Neo4jPassword) {
    Add-Check "answers RETURN 1" $false "infra\.env is missing NEO4J_USER/NEO4J_PASSWORD - cannot attempt a real query."
} elseif (-not $cypherShell -or -not (Test-Path $cypherShell)) {
    Add-Check "answers RETURN 1" $false "cypher-shell not found (NEO4J_HOME=$neo4jHome) - Neo4j is not installed here."
} else {
    $result = & $cypherShell -a "127.0.0.1:$BoltPort" -u $Neo4jUser -p $Neo4jPassword "RETURN 1 AS ok;" 2>&1
    $ok = ($LASTEXITCODE -eq 0) -and ($result -match '\bok\b') -and ($result -match '\b1\b')
    Add-Check "answers RETURN 1" $ok "exit=$LASTEXITCODE output=$($result -join ' | ')"
}

# --- 5. Version match ----------------------------------------------------------------------------
$neo4jCli = if ($neo4jHome) { Join-Path $neo4jHome "bin\neo4j.ps1" } else { $null }
if (-not $neo4jCli -or -not (Test-Path $neo4jCli)) {
    Add-Check "version matches $ExpectedVersion" $false "neo4j CLI not found (NEO4J_HOME=$neo4jHome) - cannot check version."
} else {
    $verOut = (& $neo4jCli version 2>&1 | Out-String)
    $ok = $verOut -match [regex]::Escape($ExpectedVersion)
    Add-Check "version matches $ExpectedVersion" $ok "reported: $($verOut.Trim())"
}

# --- Report -----------------------------------------------------------------------------------------
Write-Host ""
foreach ($c in $checks) {
    $mark = if ($c.Passed) { "[PASS]" } else { "[FAIL]" }
    $color = if ($c.Passed) { "Green" } else { "Red" }
    Write-Host "$mark $($c.Name) - $($c.Detail)" -ForegroundColor $color
}
Write-Host ""
if ($failures.Count -gt 0) {
    Write-Host "VERIFY FAILED: $($failures.Count) check(s) did not pass: $($failures -join '; ')" -ForegroundColor Red
    exit 1
}
Write-Host "VERIFY PASSED: all checks green." -ForegroundColor Green
exit 0
