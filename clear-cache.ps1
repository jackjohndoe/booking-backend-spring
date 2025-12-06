# Clear Cache Script for Nigerian Apartments App

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CLEARING CACHE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Option 1: Clear Expo cache and restart
Write-Host "Option 1: Clear Expo cache and restart server" -ForegroundColor Yellow
Write-Host "This will clear Metro bundler cache" -ForegroundColor Gray
Write-Host ""
$clearExpo = Read-Host "Clear Expo cache and restart? (y/n)"

if ($clearExpo -eq 'y' -or $clearExpo -eq 'Y') {
    Write-Host ""
    Write-Host "Stopping any running Expo processes..." -ForegroundColor Yellow
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "Clearing Expo cache..." -ForegroundColor Yellow
    npx expo start --clear
    
    Write-Host ""
    Write-Host "✅ Expo cache cleared and server restarted!" -ForegroundColor Green
    Write-Host "Now open your browser and clear browser cache:" -ForegroundColor Cyan
    Write-Host "  - Press Ctrl + Shift + Delete" -ForegroundColor White
    Write-Host "  - Select 'Cached images and files'" -ForegroundColor White
    Write-Host "  - Click 'Clear data'" -ForegroundColor White
    Write-Host ""
    Write-Host "Or do a hard refresh in browser: Ctrl + Shift + R" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "Skipping Expo cache clear." -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BROWSER CACHE CLEARING" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT: You must also clear browser cache!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Method 1 - Clear Browser Data:" -ForegroundColor Green
Write-Host "  1. Press Ctrl + Shift + Delete" -ForegroundColor White
Write-Host "  2. Select 'Cached images and files'" -ForegroundColor White
Write-Host "  3. Select time range: 'All time'" -ForegroundColor White
Write-Host "  4. Click 'Clear data'" -ForegroundColor White
Write-Host ""
Write-Host "Method 2 - Hard Refresh (faster):" -ForegroundColor Green
Write-Host "  - Press Ctrl + Shift + R (or Ctrl + F5)" -ForegroundColor White
Write-Host ""
Write-Host "Method 3 - Clear localStorage in Console:" -ForegroundColor Green
Write-Host "  1. Open browser console (F12)" -ForegroundColor White
Write-Host "  2. Run: localStorage.clear()" -ForegroundColor White
Write-Host "  3. Run: sessionStorage.clear()" -ForegroundColor White
Write-Host "  4. Refresh the page (F5)" -ForegroundColor White
Write-Host ""
Write-Host "After clearing cache:" -ForegroundColor Cyan
Write-Host "  1. Close and reopen the browser tab" -ForegroundColor White
Write-Host "  2. Sign out from the app" -ForegroundColor White
Write-Host "  3. Sign in again to get fresh authentication token" -ForegroundColor White
Write-Host "  4. Try the payment flow again" -ForegroundColor White
Write-Host ""

