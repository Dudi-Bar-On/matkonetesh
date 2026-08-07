<#
.SYNOPSIS
    Installs Neo4j 2026.06.0 Community as a native Windows service, loopback-only.

.DESCRIPTION
    Task 2 of the Docker-exit arc (docs/infra/neo4j-native-install-2026-08-07.md). This is a
    REPACKAGING of the version the mk-neo4j container already runs, not an upgrade — the version
    match matters because Task 3's `neo4j-admin database load` must accept a dump made against the
    same store format (docs/vendor/neo4j/18-store-formats.md).

    MUST be run from an ELEVATED PowerShell prompt (Windows service registration requires it —
    Register-ScheduledTask/service install returned "Access is denied" for the unprivileged agent
    that prepared this script).

    Reads NEO4J_USER / NEO4J_PASSWORD / NEO4J_BOLT_PORT / NEO4J_HTTP_PORT from infra\.env. The
    password already lives there (it is the same credential the container uses; config.py reads
    the same variable name regardless of which backend is running) — this script never generates
    a new one, never prints it, and never writes it anywhere else.

    Checks before it acts, and refuses rather than damage:
      - must be elevated
      - a "neo4j" Windows service must not already exist
      - the configured bolt/http ports must not already be listening (the mk-neo4j container is
        very likely holding them right now — stop it first: `docker stop mk-neo4j`)
      - the install directory must not already exist
    Any of these -> the script exits 1 with the exact remedy, and touches nothing.

    NOT idempotent past those checks: downloading, extracting, installing the service and setting
    the initial password are each one-shot operations. The script says so before doing them.

    Leaves the database EMPTY. That is the correct, expected state after this script — the data
    arrives in Task 3 via `neo4j-admin database load`. Starting the service here is how the script
    proves the install works; an empty graph on a freshly-started service is success, not failure.

.NOTES
    Facts sourced from docs/vendor/neo4j/ (Neo4j 2026.06.0 docs-operations corpus, ingested
    2026-08-07): 02-install-windows.md (service install steps), 03-install-requirements.md (JDK
    requirement table), 05-file-locations.md (NEO4J_HOME/conf/data layout), 23-ports.md and
    27-configuration-settings-02.md (listen-address settings), 24-set-initial-password.md
    (neo4j-admin dbms set-initial-password syntax).

    GAP IN THE CORPUS: docs-operations gives no scriptable download URL — "Neo4j Deployment
    Center" is a dynamic web page, not a stable link, and neo4j.com returned HTTP 403 to an
    automated fetch in an earlier session (see docs/vendor/neo4j/README.md). The
    `dist.neo4j.org/neo4j-community-<version>-windows.zip` path used below is Neo4j's own
    long-standing artifact host, confirmed reachable for this exact file (HTTP fetch returned a
    body >10MB, i.e. a real archive, not a 404 page) but it is NOT documented in 02-install-windows.md
    itself. 02-install-windows.md is the file that should carry a stable download URL and doesn't.

    GAP / JUDGEMENT CALL ON THE JDK VENDOR: 03-install-requirements.md's Windows software-
    requirements table lists only OracleJDK and ZuluJDK for Windows (Temurin is listed for
    Debian/macOS, not Windows). The container's measured JDK is Temurin OpenJDK 25.0.3. This
    script installs Temurin 25 (via winget, latest 25.x patch) to match the container's vendor and
    major version — patch-level need not match — but that choice is not itself blessed by the
    Windows support table in the corpus. Flagged here rather than silently picked.
#>

[CmdletBinding()]
param(
    [string]$Neo4jVersion = "2026.06.0",
    [string]$InstallRoot = "C:\neo4j",
    [string]$DownloadDir = "$env:TEMP\neo4j-native-install"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $RepoRoot "infra\.env"
$Neo4jHome = Join-Path $InstallRoot "neo4j-$Neo4jVersion"
$ZipUrl = "https://dist.neo4j.org/neo4j-community-$Neo4jVersion-windows.zip"
$ZipPath = Join-Path $DownloadDir "neo4j-community-$Neo4jVersion-windows.zip"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Refuse($msg) {
    Write-Host "`nREFUSING: $msg" -ForegroundColor Red
    exit 1
}

# --- 0. Elevation ------------------------------------------------------------------------------
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Refuse "this script must be run from an ELEVATED PowerShell prompt (right-click -> Run as Administrator)."
}

