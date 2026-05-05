# SnapLink Expo Go Preview

This is the no-cable, no-Mac iPhone preview route.

## Run On iPhone

1. Install **Expo Go** from the iPhone App Store.
2. On this PC, run:

```powershell
npm run start:tunnel
```

3. Scan the QR code with the iPhone camera or Expo Go.
4. SnapLink opens inside Expo Go with a fullscreen WebView shell.

## Important Reality Check

This is not a standalone App Store app and it is not the unsigned IPA. It is the best free no-cable route from Windows because Expo Go already exists on the App Store and can load this preview project.

For a real standalone `.ipa`, Apple still requires signing. Free 7-day signing is possible only through Xcode on macOS or a signing/sideloading flow that pairs the iPhone first.
