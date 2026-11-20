# Mobile apps — how updates reach Android / iOS

Since 2026-11-20 the Capacitor apps (`frontend/capacitor.config.json`, app id `online.attendoschool.app`) **live-load
the production website** (`server.url = https://attendoschool.online`) instead of a bundled copy of the UI.

## What this means
- **Every push to `main` that deploys (CI → CD) appears in the apps on their next launch / reload**, the same as on the
  website. No app rebuild, reinstall or store release is needed for UI, RBAC or backend changes.
- The HTML shell, `sw.js` and the manifest are served with `Cache-Control: no-cache` and hashed assets are immutable
  (`backend/src/app.ts`), so the app always picks up the newest build.
- Native features keep working (Capacitor injects its bridge into the remote page): Android back button, native
  share/save for PDFs, CSVs and attachments, in-app browser for external links.
- No connection, or the site unreachable → the bundled `frontend/public/offline.html` is shown, with a Retry button
  (it also retries automatically when the device comes back online).
- Payments: `checkout.razorpay.com` / `api.razorpay.com` are allowed to open inside the app (`server.allowNavigation`);
  every other external link opens in the system browser.

## When a new app build IS still needed
Only for native changes: `capacitor.config.json`, Capacitor/plugin versions, icons/splash (`frontend/resources`),
Android/iOS project settings, permissions, app version numbers. Build with
**Actions → "Mobile - Android and iOS builds" → Run workflow** (branch `main`). It produces a debug APK + release AAB
and an iOS simulator build/archive as artifacts; signed store builds need `signed_release=true` and the signing secrets.

**One-time step:** the apps already installed on phones are still the old bundled build. Install the APK/IPA produced
from this change once; after that, updates are automatic.

## Notes / trade-offs
- Users signed in on an old bundled build sign in once more (the app's storage origin changes from the local
  `https://localhost` to `https://attendoschool.online`).
- Capacitor documents `server.url` as intended for live reload; it is used deliberately here so releases are instant.
  Apple may scrutinise apps that are mostly a website during App Store review (guideline 4.2) — the native share/
  download/back-button integration helps.
- To return to bundled mode: remove `server.url`, `allowNavigation` and `errorPath` from `capacitor.config.json` and run
  the mobile workflow.
