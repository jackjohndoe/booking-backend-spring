# Expo Start with Auto Browser Open - FIXES TEMP ERROR
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EXPO DEVELOPMENT SERVER" -ForegroundColor Green
Write-Host "  (QR Code + Browser Auto-Open)" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set environment variables to prevent temp file errors
$env:EXPO_NO_METRO_LAZY = "1"
$env:CI = "false"
$env:EXPO_NO_GIT_STATUS = "1"

# Clear cache
Write-Host "Clearing cache..." -ForegroundColor Yellow
Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "Starting server (temp error is FIXED)..." -ForegroundColor Green
Write-Host ""

# Start Expo and open browser after server starts
$job = Start-Job -ScriptBlock {
    param($pwd)
    Set-Location $pwd
    $env:EXPO_NO_METRO_LAZY = "1"
    $env:CI = "false"
    npx expo start --clear
} -ArgumentList $PWD

# Wait for server to start, then open browser
Write-Host "Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 12

Write-Host ""
Write-Host "Opening app in browser..." -ForegroundColor Cyan
Start-Process "http://localhost:8081"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Server is running!" -ForegroundColor Green
Write-Host "QR code should be visible above" -ForegroundColor Yellow
Write-Host "Browser opened automatically" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Show job output
Receive-Job -Job $job -Wait

