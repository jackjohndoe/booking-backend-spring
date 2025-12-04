# Nigerian Apartments Leasing App

A React Native mobile app for apartment leasing in Nigeria, styled with white and yellow colors.

## Features

- **Home Page**: Entry point with "Come In" button
- **Authentication**: Sign In and Sign Up with Google and Apple authentication
- **Explore**: Browse apartment listings across Nigeria
- **Favorites**: Save and manage favorite apartments
- **Wallet**: Manage payments and transactions
- **Apartment Details**: View detailed information about apartments
- **Profile**: User profile and settings

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Expo CLI
- iOS Simulator (for Mac) or Android Emulator / physical device

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the Expo development server:
```bash
npm start
```

3. Run on iOS:
```bash
npm run ios
```

4. Run on Android:
```bash
npm run android
```

## Development Build

This app uses a **development build** to enable native features like push notifications and image picker that don't work in Expo Go.

### Prerequisites for Development Build

**For Android:**
- Android Studio installed
- Android SDK configured
- Java Development Kit (JDK) installed
- Physical Android device or emulator

**For iOS (macOS only):**
- Xcode installed (latest version recommended)
- CocoaPods installed (`sudo gem install cocoapods`)
- Physical iOS device or simulator

### Building a Development Build

#### First Time Setup

1. Install dependencies (including expo-dev-client):
```bash
npm install
```

2. Prebuild native code (generates android/ and ios/ folders):
```bash
npm run prebuild
```

#### Building for Android

1. Connect an Android device or start an emulator

2. Build and run the development build:
```bash
npm run android:dev
```

Or use the standard command:
```bash
npm run android
```

#### Building for iOS (macOS only)

1. Install CocoaPods dependencies:
```bash
cd ios && pod install && cd ..
```

2. Build and run the development build:
```bash
npm run ios:dev
```

Or use the standard command:
```bash
npm run ios
```

### Running with Development Build

After building and installing the development build on your device/emulator:

1. Start the development server:
```bash
npm run start:dev
```

2. Open the development build app on your device
3. The app will automatically connect to the development server
4. You can now use all native features including:
   - Push notifications (expo-notifications)
   - Image picker (expo-image-picker)
   - All other native modules

### Troubleshooting

**Android Build Issues:**
- Ensure Android Studio is installed and Android SDK is configured
- Check that `ANDROID_HOME` environment variable is set
- Try cleaning the build: `cd android && ./gradlew clean && cd ..`
- Rebuild: `npm run prebuild:clean` then `npm run android:dev`

**iOS Build Issues:**
- Ensure Xcode is up to date
- Run `cd ios && pod install && cd ..` to update CocoaPods dependencies
- Clean build folder in Xcode: Product → Clean Build Folder
- Rebuild: `npm run prebuild:clean` then `npm run ios:dev`

**Connection Issues:**
- Make sure your device and computer are on the same network
- Check that the development server is running
- Try restarting the development server with `npm run start:dev`

## Configuration

### Google Authentication Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable Google Sign-In API
4. Create OAuth 2.0 credentials
5. Update the client IDs in:
   - `src/screens/SignInScreen.js`
   - `src/screens/SignUpScreen.js`

Replace:
- `YOUR_IOS_CLIENT_ID`
- `YOUR_ANDROID_CLIENT_ID`
- `YOUR_WEB_CLIENT_ID`

### Apple Authentication Setup

Apple authentication is available on iOS devices only. Make sure you have:
- An Apple Developer account
- Configured the app in Apple Developer Portal
- Set up the necessary certificates

## Expo Go vs Development Build

### Expo Go (Limited Features)
- Quick testing without building
- Some native features don't work (push notifications, image picker)
- Good for initial development and testing basic features

### Development Build (Full Features)
- All native features work
- Push notifications enabled
- Image picker enabled
- Requires building the app locally or with EAS Build
- Recommended for full feature testing

**Note:** This app requires a development build to use all features. Use `npm run android:dev` or `npm run ios:dev` to build and run.

## Tech Stack

- **Expo SDK** ~54.0.0
- **React Native** 0.81.5
- **React Navigation** v6
- **Expo Dev Client** for development builds
- **AsyncStorage** for local storage
- **Expo AuthSession** for authentication
- **Expo Notifications** for push notifications
- **Expo Image Picker** for image selection

## Color Scheme

- Primary: Yellow (#FFD700)
- Background: White (#FFFFFF)
- Text: Dark gray/black (#333)
- No gradients - solid colors only

## Project Structure

```
├── App.js                    # Main app entry point
├── src/
│   ├── context/
│   │   └── AuthContext.js    # Authentication context
│   ├── hooks/
│   │   └── useAuth.js        # Auth hook
│   ├── navigation/
│   │   └── MainTabNavigator.js # Bottom tab navigation
│   └── screens/
│       ├── HomeScreen.js
│       ├── SignInScreen.js
│       ├── SignUpScreen.js
│       ├── ExploreScreen.js
│       ├── FavoritesScreen.js
│       ├── WalletScreen.js
│       ├── ProfileScreen.js
│       └── ApartmentDetailsScreen.js
└── assets/                   # App assets
```

## Notes

- Placeholder apartment images are loaded from Unsplash
- Favorites are stored locally using AsyncStorage
- Authentication state is managed via React Context
- The app uses Nigerian Naira (₦) for pricing

## License

This project is created for educational purposes.



