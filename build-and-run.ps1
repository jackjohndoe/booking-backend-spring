# Build and Run Development Build Script
# This script will start an emulator (if needed) and build the app

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools;$env:ANDROID_HOME\emulator"

Write-Host "=== Development Build Setup ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check for devices/emulators
Write-Host "Step 1: Checking for Android devices/emulators..." -ForegroundColor Yellow
$devices = adb devices
$connectedDevices = ($devices | Select-String "device$").Count

if ($connectedDevices -gt 0) {
    Write-Host "✅ Device/emulator already connected!" -ForegroundColor Green
    adb devices
} else {
    Write-Host "No devices connected. Checking for AVDs..." -ForegroundColor Yellow
    
    $emulatorPath = "$env:ANDROID_HOME\emulator\emulator.exe"
    if (Test-Path $emulatorPath) {
        $avds = & $emulatorPath -list-avds
        
        if ($avds -and $avds.Count -gt 0) {
            Write-Host "✅ Found AVD: $($avds[0])" -ForegroundColor Green
            Write-Host "Starting emulator..." -ForegroundColor Cyan
            
            # Start emulator in background
            Start-Process -FilePath $emulatorPath -ArgumentList "-avd", $avds[0] -WindowStyle Normal
            
            Write-Host "Waiting for emulator to boot (this may take 1-2 minutes)..." -ForegroundColor Yellow
            Write-Host "Please wait..." -ForegroundColor Gray
            
            # Wait for device to be ready
            $maxWait = 120 # 2 minutes
            $waited = 0
            $deviceReady = $false
            
            while ($waited -lt $maxWait -and -not $deviceReady) {
                Start-Sleep -Seconds 5
                $waited += 5
                $devices = adb devices
                if ($devices -match "device$") {
                    $deviceReady = $true
                    Write-Host "✅ Emulator is ready!" -ForegroundColor Green
                } else {
                    Write-Host "." -NoNewline -ForegroundColor Gray
                }
            }
            
            if (-not $deviceReady) {
                Write-Host ""
                Write-Host "⚠️  Emulator is taking longer than expected to boot." -ForegroundColor Yellow
                Write-Host "Please wait for it to fully boot, then run this script again." -ForegroundColor Yellow
                exit 1
            }
        } else {
            Write-Host "❌ No AVDs found!" -ForegroundColor Red
            Write-Host ""
            Write-Host "Please create an AVD in Android Studio:" -ForegroundColor Yellow
            Write-Host "1. Open Android Studio" -ForegroundColor White
            Write-Host "2. Tools → Device Manager" -ForegroundColor White
            Write-Host "3. Click 'Create Device'" -ForegroundColor White
            Write-Host "4. Follow the wizard" -ForegroundColor White
            Write-Host ""
            Write-Host "Then run this script again." -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "❌ Android emulator not found!" -ForegroundColor Red
        Write-Host "Please ensure Android Studio is properly installed." -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "Step 2: Building development build..." -ForegroundColor Yellow
Write-Host "This will take several minutes on first build..." -ForegroundColor Gray
Write-Host ""

# Build the app
try {
    npx expo run:android
    Write-Host ""
    Write-Host "✅ Build completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Step 3: Starting development server..." -ForegroundColor Yellow
    Write-Host "The app should automatically connect to the dev server." -ForegroundColor Gray
    Write-Host ""
    Write-Host "To start the dev server manually, run:" -ForegroundColor Cyan
    Write-Host "  npm run start:dev" -ForegroundColor White
} catch {
    Write-Host ""
    Write-Host "❌ Build failed. Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure Android SDK Platform 33+ is installed" -ForegroundColor White
    Write-Host "2. Try: cd android && ./gradlew clean && cd .." -ForegroundColor White
    Write-Host "3. Try: npm run prebuild:clean && npm run android" -ForegroundColor White
    exit 1
}

