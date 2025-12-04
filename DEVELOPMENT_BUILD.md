# Development Build Guide

This guide explains how to create and use development builds for the Nigerian Apartments app.

## What is a Development Build?

A development build is a custom version of your app that includes the Expo Dev Client, allowing you to use native modules that don't work in Expo Go, such as:
- Push notifications (expo-notifications)
- Image picker (expo-image-picker)
- Other custom native modules

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Prebuild Native Code (First Time Only)
```bash
npm run prebuild
```

This generates the `android/` and `ios/` native project folders.

### 3. Build and Run

**Android:**
```bash
npm run android:dev
```

**iOS (macOS only):**
```bash
cd ios && pod install && cd ..
npm run ios:dev
```

### 4. Start Development Server
```bash
npm run start:dev
```

The development build will automatically connect to the server.

## Detailed Instructions

### Android Setup

1. **Install Android Studio**
   - Download from [developer.android.com/studio](https://developer.android.com/studio)
   - Install Android SDK (API 33 or higher recommended)
   - Set up Android Virtual Device (AVD) or connect physical device

2. **Configure Environment**
   - Set `ANDROID_HOME` environment variable
   - Add Android SDK tools to PATH

3. **Build**
   ```bash
   npm run prebuild
   npm run android:dev
   ```

### iOS Setup (macOS Only)

1. **Install Xcode**
   - Download from Mac App Store
   - Install Command Line Tools: `xcode-select --install`
   - Install CocoaPods: `sudo gem install cocoapods`

2. **Build**
   ```bash
   npm run prebuild
   cd ios && pod install && cd ..
   npm run ios:dev
   ```

## Common Commands

| Command | Description |
|--------|-------------|
| `npm run prebuild` | Generate native project folders |
| `npm run prebuild:clean` | Clean and regenerate native folders |
| `npm run android:dev` | Build and run Android development build |
| `npm run ios:dev` | Build and run iOS development build |
| `npm run start:dev` | Start Expo dev server for development build |
| `npm run android` | Standard Android build command |
| `npm run ios` | Standard iOS build command |

## Troubleshooting

### Android Issues

**Build fails:**
- Clean build: `cd android && ./gradlew clean && cd ..`
- Rebuild: `npm run prebuild:clean && npm run android:dev`

**Device not found:**
- Enable USB debugging on Android device
- Check `adb devices` to see connected devices
- Restart ADB: `adb kill-server && adb start-server`

**SDK not found:**
- Open Android Studio → SDK Manager
- Install required SDK platforms and build tools
- Verify `ANDROID_HOME` is set correctly

### iOS Issues

**Pod install fails:**
- Update CocoaPods: `sudo gem install cocoapods`
- Clean pods: `cd ios && rm -rf Pods Podfile.lock && pod install && cd ..`

**Build errors:**
- Clean build folder in Xcode: Product → Clean Build Folder
- Rebuild: `npm run prebuild:clean && cd ios && pod install && cd .. && npm run ios:dev`

**Simulator issues:**
- Reset simulator: Device → Erase All Content and Settings
- Or use physical device instead

### Connection Issues

**App won't connect to dev server:**
- Ensure device and computer are on same Wi-Fi network
- Check firewall settings
- Try restarting dev server: `npm run start:dev`
- In development build, shake device and select "Configure Bundler" to enter server URL manually

## Differences from Expo Go

| Feature | Expo Go | Development Build |
|---------|---------|-------------------|
| Push Notifications | ❌ Limited | ✅ Full support |
| Image Picker | ❌ Limited | ✅ Full support |
| Custom Native Modules | ❌ Not supported | ✅ Supported |
| Build Time | Instant | 5-15 minutes |
| Setup Complexity | None | Requires Android Studio/Xcode |

## Next Steps

After successfully building and running the development build:

1. Test all features including push notifications and image picker
2. Continue development with hot reload enabled
3. When ready, create a production build using EAS Build or local build commands

## Resources

- [Expo Development Builds Documentation](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo Dev Client](https://docs.expo.dev/clients/introduction/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)


