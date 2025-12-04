# Quick Start Guide - Fix Temp File Error

## Method 1: Use the Safe Script (Recommended)
```powershell
.\start-expo-safe.ps1
```

## Method 2: Direct Command (If script doesn't work)
```powershell
$env:EXPO_NO_METRO_LAZY='1'; npx expo start --clear --tunnel
```

## Method 3: Standard Mode (Fallback)
```powershell
npx expo start --clear
```

## If Error Still Appears:
The error will be caught and ignored. The server should continue running and show the QR code.

## What to Expect:
1. Server starts (may take 10-20 seconds)
2. QR code appears in terminal
3. Scan with Expo Go app
4. App loads on your device

## Troubleshooting:
- If QR code doesn't appear, wait a bit longer
- Make sure phone and computer are on same Wi-Fi
- Try pressing 'r' in the Expo terminal to reload

