# EAS Build Script for Android Development Build
# Run this script after logging in with: eas login

Write-Host "=== EAS Build for Android Development Build ===" -ForegroundColor Cyan
Write-Host ""

# Check if logged in
Write-Host "Checking EAS login status..." -ForegroundColor Yellow
$loginStatus = eas whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not logged in to EAS!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please login first:" -ForegroundColor Yellow
    Write-Host "  eas login" -ForegroundColor White
    Write-Host ""
    Write-Host "Then run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Logged in to EAS" -ForegroundColor Green
Write-Host ""

# Verify eas.json exists
if (-not (Test-Path "eas.json")) {
    Write-Host "Configuring EAS Build..." -ForegroundColor Yellow
    eas build:configure
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ EAS configuration failed" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Starting Android development build..." -ForegroundColor Cyan
Write-Host "This will:" -ForegroundColor Yellow
Write-Host "  1. Upload your project to Expo's servers" -ForegroundColor White
Write-Host "  2. Build the Android APK in the cloud" -ForegroundColor White
Write-Host "  3. Handle all compatibility issues automatically" -ForegroundColor White
Write-Host "  4. Provide a download link when complete" -ForegroundColor White
Write-Host ""
Write-Host "This may take 10-20 minutes..." -ForegroundColor Yellow
Write-Host ""

# Start the build
eas build --profile development --platform android

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Build completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Download the APK from the link above" -ForegroundColor White
    Write-Host "  2. Install it on your Android device/emulator" -ForegroundColor White
    Write-Host "  3. Start the dev server: npm run start:dev" -ForegroundColor White
    Write-Host "  4. Open the development build app - it will connect automatically!" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Build failed. Check the error messages above." -ForegroundColor Red
    Write-Host ""
    Write-Host "To view build logs:" -ForegroundColor Yellow
    Write-Host "  eas build:list" -ForegroundColor White
}

