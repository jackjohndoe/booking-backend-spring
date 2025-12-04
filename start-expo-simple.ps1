# Simple Expo Start - No Tunnel (avoids temp file error)
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EXPO DEVELOPMENT SERVER" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting without tunnel mode..." -ForegroundColor Yellow
Write-Host "(This avoids the temp file error)" -ForegroundColor Gray
Write-Host ""

# Set environment variables
$env:EXPO_NO_METRO_LAZY = "1"
$env:CI = "false"

# Clear cache
Write-Host "Clearing cache..." -ForegroundColor Yellow
Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Starting server (QR code will appear shortly)..." -ForegroundColor Green
Write-Host ""

# Start without tunnel - this should avoid the error
npx expo start --clear

