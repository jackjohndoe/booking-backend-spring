# EAS Build Setup Guide

## Step 1: Login to EAS

You need to login to your Expo account. Run this command in your terminal:

```bash
eas login
```

You can login with:
- Email and password
- GitHub account
- Google account

If you don't have an Expo account, you can create one at: https://expo.dev/signup

## Step 2: Configure EAS Build

After logging in, run:

```bash
eas build:configure
```

This will create/update the `eas.json` file with build configurations.

## Step 3: Start the Build

Once configured, start the development build:

```bash
eas build --profile development --platform android
```

This will:
1. Upload your project to Expo's servers
2. Build the Android APK in the cloud
3. Handle all compatibility issues automatically
4. Provide a download link when complete

## Step 4: Install and Run

After the build completes:
1. Download the APK from the provided link
2. Install it on your Android device/emulator
3. Start the dev server: `npm run start:dev`
4. Open the development build app - it will connect automatically!

## Benefits of EAS Build

- ✅ No local build configuration needed
- ✅ Handles JVM compatibility automatically
- ✅ Faster builds (cloud infrastructure)
- ✅ Works on any machine
- ✅ No need for Android Studio setup

## Quick Commands

```bash
# Login
eas login

# Configure
eas build:configure

# Build development version
eas build --profile development --platform android

# Check build status
eas build:list

# View build details
eas build:view [BUILD_ID]
```

## Troubleshooting

If you encounter issues:
- Make sure you're logged in: `eas whoami`
- Check your internet connection
- Verify your `app.json` is properly configured
- Check build logs: `eas build:view [BUILD_ID]`

