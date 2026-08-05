# Getting Toci Premium live on the App Store

Everything code-side is done: real StoreKit 2 purchases via `expo-iap`
(`mobile/src/app/subscription.tsx`), and real server-side verification
against Apple's App Store Server API (`app/toci/apple_iap.py`), using
Apple's own official `app-store-server-library` so the cryptography is
Apple's, not a homegrown implementation of it.

None of it can go live without steps only you can do — they need your own
Apple Developer Program membership. This is the exact sequence.

## 1. Apple Developer Program ($99/yr)

Sign up at [developer.apple.com/programs](https://developer.apple.com/programs/)
if you haven't already. This can take anywhere from a few hours to a day or
two for identity verification, especially for a first-time enrollment —
start this first, everything else is blocked on it.

## 2. Register the app in App Store Connect

1. [App Store Connect](https://appstoreconnect.apple.com) → **Apps** → **+** → **New App**.
2. Bundle ID: register `com.toci.app` (or your own — if you change it, update
   `mobile/app.json`'s `ios.bundleIdentifier` and `android.package` to match,
   and `APPLE_BUNDLE_ID` below).
3. Fill in the required metadata: name, primary language, SKU, category.

## 3. Create the subscription product

1. In your app's App Store Connect page → **Monetization** → **Subscriptions**.
2. Create a **Subscription Group** (e.g. "Toci Premium").
3. Add an auto-renewable subscription inside it:
   - **Product ID**: `com.toci.app.premium_monthly` — this must match
     exactly. It's hardcoded in two places that have to agree, since this
     repo has no shared config file between the backend and the app:
     - `app/toci/apple_iap.py` → `PRODUCT_ID_MONTHLY`
     - `mobile/src/app/subscription.tsx` → `PRODUCT_ID`
   - **Price**: $6.99/mo (or your local-currency equivalent tier).
   - Fill in the required subscription display name, description, and
     review screenshot (Apple requires this for the *first* IAP review even
     though it's not a screen with real content yet — a screenshot of the
     `/subscription` screen in this repo works).

## 4. Generate an App Store Connect API key

This is what lets the backend call Apple's App Store Server API to verify
purchases.

1. App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API**.
2. Generate a key with the **App Manager** role (or a narrower custom role
   that includes App Store Server API access).
3. Download the `.p8` private key file **immediately** — Apple only lets you
   download it once.
4. Note the **Key ID** and **Issuer ID** shown on that page.

Set these as environment variables wherever the backend runs:

```
APPLE_ISSUER_ID=<issuer id from step 4>
APPLE_KEY_ID=<key id from step 4>
APPLE_PRIVATE_KEY_PATH=/path/to/the/downloaded/.p8/file
APPLE_BUNDLE_ID=com.toci.app
APPLE_ENVIRONMENT=Sandbox
```

(`APPLE_ENVIRONMENT=Production` once you're actually live — keep it on
`Sandbox` through all of TestFlight/Sandbox testing below.)

**Never commit the `.p8` file or these values to git.** Keep the file
outside the repo, or if it must live inside it, add its exact path to
`.gitignore` the same way `app/.encryption_key` already is.

## 5. Download Apple's public root certificate

`SignedDataVerifier` needs Apple's own root CA to verify signed transactions
came from Apple. This sandbox couldn't reach `apple.com` to fetch it for
you — download it yourself:

1. Go to [apple.com/certificateauthority](https://www.apple.com/certificateauthority/).
2. Download **Apple Root CA - G3** (the `.cer` file App Store Server API
   transactions are signed against).
3. Set `APPLE_ROOT_CA_PATH` to wherever you save it — same
   don't-commit-it caveat as the private key (this one's public, so
   committing it isn't a security problem, but keeping all Apple config in
   one non-repo location is simpler to rotate later).

## 6. Configure the App Store Server Notifications webhook

So subscription renewals, cancellations, and refunds update Toci even when
the user never reopens the app:

1. App Store Connect → your app → **App Information** → **App Store Server Notifications**.
2. Set the **Production Server URL** and **Sandbox Server URL** to:
   `https://<your-deployed-backend>/api/subscription/app-store-notifications`
   (this needs the backend deployed somewhere Apple's servers can reach —
   not `localhost`).
3. Version: **Version 2** (the only version this backend implements).

## 7. A real signed build (Expo Go won't work for this feature)

`expo-iap` and `react-native-maps` are native modules — they explicitly don't
run in Expo Go or even a generic Expo Dev Client without the module baked in.
That means a real native build is required to test (or ship) either the
subscription flow or the outdoor-run map.

**Building locally on this dev Mac (2017 MacBook Pro, macOS 13.7.8) is not
possible** — confirmed 2026-08-04. This Expo SDK's React Native version
requires Xcode 16.1+ (`node_modules/react-native/scripts/cocoapods/helpers.rb`
→ `min_xcode_version_supported`), and Xcode 16.x requires macOS 14.5+
(Sonoma or later). macOS 13.7.8 is the last version this specific Mac's
hardware supports — there's no local fix, not even a from-source Xcode
install (Xcode itself has the same macOS floor).

**The real path is EAS Build** — Expo's cloud build service compiles the iOS
app on Expo's own macOS build servers, so the machine kicking off the build
never needs Xcode installed at all. This works from *any* machine (this Mac,
a Windows laptop, anything with Node.js):

```bash
cd mobile
npx eas login              # one-time, needs an Expo account (free) -- not yet created as of 2026-08-04
npx eas init                # creates the project on expo.dev if not already done
npx eas build --platform ios --profile development   # for a testable dev-client build
# once ready for the store:
npx eas build --platform ios --profile production
```

`mobile/eas.json` already has `development` / `preview` / `production`
profiles defined (from earlier CI/build setup) — no new config needed there.

**Status as of 2026-08-04**: no Expo account exists yet — this is the very
next blocking step. Once logged in, `eas build` needs no further local
environment work; CocoaPods problems on this Mac (also solved that day —
see below) only matter for local `expo run:ios`, which is no longer the
plan.

<details>
<summary>If a local build is ever attempted again on a capable Mac</summary>

This Mac's system Ruby (2.6.0, macOS-bundled) can't build CocoaPods' native
extensions (`nkf` gem fails against the installed Xcode SDK), and
`brew install cocoapods` pulls in llvm/rust as dependencies with no
precompiled bottles on macOS 13, meaning a 30-60+ min source compile. The
fix that worked: use Homebrew's own bundled portable Ruby instead of both —
`/usr/local/Homebrew/Library/Homebrew/vendor/portable-ruby/<version>/bin/gem
install cocoapods --no-document --user-install`, then symlink that same
portable `ruby` binary into `~/.gem/ruby/<version>/bin/` so the generated
`pod` shim script (which assumes `ruby` lives alongside it) resolves
correctly. No compilation needed since `ffi`'s native extension ships as a
precompiled `x86_64-darwin` gem. This gets `pod install` itself working —
it just doesn't solve the separate, unfixable Xcode-version wall above.

</details>

## 8. Test with a Sandbox account before going live

1. App Store Connect → **Users and Access** → **Sandbox** → **Testers** →
   create a test Apple ID (use a real, never-before-used email address —
   Apple doesn't support reusing an existing Apple ID as a Sandbox tester).
2. Install the development build from step 7 on a real device (Sandbox
   purchases don't work in the Simulator for real StoreKit 2 flows).
3. Sign into the Sandbox tester account: device **Settings → App Store →
   Sandbox Account** (not your regular Apple ID).
4. Open the app, go to Profile → Account → Toci Premium, tap Subscribe.
   Sandbox subscriptions renew on an accelerated clock (a "monthly"
   subscription renews every few minutes) — useful for testing the renewal
   webhook without waiting a real month.
5. Confirm: purchase unlocks Ask Toci / adaptive coaching / photos
   immediately, `is_premium` in `/api/subscription/status` flips to `true`,
   and — after a Sandbox renewal fires — the webhook updates
   `subscription_expires_at` without you reopening the app.

## 9. Submit for App Review

Once Sandbox testing confirms the whole loop works:

1. Fill in the rest of App Store Connect's required metadata: screenshots,
   description, privacy policy URL, support URL, age rating, App Privacy
   details (what data Toci collects — see `app/README.md`'s "what's real
   here" section for an honest accounting).
2. Submit the build from step 7 (`production` profile) for review.
3. First-time IAP submissions commonly get bounced for missing subscription
   terms/privacy-policy links in the app itself, or a reviewer not being
   able to find the subscription flow — make sure Profile → Account → Toci
   Premium is easy to find, and that the disclosure text already in
   `subscription.tsx` (price, renewal terms, cancellation instructions)
   stays visible on that screen, since Apple explicitly checks for it.

## What's still a known gap after all of this

- **No user accounts.** This is still a single hardcoded demo user
  (`DEMO_USER_ID` in `app/toci/main.py`) — every purchase currently applies
  to that one user record, not to whichever person is signed into the app.
  Shipping to real, multiple users needs an auth system before the paywall
  means anything per-user.
- **Android/Play Store isn't built.** Everything above is iOS/App Store
  only. `expo-iap` supports Android too, and the backend's
  `subscription_platform` field is ready for an `"android"` value, but the
  Play Billing verification path (`app-store-server-library` is Apple-only;
  Android needs the Google Play Developer API instead) hasn't been written.
