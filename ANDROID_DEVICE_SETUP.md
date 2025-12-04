# Android Device/Emulator Setup

To build and run the development build, you need either:
- An Android physical device connected via USB, OR
- An Android emulator (AVD) running

## Option 1: Create Android Emulator (Recommended for Testing)

### Steps:

1. **Open Android Studio**
   - Launch Android Studio

2. **Open Device Manager**
   - Click on **Tools** → **Device Manager** (or click the Device Manager icon in the toolbar)

3. **Create Virtual Device**
   - Click **Create Device** button
   - Select a device definition (e.g., Pixel 5, Pixel 6)
   - Click **Next**

4. **Select System Image**
   - Choose a system image (recommended: **API 33** or **API 34** with Google Play)
   - If not downloaded, click **Download** next to the system image
   - Click **Next**

5. **Configure AVD**
   - Give it a name (e.g., "Pixel_5_API_33")
   - Review settings and click **Finish**

6. **Start the Emulator**
   - In Device Manager, click the **Play** button next to your AVD
   - Wait for the emulator to boot up (first time may take a few minutes)

### Verify Emulator is Running

Once the emulator is running, verify it's detected:

```powershell
# Set Android SDK path
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH += ";$env:ANDROID_HOME\platform-tools"

# Check connected devices
adb devices
```

You should see your emulator listed.

## Option 2: Use Physical Android Device

### Steps:

1. **Enable Developer Options on Your Device**
   - Go to **Settings** → **About Phone**
   - Tap **Build Number** 7 times until you see "You are now a developer!"

2. **Enable USB Debugging**
   - Go to **Settings** → **Developer Options**
   - Enable **USB Debugging**
   - Enable **Install via USB** (if available)

3. **Connect Device**
   - Connect your Android device to your computer via USB
   - On your device, when prompted, tap **Allow USB debugging**
   - Check **Always allow from this computer** (optional)

4. **Verify Connection**
   ```powershell
   # Set Android SDK path
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   $env:PATH += ";$env:ANDROID_HOME\platform-tools"
   
   # Check connected devices
   adb devices
   ```

   You should see your device listed (e.g., "ABC123XYZ    device")

## After Device/Emulator is Ready

Once you have a device or emulator running:

1. **Build and Install Development Build:**
   ```powershell
   # Set Android environment
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   $env:PATH += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools"
   
   # Build and run
   npm run android
   # OR
   npx expo run:android
   ```

2. **Start Development Server:**
   ```bash
   npm run start:dev
   ```

3. **Open the App:**
   - The development build will automatically connect to the dev server
   - You'll see the app with all native features enabled!

## Troubleshooting

### Emulator Won't Start
- Make sure you have enough RAM (recommended: 8GB+)
- Close other applications to free up memory
- Try creating a new AVD with lower API level (API 30 or 31)

### Device Not Detected
- Make sure USB debugging is enabled
- Try different USB cable
- Try different USB port
- On Windows, install device drivers if needed
- Restart ADB: `adb kill-server && adb start-server`

### Build Fails
- Make sure Android SDK Platform 33+ is installed
- Check that `ANDROID_HOME` is set correctly
- Try cleaning build: `cd android && ./gradlew clean && cd ..`
- Rebuild: `npm run prebuild:clean && npm run android`

## Quick Commands

```powershell
# Set Android environment (run this in each new PowerShell session)
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools"

# Check devices
adb devices

# Build and run
npm run android
```

## Next Steps

After the development build is installed and running:

1. ✅ Push notifications will work
2. ✅ Image picker will work  
3. ✅ All native features enabled
4. ✅ Hot reload and fast refresh available

Enjoy developing with full native feature support!

