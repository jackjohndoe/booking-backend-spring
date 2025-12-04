# Install JDK 11 Script
# This script downloads and sets up JDK 11 for Android development

Write-Host "=== JDK 11 Installation Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if JDK 11 is already installed
$jdk11Paths = @(
    "$env:ProgramFiles\Java\jdk-11*",
    "$env:ProgramFiles\Eclipse Adoptium\jdk-11*",
    "$env:LOCALAPPDATA\Programs\Eclipse Adoptium\jdk-11*"
)

$jdk11Found = $null
foreach ($pathPattern in $jdk11Paths) {
    $parent = Split-Path $pathPattern -Parent -ErrorAction SilentlyContinue
    if ($parent) {
        $found = Get-ChildItem -Path $parent -Directory -ErrorAction SilentlyContinue | 
            Where-Object { $_.Name -match "jdk-11" } | 
            Select-Object -First 1
        if ($found) {
            $javaExe = Join-Path $found.FullName "bin\java.exe"
            if (Test-Path $javaExe) {
                $version = & $javaExe -version 2>&1 | Select-String "version"
                if ($version -match "11") {
                    $jdk11Found = $found.FullName
                    Write-Host "✅ JDK 11 already installed at: $jdk11Found" -ForegroundColor Green
                    & $javaExe -version
                    break
                }
            }
        }
    }
}

if ($jdk11Found) {
    Write-Host ""
    Write-Host "JDK 11 is ready to use!" -ForegroundColor Green
    Write-Host "Setting JAVA_HOME to: $jdk11Found" -ForegroundColor Cyan
    $env:JAVA_HOME = $jdk11Found
    $env:PATH = "$jdk11Found\bin;$env:PATH"
    Write-Host ""
    Write-Host "To make this permanent, add to System Environment Variables:" -ForegroundColor Yellow
    Write-Host "  JAVA_HOME = $jdk11Found" -ForegroundColor White
    exit 0
}

Write-Host "JDK 11 not found. Installation options:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Manual Installation (Recommended)" -ForegroundColor Cyan
Write-Host "1. Visit: https://adoptium.net/temurin/releases/?version=11" -ForegroundColor White
Write-Host "2. Download: Windows x64 JDK 11 (MSI installer)" -ForegroundColor White
Write-Host "3. Run the installer" -ForegroundColor White
Write-Host "4. Default install location: C:\Program Files\Eclipse Adoptium\jdk-11.x.x-hotspot" -ForegroundColor White
Write-Host "5. Run this script again to configure it" -ForegroundColor White
Write-Host ""
Write-Host "Option 2: Using Chocolatey (if installed)" -ForegroundColor Cyan
Write-Host "  choco install openjdk11 -y" -ForegroundColor White
Write-Host ""
Write-Host "Option 3: Using Scoop (if installed)" -ForegroundColor Cyan
Write-Host "  scoop install openjdk11" -ForegroundColor White
Write-Host ""
Write-Host "After installation, run this script again to configure JAVA_HOME." -ForegroundColor Yellow

