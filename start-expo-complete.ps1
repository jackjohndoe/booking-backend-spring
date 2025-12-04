# Complete Expo Start - Fixes temp error AND opens browser
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EXPO DEVELOPMENT SERVER" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set environment variables
$env:EXPO_NO_METRO_LAZY = "1"
$env:CI = "false"
$env:EXPO_NO_GIT_STATUS = "1"

# Clear cache
Write-Host "Clearing cache..." -ForegroundColor Yellow
Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "Starting server..." -ForegroundColor Green
Write-Host "QR code will appear and browser will open automatically" -ForegroundColor Cyan
Write-Host ""

# Start Expo and open browser after delay
$job = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    $env:EXPO_NO_METRO_LAZY = "1"
    $env:CI = "false"
    npx expo start --clear --web
}

# Wait a bit then open browser
Start-Sleep -Seconds 8
Write-Host "Opening app in browser..." -ForegroundColor Yellow
Start-Process "http://localhost:8081"

# Show job output
Receive-Job -Job $job -Wait

