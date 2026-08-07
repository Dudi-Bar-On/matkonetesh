<#
.SYNOPSIS
    Turn on continuous WAL archiving to G:, close R-111's freshness gap from "however long since
    someone last ran backup-stores.ps1 by hand" down to seconds. Run ONCE, elevated.

.DESCRIPTION
    ################################################################################################
    #  THIS SCRIPT RESTARTS THE postgresql-x64-18 WINDOWS SERVICE.                                 #
    #  archive_mode is a POSTMASTER-CONTEXT parameter - PostgreSQL only reads it at startup, a      #
    #  config reload (pg_ctl reload / SIGHUP) is NOT enough. There is no way to enable archiving    #
    #  without a restart, and this script performs that restart itself (elevated, like this         #
    #  script's whole run) rather than leaving a half-applied change and asking a human to guess    #
    #  when to bounce the service. The restart is preceded by a full config backup and followed by  #
    #  a live readback, so a bad edit is recoverable and a failed restart is visible immediately.   #
    ################################################################################################

    MEASURED 2026-08-07/08, and this is the state this script assumes and changes:

        archive_mode      = off        ->  on
        archive_command    = (disabled) ->  copies each WAL file to G:\pg-wal-archive
        archive_timeout    = 0          ->  300s (forces a segment switch every 5 min even when idle,
                                             so the archive gate has a fresh file to look at even on
                                             a quiet day - see check-backup-fresh.mjs's 20-minute
                                             lag threshold, 4x this timeout for jitter headroom)
        wal_level          = replica    ->  UNCHANGED. Already sufficient for archiving (the
                                             PostgreSQL docs requirement is wal_level >= replica);
                                             turning archiving on adds no WAL volume from a level
                                             change, because the level is not changing.
        max_wal_size       = 1GB        ->  UNCHANGED. Only bounds how much WAL a checkpoint may
                                             accumulate before triggering; not a retention setting
                                             and not touched by this script.

    WHY G: AND NOT F: (measured 2026-08-07): G: has 12,102 GB free - trivially large next to the
    measured ~1.1-1.5 GB/day this cluster generates (pg_stat_wal.wal_bytes since the last stats
    reset, sampled 2026-08-08). F: has 65.5 GB free and is a REMOVABLE drive meant to be detached
    most of the time (backup-stores.ps1's own header) - a continuous stream cannot target a drive
    that is routinely unplugged, so F: stays what it already is: a second, periodic, physical-media
    copy of the point-in-time dumps, not an archive destination.

    RETENTION, PLANNED HERE - NOT AFTER A FULL DISK STOPS POSTGRES (task-7-brief.md item 2). A
    failing archive_command halts WAL recycling until space frees, so an archive directory that
    fills is not a disk-space inconvenience, it is a PostgreSQL outage. At ~1.1-1.5 GB/day against
    12,102 GB free, filling G: this way would take decades - the real risk is not volume, it is an
    archive_command that starts failing silently and is never pruned regardless. Cleanup is handled
    by scripts/backup-stores.ps1 (time-based deletion of archived WAL older than -WalRetentionDays,
    default 14 - see that script's own header), not here: this script's job is turning archiving ON
    and PROVING it delivers files, not owning an ongoing retention loop that needs to keep running
    long after this script has exited.

    WHAT THIS DOES NOT DO: this delivers CONTINUOUS RECEIPT of WAL at G:\pg-wal-archive, closing the
    "how stale is the archive" question down to single-digit minutes (check-backup-fresh.mjs). It
    does NOT by itself give point-in-time RESTORE capability - replaying WAL forward requires a
    physical base backup (pg_basebackup) as the anchor, which this script does not take. Without
    one, a catastrophic loss of C: (where the live cluster lives) still only recovers to the last
    verified backup-stores.ps1 pg_dump, not "seconds ago" - see task-7-report.md for the full
    accounting of what is and is not covered.

    IDEMPOTENT: re-running with settings already applied leaves them unchanged and skips the
    restart (checked via a live SHOW readback before editing, not by assuming the file's contents).

    ROLLBACK: postgresql.conf is copied to postgresql.conf.bak-<timestamp> in the SAME data
    directory before any edit. To revert: stop the service, copy the .bak file back over
    postgresql.conf, start the service.
#>

[CmdletBinding()]
param(
    [string]$ServiceName          = 'postgresql-x64-18',
    [string]$ArchiveDest          = 'G:\pg-wal-archive',
    [int]   $ArchiveTimeoutSecs   = 300,
    [int]   $MinFreeGB            = 50,
    [int]   $VerifyTimeoutSecs    = 90,
    [string]$PgBin                = 'C:\Program Files\PostgreSQL\18\bin'
)

$ErrorActionPreference = 'Stop'
function Write-Step   { param($m) Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Refuse { param($m) Write-Host "`nREFUSING: $m" -ForegroundColor Yellow; exit 1 }
function Write-Warn2  { param($m) Write-Host "  ! $m" -ForegroundColor Yellow }

$RepoRoot = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { (Get-Location).Path }
$Stamp    = Get-Date -Format 'yyyyMMdd-HHmmss'

function Get-EnvValue {
    param($File, $Key)
    if (-not (Test-Path $File)) { return $null }
    $line = Get-Content $File | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -First 1
    if (-not $line) { return $null }
    return ($line -replace "^\s*$Key\s*=", '').Trim()
}

# ============================== Preflight - refuse rather than guess ==============================
Write-Step 'Preflight'

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Refuse 'this script must be run from an ELEVATED PowerShell prompt - it edits postgresql.conf and restarts the service.'
}

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc) { Write-Refuse "service '$ServiceName' not found." }
if ($svc.Status -ne 'Running') { Write-Refuse "service '$ServiceName' is not Running (status: $($svc.Status)) - start it first, this script does not." }

if (-not (Test-Path "$PgBin\psql.exe")) { Write-Refuse "psql.exe not found at $PgBin - pass -PgBin if PostgreSQL is installed elsewhere." }

$archiveDrive = Split-Path $ArchiveDest -Qualifier
if (-not (Test-Path $archiveDrive)) { Write-Refuse "archive destination drive $archiveDrive is not present." }
$freeGB = [math]::Round((Get-PSDrive ($archiveDrive.TrimEnd(':'))).Free / 1GB, 1)
if ($freeGB -lt $MinFreeGB) { Write-Refuse "only $freeGB GB free on $archiveDrive - refusing below the $MinFreeGB GB floor (measured daily volume is ~1.1-1.5 GB; this floor is a large multiple of that, not a tight fit)." }
Write-Host "  archive destination: $ArchiveDest  ($freeGB GB free on $archiveDrive)"

$env:PgSuperUser = Get-EnvValue (Join-Path $RepoRoot 'infra\.env') 'POSTGRES_SUPERUSER'
$env:PgSuperPass = Get-EnvValue (Join-Path $RepoRoot 'infra\.env') 'POSTGRES_SUPERUSER_PASSWORD'
$pgPort          = Get-EnvValue (Join-Path $RepoRoot 'infra\.env') 'POSTGRES_PORT'
$pgDb            = Get-EnvValue (Join-Path $RepoRoot 'infra\.env') 'POSTGRES_DB'
if (-not $env:PgSuperUser -or -not $env:PgSuperPass -or -not $pgPort -or -not $pgDb) {
    Write-Refuse 'infra\.env is missing POSTGRES_SUPERUSER / POSTGRES_SUPERUSER_PASSWORD / POSTGRES_PORT / POSTGRES_DB. Never printed; only their presence is checked.'
}

function Invoke-Psql {
    # Runs one -c command as the owner role. Password lives in PGPASSWORD only for the call's
    # lifetime, same discipline as backup-stores.ps1 and repair-hnsw-index.py: read at runtime,
    # used, never printed, never logged.
    param([string]$Sql, [switch]$Quiet)
    $env:PGPASSWORD = $env:PgSuperPass
    try {
        $out = & "$PgBin\psql.exe" -h 127.0.0.1 -p $pgPort -U $env:PgSuperUser -d $pgDb -Atc $Sql 2>&1
        $code = $LASTEXITCODE
    } finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
    if ($code -ne 0 -and -not $Quiet) { Write-Refuse "psql failed (exit $code) running: $Sql`n  $out" }
    return ($out -join "`n").Trim()
}

$dataDir    = Invoke-Psql 'SHOW data_directory'
$configFile = Invoke-Psql 'SHOW config_file'
if (-not (Test-Path $configFile)) { Write-Refuse "config_file reported by the server does not exist on disk: $configFile" }
Write-Host "  data_directory: $dataDir"
Write-Host "  config_file:    $configFile"

# ============================== Before - read live settings, not the file ==============================
Write-Step 'Before (live SHOW, not the file - the file can lie if a reload never happened)'
$before = @{
    archive_mode    = Invoke-Psql 'SHOW archive_mode'
    archive_command = Invoke-Psql 'SHOW archive_command'
    archive_timeout = Invoke-Psql 'SHOW archive_timeout'
    wal_level       = Invoke-Psql 'SHOW wal_level'
}
$before.GetEnumerator() | ForEach-Object { Write-Host "  $($_.Key) = $($_.Value)" }

if ($before.wal_level -notin @('replica', 'logical')) {
    Write-Refuse "wal_level is '$($before.wal_level)', which is below what archiving requires (replica or logical). This script does not raise wal_level itself - that is a separate, larger decision (measured 2026-08-07: it is ALREADY sufficient here, so this refusal should not fire on this machine)."
}

if ($before.archive_mode -eq 'on' -and $before.archive_command -match [regex]::Escape($ArchiveDest)) {
    Write-Host "`nAlready enabled and already pointing at $ArchiveDest - nothing to change, skipping straight to verification." -ForegroundColor Green
    $needsChange = $false
} else {
    $needsChange = $true
}

# ============================== Backup postgresql.conf BEFORE touching it ==============================
if ($needsChange) {
    Write-Step 'Backing up postgresql.conf before any edit'
    $backupPath = "$configFile.bak-$Stamp"
    Copy-Item $configFile $backupPath
    if (-not (Test-Path $backupPath) -or (Get-Item $backupPath).Length -ne (Get-Item $configFile).Length) {
        Write-Refuse "config backup did not verify (size mismatch or file missing): $backupPath"
    }
    Write-Host "  backed up to: $backupPath"
    # A second copy off the C: drive that holds the config being edited - the whole point of this
    # backup is to survive a mistake in THIS edit; a copy sitting next to the original does not
    # survive the same disk failure the WAL archive itself is meant to survive.
    New-Item -ItemType Directory -Force -Path (Join-Path (Split-Path $ArchiveDest -Parent) 'postgresql-conf-backups') | Out-Null
    Copy-Item $configFile (Join-Path (Split-Path $ArchiveDest -Parent) "postgresql-conf-backups\postgresql.conf.bak-$Stamp")
    Write-Host "  second copy: $(Split-Path $ArchiveDest -Parent)\postgresql-conf-backups\postgresql.conf.bak-$Stamp"

    Write-Step "Creating archive directory: $ArchiveDest"
    New-Item -ItemType Directory -Force -Path $ArchiveDest | Out-Null

    Write-Step 'Editing postgresql.conf'
    # postgresql.conf string values escape backslash, so a literal Windows path needs each \ doubled.
    # This is the PostgreSQL-documented Windows example verbatim (see the docs' own continuous-
    # archiving chapter): archive_command = 'copy "%p" "<dest>\\%f"'. Deliberately NOT a custom
    # PowerShell wrapper: a hand-rolled quoting scheme across postgresql.conf-escaping + cmd-escaping
    # could not be exercised end to end by whoever writes this (enabling it requires the very
    # restart this script performs, which only the owner runs) - and a broken archive_command is
    # exactly the failure this script must not risk. KNOWN LIMITATION, stated rather than hidden: if
    # `copy` is ever asked to overwrite an already-archived file (only possible after a prior partial
    # failure), Windows `copy` prompts for confirmation and will stall archiving until an operator
    # answers it. That is a real gap, not a hidden one - check-backup-fresh.mjs's lag check is what
    # surfaces a stall like that, and pg_stat_archiver.last_failed_wal / last_failed_time is where
    # to look first if it fires.
    $escapedDest = $ArchiveDest -replace '\\', '\\'
    # Built via concatenation, not interpolated escaping - a quote sequence dense enough to need
    # doubled-double-quotes inside doubled-double-quotes is exactly how this line broke the first
    # time (caught by the PowerShell parser before any live testing, since none is possible here).
    $sq = "'"; $dq = '"'
    $archiveCmdValue = $sq + 'copy ' + $dq + '%p' + $dq + ' ' + $dq + $escapedDest + '\\%f' + $dq + $sq
    $lines = Get-Content $configFile
    $keys  = @{
        'archive_mode'    = 'on'
        'archive_command' = $archiveCmdValue
        'archive_timeout' = "$ArchiveTimeoutSecs"
    }
    foreach ($key in $keys.Keys) {
        $value = $keys[$key]
        $pattern = "^\s*#?\s*$key\s*="
        $newLine = "$key = $value"
        $matched = $false
        $lines = $lines | ForEach-Object {
            if (-not $matched -and $_ -match $pattern) { $matched = $true; $newLine }
            else { $_ }
        }
        if (-not $matched) { $lines += $newLine }
        Write-Host "  set: $newLine"
    }
    Set-Content -Path $configFile -Value $lines -Encoding ASCII

    # ============================== Restart - the only way archive_mode takes effect ==============================
    Write-Step "Restarting $ServiceName (archive_mode is postmaster-context - no reload can apply it)"
    Restart-Service -Name $ServiceName -Force
    $deadline = (Get-Date).AddSeconds(60)
    do {
        Start-Sleep -Seconds 2
        $svc = Get-Service -Name $ServiceName
    } while ($svc.Status -ne 'Running' -and (Get-Date) -lt $deadline)
    if ($svc.Status -ne 'Running') {
        Write-Host "`nFAILED: $ServiceName did not reach Running within 60s (status: $($svc.Status))." -ForegroundColor Red
        Write-Host "ROLLBACK: Stop-Service $ServiceName; Copy-Item '$backupPath' '$configFile' -Force; Start-Service $ServiceName" -ForegroundColor Red
        exit 1
    }
    Write-Host "  $ServiceName is Running."
    # Give the postmaster a moment to finish accepting connections before psql hits it.
    Start-Sleep -Seconds 3
}

# ============================== After - live readback, never assumed ==============================
Write-Step 'After - live SHOW readback'
$after = @{
    archive_mode    = Invoke-Psql 'SHOW archive_mode'
    archive_command = Invoke-Psql 'SHOW archive_command'
    archive_timeout = Invoke-Psql 'SHOW archive_timeout'
}
$after.GetEnumerator() | ForEach-Object { Write-Host "  $($_.Key) = $($_.Value)" }

if ($after.archive_mode -ne 'on') {
    Write-Host "`nFAILED: archive_mode reads '$($after.archive_mode)' after restart, not 'on'." -ForegroundColor Red
    exit 1
}

# ============================== Verify - files actually arrive, not just a green exit code ==============================
Write-Step "Verifying WAL files actually arrive at $ArchiveDest (forcing segment switches)"
$before_pg_stat = Invoke-Psql "SELECT archived_count, coalesce(failed_count,0) FROM pg_stat_archiver" -Quiet
Write-Host "  pg_stat_archiver before: archived=$before_pg_stat"

Invoke-Psql 'SELECT pg_switch_wal()' | Out-Null
Start-Sleep -Seconds 2
Invoke-Psql 'SELECT pg_switch_wal()' | Out-Null  # a second, distinct switch - one alone can race the archiver

$deadline = (Get-Date).AddSeconds($VerifyTimeoutSecs)
$confirmed = $false
do {
    Start-Sleep -Seconds 3
    $stat = Invoke-Psql "SELECT archived_count, coalesce(failed_count,0), coalesce(last_archived_wal,''), coalesce(last_failed_wal,'')" -Quiet
    $parts = $stat -split '\|'
    $archivedCount = [int]$parts[0]
    $failedCount   = [int]$parts[1]
    $lastArchived  = $parts[2]
    $lastFailed    = $parts[3]
    $filesOnDisk = Get-ChildItem $ArchiveDest -File -ErrorAction SilentlyContinue
    if ($archivedCount -gt 0 -and $filesOnDisk.Count -gt 0 -and $lastArchived -and (Test-Path (Join-Path $ArchiveDest $lastArchived))) {
        $confirmed = $true
    }
    if ($failedCount -gt 0) {
        Write-Host "`nFAILED: pg_stat_archiver reports $failedCount failure(s), last_failed_wal=$lastFailed." -ForegroundColor Red
        Write-Host "  A failing archive_command STOPS WAL recycling until this is fixed. Check the PostgreSQL log." -ForegroundColor Red
        exit 1
    }
} while (-not $confirmed -and (Get-Date) -lt $deadline)

if (-not $confirmed) {
    Write-Host "`nFAILED: no archived WAL file confirmed present at $ArchiveDest within ${VerifyTimeoutSecs}s." -ForegroundColor Red
    Write-Host "  pg_stat_archiver: archived_count=$archivedCount failed_count=$failedCount last_archived_wal=$lastArchived" -ForegroundColor Red
    Write-Host "  This is a real failure state, not a formality - do not treat archive_mode=on as success without this confirming." -ForegroundColor Red
    exit 1
}

Write-Host "`n================ WAL ARCHIVING ENABLED AND VERIFIED ================" -ForegroundColor Green
Write-Host "  last archived WAL file: $lastArchived"
Write-Host "  confirmed on disk at:   $(Join-Path $ArchiveDest $lastArchived)"
Write-Host "  pg_stat_archiver.archived_count: $archivedCount, failed_count: $failedCount"
Write-Host ''
Write-Host '  NEXT: scripts\backup-stores.ps1 now also prunes archived WAL older than -WalRetentionDays'
Write-Host '        (default 14) on every run - that is the retention plan for this archive, from day one.'
Write-Host '  Freshness of this archive is checked on every commit/session by scripts\check-backup-fresh.mjs.'
Write-Host '======================================================================'
