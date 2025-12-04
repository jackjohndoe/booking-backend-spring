# Open Expo QR Code in New PowerShell Window
Write-Host "Opening Expo development server in new PowerShell window..." -ForegroundColor Green
Write-Host "The QR code will appear in the new window." -ForegroundColor Yellow
Write-Host ""

# Get the current directory
$projectPath = $PSScriptRoot
if (-not $projectPath) {
    $projectPath = Get-Location
}

# Open new PowerShell window and run expo start
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectPath'; Write-Host '========================================' -ForegroundColor Cyan; Write-Host '  EXPO DEVELOPMENT SERVER' -ForegroundColor Green; Write-Host '========================================' -ForegroundColor Cyan; Write-Host ''; Write-Host 'Starting Expo server...' -ForegroundColor Yellow; Write-Host 'QR code will appear below:' -ForegroundColor Green; Write-Host ''; `$env:EXPO_NO_METRO_LAZY = '1'; `$env:CI = 'false'; npm start"

Write-Host "A new PowerShell window should have opened." -ForegroundColor Green
Write-Host "Look for the QR code in that window!" -ForegroundColor Cyan



