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
Write-Step "Checking install directory under $InstallRoot"
# 2026-08-07: this used to test a HARDCODED "$InstallRoot\neo4j-$Version" and then refuse after
# extraction when that path did not appear. It did not appear, because the archive's own folder is
# "neo4j-community-<version>". The script was right to refuse rather than continue on a guess — but
# the guess should never have been there. The name is now DERIVED from what is actually on disk,
# after extraction, which is the same rule this whole arc keeps arriving at: read the artefact,
# do not pin a string that describes it.
$existing = @(Get-ChildItem -Path $InstallRoot -Directory -Filter "neo4j-*$Neo4jVersion*" -ErrorAction SilentlyContinue)
if ($existing.Count -gt 1) {
    Write-Refuse "$InstallRoot holds more than one neo4j-*$Neo4jVersion* directory: $($existing.Name -join ', '). Remove the ones you do not want and re-run."
}
if ($existing.Count -eq 1 -and (Test-Path (Join-Path $existing[0].FullName "bin\neo4j.ps1"))) {
    # RESUMABLE: a previous run got as far as extracting. Re-downloading 246 MB and re-extracting
    # to reach the same bytes is waste, so reuse it and say so loudly rather than silently.
    $Neo4jHome = $existing[0].FullName
    $script:AlreadyExtracted = $true
    Write-Host "  found an existing extraction at $Neo4jHome - reusing it, skipping download and extract."
    Write-Host "  (if you want a clean install instead, delete that directory and re-run.)"
}
elseif ($existing.Count -eq 1) {
    Write-Refuse "$($existing[0].FullName) exists but has no bin\neo4j.ps1 - it is a partial or foreign directory. Remove it after confirming it holds nothing you need, then re-run."
}

# --- 5. JDK: find it wherever it actually is, not only on PATH ------------------------------------
#
# 2026-08-07, second refusal. The first version asked ONE question — "is `java` on PATH?" — and the
# honest answer was no, while a perfectly good JDK sat at
# C:\Program Files\Eclipse Adoptium\jdk-25.0.4.7-hotspot. Temurin's MSI does not add itself to PATH
# or set JAVA_HOME unless those features are selected, so the script installed a JDK, could not see
# the JDK it had just installed, asked winget to install it again, and winget replied "already
# installed, no upgrade available" with a non-zero exit — which the script read as a failed install.
# Three wrong conclusions from one narrow probe.
#
# Now: look where a JDK can actually be (JAVA_HOME, PATH, then the standard vendor directories), and
# treat winget's "nothing to upgrade" as the success it is. And because Neo4j's service needs to find
# Java without a shell, JAVA_HOME is SET machine-wide here rather than assumed.
function Find-Jdk {
    $candidates = @()
    if ($env:JAVA_HOME) { $candidates += (Join-Path $env:JAVA_HOME "bin\java.exe") }
    $onPath = Get-Command java -ErrorAction SilentlyContinue
    if ($onPath) { $candidates += $onPath.Source }
    foreach ($root in @("C:\Program Files\Eclipse Adoptium", "C:\Program Files\Java", "C:\Program Files\Zulu")) {
        if (Test-Path $root) {
            $candidates += (Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
                            ForEach-Object { Join-Path $_.FullName "bin\java.exe" })
        }
    }
    foreach ($c in ($candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique)) {
        $v = (& $c -version 2>&1 | Out-String)
        if ($v -match '"(21|25)[.\"]') {
            return [pscustomobject]@{ Exe = $c; Home = (Split-Path (Split-Path $c -Parent) -Parent); Version = $v.Trim() }
        }
    }
    return $null
}

Write-Step "Checking for a usable JDK (21 or 25)"
$jdk = Find-Jdk
if (-not $jdk) {
    Write-Host "  none found on PATH, in JAVA_HOME, or under the standard vendor directories."
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $winget) {
        Write-Refuse "no JDK found and winget is not available to install one. Install a JDK 21 or 25 manually (Neo4j 2026.06.0 on Windows: OracleJDK or ZuluJDK per docs/vendor/neo4j/03-install-requirements.md) and re-run."
    }
    Write-Host "  THIS IS A ONE-SHOT, NON-IDEMPOTENT ACTION: installing Eclipse Temurin JDK 25 via winget (matches the container's measured Temurin OpenJDK 25.0.3; see the NOTES header of this script for the vendor-support caveat)."
    & winget install --id EclipseAdoptium.Temurin.25.JDK --silent --accept-package-agreements --accept-source-agreements
    $wingetExit = $LASTEXITCODE
    # -1978335189 = APPINSTALLER_CLI_ERROR_UPDATE_NOT_APPLICABLE: "already installed, nothing newer".
    # That is not a failure; it means the thing we wanted is already here. Re-look either way, and
    # let the search — not winget's exit code — decide whether we have a JDK.
    $jdk = Find-Jdk
    if (-not $jdk) {
        Write-Refuse "winget finished with exit $wingetExit and no usable JDK 21/25 can be found afterwards. Install one manually and re-run."
    }
}
Write-Host "  using: $($jdk.Exe)"
Write-Host (($jdk.Version -split "`n" | ForEach-Object { "  $_" }) -join "`n")

