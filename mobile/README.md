# Norcoach mobile shell

The iPhone and Android app, built with Capacitor 8. It is a native wrapper that
loads the live site (`server.url` in `capacitor.config.json`), so every push to
Railway shows up in the app. Only native changes (new plugins, permissions,
icon, the site address) need a new store build.

- App id: `com.arvio.norcoach` on iPhone (11 Nov, Alex), permanent from its first
  TestFlight upload. Android is still `com.arvio.ironline` (its Firebase app is
  registered under it); move it to the same id before its first store upload.
- iPhone builds: GitHub > Actions > iOS to TestFlight (.github/workflows/ios-testflight.yml).
- Site: the Railway address for now. Switch it to the own domain before the
  first store upload, because changing it later needs an app update.
- `www/index.html` is only the "No connection" screen.
- `server.allowNavigation` holds every address the app opens inside itself. The site's own
  host must be in it: Capacitor counts a page as the app's only when it starts with the whole
  `server.url`, `/client` included, so the redirect to `/login` went to Safari (11 Nov, builds 3
  and 4). Also
  Clerk's `clerk.norcoachapp.com`, whose session check is a page hop (11 Nov: without it the
  first launch fell to the No connection screen and the hop opened in Safari). Any other
  address opens in Safari.
- The page starts below the clock strip (`StatusBar.overlaysWebView: false`, the strip the top bar's
  `#FAFAFA`), as the home-screen web app does; the site's top bar is built for that (11 Nov).
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
