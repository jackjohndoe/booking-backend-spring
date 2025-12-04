# Build Issue: JVM Target Compatibility

## Problem

When building the Android development build, you may encounter this error:

```
Inconsistent JVM-target compatibility detected for tasks 'compileDebugJavaWithJavac' (17) and 'compileDebugKotlin' (11).
```

This occurs because:
- Android Studio bundles JDK 21 (which targets JVM 17)
- Expo's `expo-module-gradle-plugin` sets Kotlin to target JVM 11 by default
- Gradle requires Java and Kotlin to target the same JVM version

## Solutions

### Option 1: Use JDK 11 (Recommended for Local Builds)

1. Download JDK 11 from [Oracle](https://www.oracle.com/java/technologies/javase/jdk11-archive-downloads.html) or [Adoptium](https://adoptium.net/temurin/releases/?version=11)

2. Set JAVA_HOME to JDK 11:
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Java\jdk-11"
   $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
   ```

3. Verify:
   ```powershell
   java -version
   # Should show version 11.x.x
   ```

4. Rebuild:
   ```powershell
   npm run android
   ```

### Option 2: Use EAS Build (Cloud Build - Easiest)

EAS Build handles all these compatibility issues automatically:

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```

2. Login:
   ```bash
   eas login
   ```

3. Configure:
   ```bash
   eas build:configure
   ```

4. Build:
   ```bash
   eas build --profile development --platform android
   ```

5. Install the APK on your device and connect to dev server

### Option 3: Wait for Expo Update

This is a known issue that Expo is working on. Future versions of `expo-module-gradle-plugin` will support JDK 17+.

## Current Status

- ✅ Code is configured correctly
- ✅ Native project generated
- ✅ Emulator is ready
- ⚠️ Build blocked by JVM target mismatch
- ✅ Workarounds available (JDK 11 or EAS Build)

## Files Modified

The following files were modified to attempt to fix the issue:
- `android/build.gradle` - Added subprojects configuration
- `android/app/build.gradle` - Added Kotlin JVM target
- `android/gradle.properties` - Added validation mode setting
- `node_modules/expo-image-loader/android/build.gradle` - Patched (temporary)
- `node_modules/expo-image-picker/android/build.gradle` - Patched (temporary)

**Note:** Changes to `node_modules` will be lost on `npm install`. Use patch-package to make them permanent, or use one of the workarounds above.

## Next Steps

1. Choose a solution (JDK 11 or EAS Build)
2. Complete the build
3. Install the development build on your device
4. Start the dev server: `npm run start:dev`
5. Enjoy full native feature support!