# Neo4j's Windows service resolves Java through JAVA_HOME. It is empty on this machine even with a
# JDK installed, so set it — machine-wide for the service, and in-session so the rest of this script
# can call neo4j-admin without a new shell.
if ($env:JAVA_HOME -ne $jdk.Home) {
    Write-Host "  setting JAVA_HOME (machine) = $($jdk.Home)"
    [System.Environment]::SetEnvironmentVariable("JAVA_HOME", $jdk.Home, "Machine")
    $env:JAVA_HOME = $jdk.Home
}
$env:Path = "$($jdk.Home)\bin;$env:Path"

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
if ($script:AlreadyExtracted) {
    Write-Step "Skipping extract - reusing $Neo4jHome from an earlier run"
} else {
    Write-Step "Extracting to $InstallRoot"
    New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
    Expand-Archive -Path $ZipPath -DestinationPath $InstallRoot -Force

    # DERIVE the home directory from what the archive actually produced. The first version of this
    # script asserted "$InstallRoot\neo4j-$Version" and refused when it did not appear — the archive
    # unpacks to "neo4j-community-<version>". Refusing was right; assuming was not. Find the
    # directory that contains bin\neo4j.ps1 and require exactly one, so a surprise cannot pass either.
    $unpacked = @(Get-ChildItem -Path $InstallRoot -Directory -ErrorAction SilentlyContinue |
                  Where-Object { Test-Path (Join-Path $_.FullName "bin\neo4j.ps1") })
    if ($unpacked.Count -ne 1) {
        Write-Refuse "expected exactly one unpacked Neo4j directory under $InstallRoot (a directory containing bin\neo4j.ps1); found $($unpacked.Count): $($unpacked.Name -join ', '). Inspect $InstallRoot manually."
    }
    $Neo4jHome = $unpacked[0].FullName
}
Write-Host "  NEO4J_HOME = $Neo4jHome"

# --- 8. Persist NEO4J_HOME (machine-wide) -----------------------------------------------------------
Write-Step "Setting NEO4J_HOME (machine environment variable)"
[System.Environment]::SetEnvironmentVariable("NEO4J_HOME", $Neo4jHome, "Machine")
$env:NEO4J_HOME = $Neo4jHome

# --- 9. Loopback-only listen addresses + ports matching infra/.env -----------------------------------
Write-Step "Configuring loopback-only listen addresses (A6 gate requirement)"
$confPath = Join-Path $Neo4jHome "conf\neo4j.conf"

# 2026-08-07, third refusal — and the most instructive one. This block used to APPEND its settings to
# neo4j.conf. Four of them are already declared in the shipped file, so appending produced
# `server.https.enabled declared multiple times.` and neo4j-admin refused to read its own config.
# Appending to a key-value file is only safe when you know the key is absent, and here nobody
# checked. It also meant a second run would append a second copy, so the fix had to make re-running
# safe as well, not merely make one run work.
#
# Now: strip any previous block this script wrote (sentinel-delimited), comment out every existing
# uncommented declaration of the keys we set, and write our block once. Re-runnable, and it never
# leaves a duplicate behind.
$MARK_BEGIN = "# --- BEGIN install-neo4j-native.ps1 overrides ---"
$MARK_END   = "# --- END install-neo4j-native.ps1 overrides ---"

$settings = [ordered]@{
    "server.default_listen_address"    = "127.0.0.1"
    "server.bolt.listen_address"       = "127.0.0.1:$BoltPort"
    "server.http.listen_address"       = "127.0.0.1:$HttpPort"
    "server.https.enabled"             = "false"
    "server.memory.heap.initial_size"  = "512m"
    "server.memory.heap.max_size"      = "2G"
    "server.memory.pagecache.size"     = "1G"
}

$lines = @(Get-Content -Path $confPath)

# 1. drop any block a previous run of this script wrote
$out = New-Object System.Collections.Generic.List[string]
$inBlock = $false
foreach ($l in $lines) {
    if ($l -eq $MARK_BEGIN) { $inBlock = $true; continue }
    if ($l -eq $MARK_END)   { $inBlock = $false; continue }
    if (-not $inBlock) { $out.Add($l) }
}

# 2. comment out any surviving declaration of a key we are about to set, so ours is the only one
$commented = 0
for ($i = 0; $i -lt $out.Count; $i++) {
    $line = $out[$i]
    if ($line -match '^\s*#') { continue }
    if ($line -notmatch '^\s*([A-Za-z0-9_.]+)\s*=') { continue }
    $key = $Matches[1]
    if ($settings.Contains($key)) {
        $out[$i] = "# (superseded by install-neo4j-native.ps1) $line"
        $commented++
    }
}

# 3. write our block exactly once
$block = New-Object System.Collections.Generic.List[string]
$block.Add("")
$block.Add($MARK_BEGIN)
$block.Add("# A6 requires that nothing listens beyond loopback. Ports come from infra/.env so")
$block.Add("# src/knowledge/config.py needs no change between the container and this native install.")
$block.Add("# Memory bounds carried over from infra/compose.yaml rather than left unbounded.")
foreach ($k in $settings.Keys) { $block.Add("$k=$($settings[$k])") }
$block.Add($MARK_END)

Set-Content -Path $confPath -Value ($out + $block) -Encoding UTF8
Write-Host "  wrote $($settings.Count) setting(s) to $confPath; commented out $commented pre-existing declaration(s) of those keys."

# Prove it rather than assume it: no key we set may appear more than once uncommented.
$dupes = Get-Content $confPath |
         Where-Object { $_ -notmatch '^\s*#' -and $_ -match '^\s*([A-Za-z0-9_.]+)\s*=' } |
         ForEach-Object { ($_ -split '=')[0].Trim() } |
         Where-Object { $settings.Contains($_) } |
         Group-Object | Where-Object { $_.Count -gt 1 }
if ($dupes) {
    Write-Refuse "after rewriting, these keys are still declared more than once: $(($dupes | ForEach-Object { "$($_.Name) x$($_.Count)" }) -join ', '). Inspect $confPath."
}
Write-Host "  verified: no duplicate declaration of any key this script sets."

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