# --- 1. Load infra/.env (never printed) ---------------------------------------------------------
Write-Step "Reading infra\.env"
if (-not (Test-Path $EnvFile)) {
    Write-Refuse "infra\.env not found at $EnvFile. It must exist (the container already uses it)."
}
$envVars = @{}
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
        $envVars[$matches[1]] = $matches[2]
    }
}
foreach ($k in @("NEO4J_USER", "NEO4J_PASSWORD", "NEO4J_BOLT_PORT", "NEO4J_HTTP_PORT")) {
    if (-not $envVars.ContainsKey($k) -or [string]::IsNullOrWhiteSpace($envVars[$k])) {
        Write-Refuse "infra\.env is missing $k."
    }
}
$Neo4jUser = $envVars["NEO4J_USER"]
$Neo4jPassword = $envVars["NEO4J_PASSWORD"]
$BoltPort = $envVars["NEO4J_BOLT_PORT"]
$HttpPort = $envVars["NEO4J_HTTP_PORT"]
if ($Neo4jPassword.StartsWith("-")) {
    # L53 (docs/process/development-discipline.md): a leading "-" parses as a flag to
    # neo4j-admin. infra/.env's own header says passwords are generated without one, but check
    # the live value rather than trust the comment.
    Write-Refuse "NEO4J_PASSWORD in infra\.env begins with '-', which neo4j-admin will parse as a flag (L53). Regenerate it without a leading '-' before running this script."
}
Write-Host "  NEO4J_USER=$Neo4jUser  NEO4J_BOLT_PORT=$BoltPort  NEO4J_HTTP_PORT=$HttpPort (password read, not shown)"

# --- 2. Refuse if a neo4j service already exists -------------------------------------------------
Write-Step "Checking for an existing Neo4j Windows service"
$existingService = Get-Service -Name "neo4j" -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Refuse "a Windows service named 'neo4j' already exists (Status: $($existingService.Status)). Uninstall it first with '<NEO4J_HOME>\bin\neo4j windows-service uninstall' if this is meant to be a clean reinstall, or run scripts\verify-neo4j-native.ps1 if it may already be correctly installed."
}

# --- 3. Refuse if the configured ports are already taken ------------------------------------------
Write-Step "Checking ports $BoltPort (bolt) and $HttpPort (http) are free"
foreach ($p in @($BoltPort, $HttpPort)) {
    $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Refuse "port $p is already listening (likely the mk-neo4j container). Stop it first: 'docker stop mk-neo4j'. This script does not touch the container."
    }
}

# --- 4. Refuse if the install directory already exists --------------------------------------------
Write-Step "Checking install directory $Neo4jHome"
if (Test-Path $Neo4jHome) {
    Write-Refuse "$Neo4jHome already exists. Remove it manually after confirming it holds nothing you need, then re-run."
}

# --- 5. JDK: check what's already here before installing anything ---------------------------------
Write-Step "Checking for an existing JDK"
$javaCmd = Get-Command java -ErrorAction SilentlyContinue
$haveUsableJdk = $false
if ($javaCmd) {
    $verOut = (& java -version 2>&1 | Out-String)
    Write-Host "  found on PATH: $($javaCmd.Source)"
    $verIndented = ($verOut.Trim() -split "`n" | ForEach-Object { "  $_" }) -join "`n"
    Write-Host $verIndented
    if ($verOut -match '"(21|25)\.') { $haveUsableJdk = $true }
}
if (-not $haveUsableJdk) {
    Write-Host "  no usable JDK (21 or 25) found on PATH."
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $winget) {
        Write-Refuse "no JDK found and winget is not available to install one. Install a JDK 21 or 25 manually (Neo4j 2026.06.0 on Windows: OracleJDK or ZuluJDK per docs/vendor/neo4j/03-install-requirements.md) and re-run."
    }
    Write-Host "  THIS IS A ONE-SHOT, NON-IDEMPOTENT ACTION: installing Eclipse Temurin JDK 25 via winget (matches the container's measured Temurin OpenJDK 25.0.3; see the NOTES header of this script for the vendor-support caveat)."
    & winget install --id EclipseAdoptium.Temurin.25.JDK --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Refuse "winget install of the JDK failed (exit $LASTEXITCODE). Install a JDK 21 or 25 manually and re-run."
    }
    # Refresh PATH in this session from the machine + user environment so `java` resolves without
    # a new shell.
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    $javaCmd = Get-Command java -ErrorAction SilentlyContinue
    if (-not $javaCmd) {
        Write-Refuse "JDK install reported success but 'java' still does not resolve on PATH. Open a new elevated shell and re-run."
    }
    Write-Host "  installed: $($javaCmd.Source)"
}

# --- 6. Download the Neo4j Community zip (skip if already staged) ---------------------------------
Write-Step "Fetching Neo4j $Neo4jVersion Community (Windows zip)"
New-Item -ItemType Directory -Force -Path $DownloadDir | Out-Null
if (Test-Path $ZipPath) {
    Write-Host "  already staged at $ZipPath (re-using; delete it to force a fresh download)."
} else {
    Write-Host "  THIS IS A ONE-SHOT NETWORK FETCH: $ZipUrl"
    Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipPath -UseBasicParsing
}
$zipSizeMb = [math]::Round((Get-Item $ZipPath).Length / 1MB, 1)
if ($zipSizeMb -lt 50) {
    Write-Refuse "downloaded file is only $zipSizeMb MB - too small to be the real archive (got an error page instead of the zip?). Inspect $ZipPath, delete it, and re-run."
}
Write-Host "  staged: $ZipPath ($zipSizeMb MB)"

