# Native iOS App Store Readiness

Scope: native Swift target `ios/App/App.xcodeproj`, bundle `com.africandatalayer.app`, iPhone-only, iOS 17 minimum.

Canonical submission package: `docs/app-store/ios-app/v1/`.

## Verified locally

- Xcode 26.5 simulator runtime and iPhone 17 Pro destination resolve.
- Release simulator build succeeds with `CODE_SIGNING_ALLOWED=NO`.
- Release retains the product's shipped role surfaces; App Store assets focus on contributor workflows without claiming incomplete admin/client features.
- App icon source is an opaque 1024×1024 PNG.
- Deterministic Release-mode EN/FR screenshot capture and strict 1320×2868/no-alpha validation are automated.
- `Info.plist` and `PrivacyInfo.xcprivacy` remain the build sources of truth for permission and privacy declarations.

## Owner-controlled release gates

- Validate a signed archive with the production team and distribution profile.
- Confirm support, privacy, terms, and marketing URLs in production.
- Reconcile App Store privacy answers with production backend behavior and bundled SDKs.
- Supply active reviewer credentials privately in App Store Connect and confirm a safe test geography.
- Smoke test on a physical iPhone: authentication, map, location permission, capture, evidence, offline queue, sync, background/foreground, and every shipped role surface.
- Upload metadata and localized screenshots in manifest order; use manual release until storefront verification finishes.

## Commands

```bash
ios/App/Scripts/capture_app_store_screenshots.sh
swift -module-cache-path /tmp/adl-swift-module-cache ios-console/Scripts/lint_app_store_metadata.swift docs/app-store/ios-app/v1/metadata.json
greenlight preflight ios/App
```

Do not store reviewer passwords in the repository. Do not create App Store preview footage or iOS 27 header/search creative from non-shipping mockups; use captured app states and Apple's current templates.
