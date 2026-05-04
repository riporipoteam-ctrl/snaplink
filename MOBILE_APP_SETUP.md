# SnapLink Mobile App Setup

SnapLink now has a Capacitor wrapper around the existing Vite web app.

## Commands

```powershell
npm run app:sync
```

Builds the web app and syncs it into the native projects.

```powershell
npm run app:android
```

Builds, syncs, and opens the Android project in Android Studio. From Android Studio you can run on a device/emulator or create an APK.

```powershell
npm run app:ios
```

Builds and syncs the iOS project. The final iPhone run/archive step must happen on macOS with Xcode because Apple requires Xcode for iOS device builds/signing.

## What works now

- `android/` is generated.
- `ios/` is generated.
- Native-shell detection is enabled in `src/main.tsx`.
- Native-only glass styling is enabled through `html[data-native-shell="true"]`.

## Local requirement before APK builds

This PC still needs a JDK configured before Gradle can produce an APK. The attempted debug build failed because `JAVA_HOME` is not set and `java` is not available on `PATH`.

Install a current JDK, set `JAVA_HOME` to the JDK folder, reopen the terminal, then run:

```powershell
.\android\gradlew.bat assembleDebug
```

The debug APK will be created under `android/app/build/outputs/apk/debug/`.

## iPhone reality check

There is no reliable “upload any Capacitor app into an App Store preview container for free” path. Since you do not have a Mac or paid Apple Developer Program account, use the sideload route in `IOS_SIDELOAD_NO_MAC.md`.

That route builds `SnapLink-unsigned.ipa` using GitHub Actions on a macOS runner, then installs it with Sideloadly on Windows. SideStore and AltStore remain backup options.

If you later get Mac access, another route is opening `ios/App/App.xcodeproj` in Xcode with a personal Apple ID and running it as a development build.

For full app-store distribution, TestFlight, and long-term signed builds, an Apple Developer Program account is still required.

## Notifications

Web push on iPhone is limited to installed Home Screen web apps. The native app wrapper is the right path for stronger future push/calling notifications because it can use native notification plugins/server push later.
