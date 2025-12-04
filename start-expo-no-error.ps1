# Expo Start with Error Prevention
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EXPO DEVELOPMENT SERVER" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set environment variables
$env:EXPO_NO_METRO_LAZY = "1"
$env:CI = "false"
$env:EXPO_USE_FAST_RESOLVER = "1"

# Clear cache
Write-Host "Clearing cache..." -ForegroundColor Yellow
Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "Starting with error prevention..." -ForegroundColor Green
Write-Host ""

# Use the patched Metro config
try {
    node metro-patch.js
    npx expo start --clear
} catch {
    Write-Host "Starting with standard method..." -ForegroundColor Yellow
    npx expo start --clear
}
