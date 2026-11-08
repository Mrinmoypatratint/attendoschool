# AttendoSchool for Android and iOS

The web app and both native apps share the existing Express API at
`https://attendoschool.online/api`. The API remains the only connection to the
existing school database. No new database, tenant store or separate user accounts
are created. Existing accounts and permissions work across clients; each device
signs in separately. Changes appear when the other client reloads its data; this
does not introduce a new realtime subscription system.

The Android and iOS apps bundle the same React application as the website using
Capacitor 8. They start at login and use the production HTTPS API even though their
bundled assets run on a local WebView origin. Android uses `https://localhost`;
iOS uses `capacitor://localhost`, explicitly allowed by the backend. Web browsers
continue using the same-origin `/api`. No database credentials are bundled.

App name: **AttendoSchool**. Android application ID and Apple bundle ID:
**online.attendoschool.app**. Version: **0.11.0**.

## Build locally

Requires Node 22+, Java 21 and Android SDK 36 for Android. iOS requires a Mac with
Xcode 26+; Windows cannot compile or sign an iOS app.

```sh
npm --prefix frontend ci
npm --prefix frontend run mobile:android
cd frontend/android
./gradlew assembleDebug bundleRelease
```

Windows: use `gradlew.bat` instead. Android Studio can open `frontend/android`.
The debug APK is `frontend/android/app/build/outputs/apk/debug/app-debug.apk`.
This build uses **real production data**, with the same authentication and
permissions as the website. It is not a sandbox database.

On macOS:

```sh
npm --prefix frontend run mobile:ios
npm --prefix frontend run mobile:open:ios
```

Swift Package Manager resolves the iOS native dependencies. Choose the Apple
development team in Xcode to run on a physical iPhone.

For a separate staging server only, set `VITE_NATIVE_API_URL` when building.
It must be an absolute HTTPS API URL. The default is the production server.
Native runtime handling includes Android back navigation and save/share sheets
for existing PDF, attachment and export download controls.

## CI artifacts

Run **Mobile - Android and iOS builds** (`.github/workflows/mobile.yml`) from
GitHub Actions, choosing `both`, `android` or `ios`. With `signed_release=false`:

- Android artifact: an installable debug APK and an **unsigned** release AAB.
- iOS artifact: a Mac simulator app and an **unsigned** physical-device archive.
  The unsigned archive is not an installable iPhone IPA.

Artifacts expire after 14 days. The workflow uses a clean checkout of the selected
commit, so unrelated local edits are never included. CI run numbers provide the
Android version code and iOS archive build number. Increase `versionName` and
`MARKETING_VERSION` together when releasing a new public version.

## Store signing and submission

The owner confirmed Google Play and Apple developer accounts are not set up yet.
No store submission has been made. Create those accounts and reserve the app ID
before the first public release. Developer enrollment, signing identities,
provisioning and store policy declarations cannot be supplied by this repository.

Configure repository Actions secrets, never committed files:

| Android signing | iOS signing |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `IOS_CERTIFICATE_BASE64` (distribution P12) |
| `ANDROID_KEYSTORE_PASSWORD` | `IOS_CERTIFICATE_PASSWORD` |
| `ANDROID_KEY_ALIAS` | `IOS_PROFILE_BASE64` (App Store profile for the bundle ID) |
| `ANDROID_KEY_PASSWORD` | `IOS_TEAM_ID` |

Run the workflow with `signed_release=true` to build a signed AAB and signed IPA.
It fails clearly if required signing secrets are missing. The workflow produces
artifacts; it does **not** automatically submit or publish them. Upload the AAB
in Play Console and the IPA through Transporter/App Store Connect, starting with
internal testing/TestFlight before production release.

Complete the store listing, screenshots, support and privacy-policy URLs, school
data disclosures and review credentials using the organization's actual policies.
Reviewers must be able to access a non-production school account. The included
iOS privacy manifest records filesystem timestamp access for document sharing;
it does not replace App Store privacy or Google Play Data Safety declarations.

References: [Capacitor environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup),
[Google Play deployment](https://capacitorjs.com/docs/android/deploying-to-google-play),
[App Store deployment](https://capacitorjs.com/docs/ios/deploying-to-app-store).
