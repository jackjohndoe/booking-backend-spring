# Setup JDK 11 for Android Build
# Run this after installing JDK 11

Write-Host "=== Configuring JDK 11 ===" -ForegroundColor Cyan
Write-Host ""

# Common JDK 11 installation paths
$jdk11Paths = @(
    "$env:ProgramFiles\Eclipse Adoptium\jdk-11*",
    "$env:ProgramFiles\Java\jdk-11*",
    "$env:LOCALAPPDATA\Programs\Eclipse Adoptium\jdk-11*"
)

$jdk11Found = $null
foreach ($pathPattern in $jdk11Paths) {
    $parent = Split-Path $pathPattern -Parent -ErrorAction SilentlyContinue
    if ($parent -and (Test-Path $parent)) {
        $found = Get-ChildItem -Path $parent -Directory -ErrorAction SilentlyContinue | 
            Where-Object { $_.Name -match "jdk-11" } | 
            Select-Object -First 1
        if ($found) {
            $javaExe = Join-Path $found.FullName "bin\java.exe"
            if (Test-Path $javaExe) {
                $version = & $javaExe -version 2>&1 | Select-String "version"
                if ($version -match "11") {
                    $jdk11Found = $found.FullName
                    break
                }
            }
        }
    }
}

if ($jdk11Found) {
    Write-Host "✅ Found JDK 11 at: $jdk11Found" -ForegroundColor Green
    & (Join-Path $jdk11Found "bin\java.exe") -version
    Write-Host ""
    Write-Host "Setting JAVA_HOME for this session..." -ForegroundColor Cyan
    $env:JAVA_HOME = $jdk11Found
    $env:PATH = "$jdk11Found\bin;$env:PATH"
    Write-Host ""
    Write-Host "✅ JDK 11 configured! You can now build the Android app." -ForegroundColor Green
    Write-Host ""
    Write-Host "To build, run:" -ForegroundColor Yellow
    Write-Host "  npm run android" -ForegroundColor White
    Write-Host "  OR" -ForegroundColor White
    Write-Host "  npx expo run:android" -ForegroundColor White
} else {
    Write-Host "❌ JDK 11 not found in common locations." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please ensure JDK 11 is installed, then:" -ForegroundColor Yellow
    Write-Host "1. Provide the installation path, OR" -ForegroundColor White
    Write-Host "2. Run this script again after installation" -ForegroundColor White
    Write-Host ""
    Write-Host "Common installation locations:" -ForegroundColor Cyan
    Write-Host "  - C:\Program Files\Eclipse Adoptium\jdk-11.x.x-hotspot" -ForegroundColor Gray
    Write-Host "  - C:\Program Files\Java\jdk-11.x.x" -ForegroundColor Gray
}

