# Start Android Emulator Script
# This script will find and start an available Android Virtual Device (AVD)

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$emulatorPath = "$env:ANDROID_HOME\emulator\emulator.exe"

if (-not (Test-Path $emulatorPath)) {
    Write-Host "❌ Android emulator not found at: $emulatorPath" -ForegroundColor Red
    Write-Host "Please ensure Android Studio is properly installed." -ForegroundColor Yellow
    exit 1
}

# List available AVDs
Write-Host "Checking for available AVDs..." -ForegroundColor Cyan
$avds = & $emulatorPath -list-avds

if (-not $avds -or $avds.Count -eq 0) {
    Write-Host "❌ No Android Virtual Devices (AVDs) found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please create an AVD first:" -ForegroundColor Yellow
    Write-Host "1. Open Android Studio" -ForegroundColor White
    Write-Host "2. Go to Tools → Device Manager" -ForegroundColor White
    Write-Host "3. Click 'Create Device'" -ForegroundColor White
    Write-Host "4. Select a device (e.g., Pixel 5)" -ForegroundColor White
    Write-Host "5. Select a system image (API 33 or 34 recommended)" -ForegroundColor White
    Write-Host "6. Click Finish" -ForegroundColor White
    Write-Host ""
    Write-Host "Then run this script again to start the emulator." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Found $($avds.Count) AVD(s):" -ForegroundColor Green
foreach ($avd in $avds) {
    Write-Host "   - $avd" -ForegroundColor White
}

# Use the first AVD or let user choose
$selectedAvd = $avds[0]
if ($avds.Count -gt 1) {
    Write-Host ""
    Write-Host "Multiple AVDs found. Starting: $selectedAvd" -ForegroundColor Yellow
    Write-Host "(To use a different one, specify it as a parameter)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Starting emulator: $selectedAvd" -ForegroundColor Cyan
Write-Host "This may take a minute on first launch..." -ForegroundColor Yellow
Write-Host ""

# Start the emulator in the background
Start-Process -FilePath $emulatorPath -ArgumentList "-avd", $selectedAvd -WindowStyle Normal

Write-Host "✅ Emulator is starting..." -ForegroundColor Green
Write-Host "Wait for the emulator to fully boot, then you can build your app." -ForegroundColor Yellow
Write-Host ""
Write-Host "To check if emulator is ready, run: adb devices" -ForegroundColor Gray

