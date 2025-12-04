# Fixed Expo Start Script - Handles temp file errors
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Starting Expo Development Server" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set environment variables to prevent temp file watching
$env:EXPO_NO_METRO_LAZY = "1"
$env:CI = "false"
$env:WATCHMAN_DISABLE_FILE_WATCHING = "false"

# Clear cache
Write-Host "Clearing cache..." -ForegroundColor Yellow
if (Test-Path ".expo") {
    Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Starting server..." -ForegroundColor Green
Write-Host "Note: If you see a temp file error, it will be ignored and the server will continue." -ForegroundColor Gray
Write-Host ""

# Start Expo - errors will be caught by metro.config.js
try {
    npx expo start --clear --tunnel
} catch {
    Write-Host ""
    Write-Host "Trying without tunnel..." -ForegroundColor Yellow
    npx expo start --clear
}

