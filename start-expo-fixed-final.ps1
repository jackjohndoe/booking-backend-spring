# Final Fix - Prevents temp file error completely
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EXPO DEVELOPMENT SERVER" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set all environment variables to prevent file watching issues
$env:EXPO_NO_METRO_LAZY = "1"
$env:CI = "false"
$env:EXPO_NO_GIT_STATUS = "1"
$env:EXPO_USE_FAST_RESOLVER = "1"
$env:WATCHMAN_DISABLE_FILE_WATCHING = "false"

# Set project root explicitly
$env:EXPO_PROJECT_ROOT = $PWD

# Clear cache
Write-Host "Clearing cache..." -ForegroundColor Yellow
Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "Starting server..." -ForegroundColor Green
Write-Host ""

# Change to project directory
Set-Location $PWD

# Start Expo - the error will be caught by metro.config.js
npx expo start --clear

