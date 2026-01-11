$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "Chronos.lnk"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (!$ScriptDir) { $ScriptDir = $PSScriptRoot }

$BatchFile = Join-Path $ScriptDir "Chronos.bat"

# Remove existing shortcut to ensure clean creation
if (Test-Path $ShortcutPath) { Remove-Item $ShortcutPath -Force }

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
# Targeting cmd.exe directly to avoid batch associations issues
$Shortcut.TargetPath = "cmd.exe"
$Shortcut.Arguments = "/c `"$BatchFile`""
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.Description = "Chronos Tactical Orchestrator Hub"

# Set a cool system icon (13 is the CPU/Chip icon in shell32.dll)
$Shortcut.IconLocation = "shell32.dll,12" # 12 is a terminal/monitor-like icon

$Shortcut.Save()

Write-Host "--- TACTICAL SHORTCUT ESTABLISHED ---"
Write-Host "Location: $ShortcutPath"
Write-Host "Target: cmd.exe /c $BatchFile"
Write-Host "Icon: Terminal Terminal established."
