# Install SnapLink On iPhone Without A Mac Or Paid Apple Certificate

This is the no-Mac, no-TestFlight, no-paid-Apple-developer route.

It is not App Store distribution. It is sideloading, which means the app can appear on your iPhone home screen as a real app, but free Apple ID signing has limits.

## If You Do Not Have A Cable

Use the SnapLink iPhone install page instead:

```text
https://snaplinknetwork.netlify.app/install
```

Open that link on iPhone Safari, tap Share, then choose Add to Home Screen. That is the clean no-cable install path we can control today. It is not an unsigned IPA install, because iOS blocks unsigned IPA downloads from the web.

The IPA route below still needs either a USB pairing step, paid signing, or a trusted signing service. Random no-cable certificate stores are not recommended for SnapLink because they can get revoked and may ask you to trust unknown certificates.

## What this setup adds

- A GitHub Actions workflow at `.github/workflows/build-ios-sideload-ipa.yml`.
- The workflow uses a free GitHub macOS runner to compile the Capacitor iOS project.
- It uploads `SnapLink-unsigned.ipa` as a workflow artifact.
- You can install that IPA with Sideloadly from Windows, with SideStore/AltStore as backup routes.

## Build The IPA

1. Push this repo to GitHub.
2. Open the repo on GitHub.
3. Go to `Actions`.
4. Run `Build iOS Sideload IPA`.
5. Download the `SnapLink-unsigned-ipa` artifact.
6. Unzip the artifact to get `SnapLink-unsigned.ipa`.

## Install From Windows/iPhone

Use one of these sideload routes:

- Sideloadly: recommended Windows route for this project. Official site: https://sideloadly.io/index.html
- SideStore: backup route when you want refreshes from the iPhone after setup. Official guide: https://docs.sidestore.io/docs/installation/install
- AltStore: backup Windows-supported sideload path, but it usually needs AltServer on your PC for refreshes. Official guide/FAQ: https://faq.altstore.io/altstore-classic/your-altstore

Sideloadly flow:

1. Install iTunes/iCloud from Apple if Sideloadly asks for them.
2. Install Sideloadly on Windows.
3. Plug the iPhone into the PC and trust the computer on the iPhone. Without this first pairing/signing step, Sideloadly is not the right path.
4. Open Sideloadly, select `SnapLink-unsigned.ipa`, enter your Apple ID, then start.
5. Trust the developer profile on the iPhone if iOS asks.
6. Open SnapLink from the iPhone home screen.

SideStore/AltStore flow:

1. Install SideStore or AltStore on the iPhone using their official guide.
2. Sign in with a free Apple ID in the sideload app.
3. Import `SnapLink-unsigned.ipa`.
4. Trust the developer profile on the iPhone if iOS asks.
5. Open SnapLink from the iPhone home screen.

## Free Apple ID Limits

With a free Apple ID, sideloaded apps usually need to be refreshed every 7 days and Apple limits how many apps can be active at once. That is an Apple platform limit, not a SnapLink code issue.

## Notifications Reality

This gives SnapLink a real app icon and native wrapper, but full native push/call notifications on iPhone usually need Apple push notification entitlements, which require Apple developer signing. The app can still run SnapLink and in-app notifications while open.

## Android

Android is easier. Once Java/JDK is installed on this PC:

```powershell
.\android\gradlew.bat assembleDebug
```

The APK appears in:

```text
android/app/build/outputs/apk/debug/
```
