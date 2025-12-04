# Safe Expo Start Script - Handles temp file errors
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Starting Expo Development Server" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set environment variables
$env:EXPO_NO_METRO_LAZY = "1"
$env:CI = "false"
$env:EXPO_USE_FAST_RESOLVER = "1"

# Clear cache
Write-Host "Clearing cache..." -ForegroundColor Yellow
if (Test-Path ".expo") {
    Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
}

# Error handler for temp file errors
$ErrorActionPreference = "Continue"

Write-Host "Starting server (this may take a moment)..." -ForegroundColor Green
Write-Host ""

# Start Expo with error handling
try {
    # Try with tunnel first (more reliable for QR codes)
    Write-Host "Starting with tunnel mode..." -ForegroundColor Cyan
    npx expo start --clear --tunnel
} catch {
    Write-Host ""
    Write-Host "Tunnel mode failed, trying standard mode..." -ForegroundColor Yellow
    try {
        npx expo start --clear
    } catch {
        Write-Host ""
        Write-Host "Standard mode failed, trying with wrapper..." -ForegroundColor Yellow
        node expo-start-wrapper.js start --clear
    }
}

Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray

