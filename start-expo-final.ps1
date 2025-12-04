# Final Expo Start Script - Prevents temp file watching
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EXPO DEVELOPMENT SERVER" -ForegroundColor Green  
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set environment variables to prevent temp file watching
$env:EXPO_NO_METRO_LAZY = "1"
$env:CI = "false"
$env:EXPO_USE_FAST_RESOLVER = "1"
$env:WATCHMAN_DISABLE_FILE_WATCHING = "false"

# Set project directory explicitly
$env:EXPO_PROJECT_ROOT = $PWD

# Clear cache
Write-Host "Clearing cache..." -ForegroundColor Yellow
Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "Starting server..." -ForegroundColor Green
Write-Host ""

# Change to project directory to ensure correct context
Set-Location $PWD

# Start Expo with error suppression
$ErrorActionPreference = "SilentlyContinue"

# Use a try-catch wrapper in Node.js
$nodeScript = @"
process.on('uncaughtException', (e) => {
  if (e.code === 'UNKNOWN' && e.path && (e.path.includes('Temp') || e.path.includes('ps-script'))) {
    console.warn('[Ignored temp file error]');
    return;
  }
  throw e;
});
require('child_process').spawn('npx', ['expo', 'start', '--clear', '--tunnel'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});
"@

try {
    node -e $nodeScript
} catch {
    Write-Host "Starting with direct command..." -ForegroundColor Yellow
    npx expo start --clear --tunnel
}

