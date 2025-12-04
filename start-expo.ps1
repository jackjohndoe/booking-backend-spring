# Expo Start Script - Handles temp file watcher errors
Write-Host "Starting Expo Development Server..." -ForegroundColor Green

# Set environment variables to prevent temp file watching issues
$env:EXPO_NO_METRO_LAZY = "1"
$env:CI = "false"
$env:WATCHMAN_DISABLE_FILE_WATCHING = "false"

# Clear Expo cache
Write-Host "Clearing cache..." -ForegroundColor Yellow
Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue

# Start Expo with error handling
try {
    Write-Host "Starting server..." -ForegroundColor Green
    npx expo start --clear
} catch {
    Write-Host "Error occurred: $_" -ForegroundColor Red
    Write-Host "Trying alternative method..." -ForegroundColor Yellow
    npx expo start --clear --no-dev
}

