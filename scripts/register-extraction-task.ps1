# Registers the extraction task so it recovers from an UNATTENDED reboot. Must run elevated: a
# startup trigger is machine-level and Task Scheduler answers "Access is denied" without it.
#
# THE PRINCIPAL IS THE WHOLE LESSON HERE, and it was got wrong once before it was measured.
# Running as SYSTEM looks like the obvious choice for a boot job and is unusable: a probe from a
# real SYSTEM task returned `WSL_E_LOCAL_SYSTEM_NOT_SUPPORTED` — WSL refuses to run as local system
# at all — so the script could never start the Docker daemon, and therefore never Neo4j. The same
# probe found `ollama` unresolvable, because it is installed under the user profile.
#
# S4U is the shape that satisfies both halves: the task runs as the REAL user account, so WSL and
# the user-profile PATH work, but needs no stored password and no interactive session, so a reboot
# with nobody signed in still starts it. Measured, not assumed: an S4U probe reported
# `whoami: dudi-pc\dudib`, `wsl -l -q: Ubuntu-20.04`, `docker: 28.1.1`, ollama resolvable.
$repo = Split-Path -Parent $PSScriptRoot
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$repo\scripts\run-extraction.ps1`"" -WorkingDirectory $repo
# Both triggers. At-startup is the one that matters (the machine restarted itself unattended once
# already, System event 1074); at-logon is belt and braces. run-extraction.ps1 waits for postgres
# and resumes with --pending, and the task's default IgnoreNew policy stops a second instance.
$triggers = @( (New-ScheduledTaskTrigger -AtStartup), (New-ScheduledTaskTrigger -AtLogOn) )
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest
Register-ScheduledTask -TaskName "MatkonetGenizaExtraction" -Action $action -Trigger $triggers `
  -Settings $settings -Principal $principal -Force `
  -Description "Resumes geniza relationship extraction at boot AND at logon, as the user via S4U (SYSTEM cannot use WSL). Brings up docker+postgres+ollama and waits for them." | Out-Null
Write-Output "registered: at-startup + at-logon, S4U as $env:USERDOMAIN\$env:USERNAME"
