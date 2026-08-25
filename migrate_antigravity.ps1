# Antigravity IDE - Migration Tool
# This script migrates your past conversations, database, and state files from:
#   %APPDATA%\Antigravity\User
# to:
#   %APPDATA%\Antigravity IDE\User
#
# It automatically handles active process checking, takes a backup of your target folder,
# performs a safe recursive migration, and restarts the IDE for you.

$ErrorActionPreference = "Stop"

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "         Antigravity IDE Database Migration Tool        " -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

$oldDir = "$env:APPDATA\Antigravity\User"
$newDir = "$env:APPDATA\Antigravity IDE\User"

# 1. Verify source directory exists
if (-not (Test-Path -Path $oldDir)) {
    Write-Host "[-] Source directory not found: $oldDir" -ForegroundColor Red
    Write-Host "[!] Make sure you have old Antigravity user data stored there." -ForegroundColor Yellow
    Exit
}

Write-Host "[+] Found old data directory: $oldDir" -ForegroundColor Green
Write-Host "[+] Target data directory:    $newDir" -ForegroundColor Green
Write-Host ""

# 2. Check for active Antigravity / Antigravity IDE processes
$ideExecutable = "C:\Users\Vishnukant\AppData\Local\Programs\Antigravity IDE\Antigravity IDE.exe"
$hasWarned = $false

while ($true) {
    $processes = Get-Process -Name "Antigravity", "Antigravity IDE" -ErrorAction SilentlyContinue
    if ($processes) {
        if (-not $hasWarned) {
            Write-Host "[!] Active Antigravity processes detected!" -ForegroundColor Yellow
            Write-Host "[!] The IDE must be closed to release database file locks before we can migrate." -ForegroundColor Yellow
            Write-Host "--> Please close all Antigravity and Antigravity IDE windows now." -ForegroundColor White
            $hasWarned = $true
        }
        Write-Host "Waiting for processes to exit: " -NoNewline
        $processNames = $processes | ForEach-Object { "$($_.Name) (PID: $($_.Id))" }
        Write-Host ($processNames -join ", ") -ForegroundColor Gray
        Start-Sleep -Seconds 3
    } else {
        if ($hasWarned) {
            Write-Host "[+] All processes closed successfully!" -ForegroundColor Green
        }
        break
    }
}

Write-Host ""
Write-Host "[+] Lock check passed. Proceeding with migration..." -ForegroundColor Cyan

# 3. Create Backup of Target Folder (if it exists and has files)
if (Test-Path -Path $newDir) {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = "$env:APPDATA\Antigravity IDE\User_Backup_$timestamp"
    Write-Host "[*] Creating backup of current target directory..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    Copy-Item -Path "$newDir\*" -Destination $backupDir -Recurse -Force
    Write-Host "[+] Target backup created successfully at: $backupDir" -ForegroundColor Green
}

# 4. Perform migration
Write-Host "[*] Migrating old state and database files..." -ForegroundColor Cyan

# Ensure the target directory exists
if (-not (Test-Path -Path $newDir)) {
    New-Item -ItemType Directory -Force -Path $newDir | Out-Null
}

# Copy files recursively
Copy-Item -Path "$oldDir\*" -Destination $newDir -Recurse -Force

Write-Host "[+] Migration completed successfully!" -ForegroundColor Green
Write-Host ""

# 5. Offer to restart Antigravity IDE
Write-Host "=========================================================" -ForegroundColor Green
Write-Host "                 MIGRATION SUCCESSFUL!                   " -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your past conversations, settings, snippets, and history have been migrated." -ForegroundColor White
Write-Host ""

$choices = [System.Management.Automation.Host.ChoiceDescription[]]@(
    (New-Object System.Management.Automation.Host.ChoiceDescription "&Yes", "Restart Antigravity IDE now"),
    (New-Object System.Management.Automation.Host.ChoiceDescription "&No", "Exit without restarting")
)

$decision = $Host.UI.PromptForChoice("Launch IDE", "Would you like to start Antigravity IDE now?", $choices, 0)

if ($decision -eq 0) {
    if (Test-Path -Path $ideExecutable) {
        Write-Host "[+] Launching Antigravity IDE..." -ForegroundColor Green
        Start-Process -FilePath $ideExecutable
    } else {
        Write-Host "[!] Could not find IDE executable at: $ideExecutable" -ForegroundColor Yellow
        Write-Host "[*] Please launch Antigravity IDE manually." -ForegroundColor White
    }
} else {
    Write-Host "[*] Finished. You can launch Antigravity IDE manually." -ForegroundColor White
}
