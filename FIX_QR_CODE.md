# Fix: QR Code Not Appearing

## Problem
The temp file error is crashing the server before the QR code appears.

## Solutions

### Solution 1: Start Without Tunnel (Recommended)
```powershell
npx expo start --clear
```
This avoids the tunnel mode which triggers the temp file error.

### Solution 2: Use Web Browser
1. Start the server: `npx expo start --clear`
2. Press `w` in the Expo terminal
3. App opens in web browser for testing

### Solution 3: Use LAN Connection
1. Make sure phone and computer are on same Wi-Fi
2. Start: `npx expo start --clear`
3. Look for the LAN URL in terminal
4. Type it manually in Expo Go app

### Solution 4: Manual Connection
1. Start server: `npx expo start --clear`
2. Note the local IP address shown
3. In Expo Go, tap "Enter URL manually"
4. Enter: `exp://YOUR_IP:8081`

## Quick Test
Run this command:
```powershell
.\start-expo-simple.ps1
```

This starts without tunnel mode and should show the QR code.

