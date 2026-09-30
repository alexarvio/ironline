# Ironline mobile shell

The iPhone and Android app, built with Capacitor 8. It is a native wrapper that
loads the live site (`server.url` in `capacitor.config.json`), so every push to
Railway shows up in the app. Only native changes (new plugins, permissions,
icon, the site address) need a new store build.

- App id: `com.arvio.ironline`. It can still change until the first upload to
  a store, and after that it is permanent.
- Site: the Railway address for now. Switch it to the own domain before the
  first store upload, because changing it later needs an app update.
- `www/index.html` is only the "No connection" screen.
- Icon and splash come from `assets/`. Replace `assets/icon-only.png`
  (1024×1024) and `assets/splash.png` (2732×2732) with the real logo, then run
  `npm run icons`.

## Commands (need Node 22; the Next app is fine on 20)

```
npm install
npx cap sync        # after changing the config or adding a plugin
npx cap open android
```

## Building

- **Android:** Android Studio on Windows. Open with `npx cap open android`,
  then Run on an emulator or a phone with USB debugging.
- **iOS:** needs a Mac with Xcode, or a cloud Mac build (Codemagic, or GitHub
  Actions macOS runners). Signing needs the Apple Developer account for
  Arvio Enterprises LLC.

## Still to do before the stores

- Native push: APNs on iPhone and FCM on Android. `push_subscriptions` already
  has a kind for it. Hide the web PushToggle inside the app.
- Apple Health and Health Connect for steps.
- Sign-in once Clerk goes live: Google blocks sign-in inside app webviews, so
  use Clerk's native flow or the system browser. Apple also requires
  Sign in with Apple when Google is offered.