# --- 7. Extract ------------------------------------------------------------------------------------
Write-Step "Extracting to $InstallRoot"
New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $InstallRoot -Force
if (-not (Test-Path $Neo4jHome)) {
    Write-Refuse "expected $Neo4jHome to exist after extraction but it does not - the archive's internal folder name did not match. Check $InstallRoot manually."
}
Write-Host "  NEO4J_HOME = $Neo4jHome"

# --- 8. Persist NEO4J_HOME (machine-wide) -----------------------------------------------------------
Write-Step "Setting NEO4J_HOME (machine environment variable)"
[System.Environment]::SetEnvironmentVariable("NEO4J_HOME", $Neo4jHome, "Machine")
$env:NEO4J_HOME = $Neo4jHome

# --- 9. Loopback-only listen addresses + ports matching infra/.env -----------------------------------
Write-Step "Configuring loopback-only listen addresses (A6 gate requirement)"
$confPath = Join-Path $Neo4jHome "conf\neo4j.conf"
$overrides = @"

# --- Added by scripts/install-neo4j-native.ps1 ($(Get-Date -Format s)) ---
# A6 acceptance test requires nothing listen beyond loopback. Ports match infra/.env so
# src/knowledge/config.py needs no changes between the container and this native install.
server.default_listen_address=127.0.0.1
server.bolt.listen_address=127.0.0.1:$BoltPort
server.http.listen_address=127.0.0.1:$HttpPort
server.https.enabled=false
# Same bounds infra/compose.yaml already applies to the container, carried over rather than
# left unbounded on a native install.
server.memory.heap.initial_size=512m
server.memory.heap.max_size=2G
server.memory.pagecache.size=1G
"@
Add-Content -Path $confPath -Value $overrides
Write-Host "  appended loopback + memory-bound overrides to $confPath"

# --- 10. Set the initial password (one-shot, before first start) -------------------------------------
Write-Step "Setting the initial password for user '$Neo4jUser'"
Write-Host "  THIS IS A ONE-SHOT ACTION: neo4j-admin dbms set-initial-password is only valid before first startup."
if ($Neo4jUser -ne "neo4j") {
    Write-Refuse "infra\.env has NEO4J_USER=$Neo4jUser, but Neo4j's native auth only has a single built-in user, 'neo4j' (docs/vendor/neo4j/24-set-initial-password.md). This script will not silently rename anything - reconcile infra/.env or the plan before proceeding."
}
& "$Neo4jHome\bin\neo4j-admin.bat" dbms set-initial-password $Neo4jPassword
if ($LASTEXITCODE -ne 0) {
    Write-Refuse "neo4j-admin dbms set-initial-password failed (exit $LASTEXITCODE)."
}
Write-Host "  password set from infra\.env's NEO4J_PASSWORD (not shown, not written anywhere else)."

# --- 11. Install as a Windows service, automatic startup --------------------------------------------
Write-Step "Installing the Windows service"
& "$Neo4jHome\bin\neo4j.ps1" windows-service install
if ($LASTEXITCODE -ne 0) {
    Write-Refuse "'neo4j windows-service install' failed (exit $LASTEXITCODE)."
}
Set-Service -Name "neo4j" -StartupType Automatic
Write-Host "  service 'neo4j' installed, startup type set to Automatic."

# --- 12. Start it, and prove it (empty database is the expected state) -------------------------------
Write-Step "Starting the service"
Start-Service -Name "neo4j"
$deadline = (Get-Date).AddSeconds(90)
$up = $false
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 3
    $conn = Get-NetTCPConnection -LocalPort $BoltPort -State Listen -ErrorAction SilentlyContinue
    if ($conn) { $up = $true; break }
}
if (-not $up) {
    Write-Refuse "service did not start listening on bolt port $BoltPort within 90s. Check $Neo4jHome\logs\neo4j.log."
}
Write-Host "  service is up and listening on bolt port $BoltPort."
Write-Host "  THE DATABASE IS EMPTY. That is the expected, correct state right now - Task 3 loads the data via 'neo4j-admin database load'. This script's job ends at a running, empty, loopback-only service."

# --- 13. Summary the owner can paste back -------------------------------------------------------------
Write-Host "`n================ INSTALL SUMMARY (paste this back) ================" -ForegroundColor Green
Write-Host "Neo4j version installed : $Neo4jVersion Community"
Write-Host "NEO4J_HOME              : $Neo4jHome"
Write-Host "Service name            : neo4j (StartupType: Automatic, Status: $((Get-Service neo4j).Status))"
Write-Host "Bolt / HTTP ports       : $BoltPort / $HttpPort, listen address 127.0.0.1 only"
Write-Host "JDK used                : $((& java -version 2>&1 | Select-Object -First 1) -join ' ')"
Write-Host "Database state          : EMPTY (expected - Task 3 loads it)"
Write-Host "Next                    : run scripts\verify-neo4j-native.ps1 (no elevation needed)"
Write-Host "======================================================================" -ForegroundColor Green
