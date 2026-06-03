# Native iOS App Store Readiness

Scope: native Swift iOS target `ios/App/App.xcodeproj`, bundle identifier `com.africandatalayer.app`, Xcode 26.

## Release Gate

- Release builds are agent-only for the first App Store candidate. `AppReleaseMode` uses the absence of `DEBUG` to normalize navigation to the field-agent routes: map, capture, queue, and profile.
- Debug builds keep the demo role picker and profile role switching so admin/client placeholders remain available for development and parity testing.
- App Store/TestFlight reviewer credentials must be field-agent credentials. Do not include admin or client workflows in reviewer instructions until the native dashboards are complete.
- Native admin/client dashboards are known incomplete surfaces and must remain hidden from App Store builds.

## Readiness Checklist

### Xcode 26 Build and Archive

- [ ] Select full Xcode 26 with `xcode-select` before archive verification.
- [ ] Install the matching iOS 26 platform and simulator components from Xcode Settings > Components.
- [ ] Open `ios/App/App.xcodeproj` on branch `ios`.
- [ ] Confirm Release has no `DEBUG` Swift active compilation condition.
- [ ] Confirm bundle id `com.africandatalayer.app`, version, build number, signing team, and App Store distribution profile.
- [ ] Archive the App target with the Release configuration.
- [ ] Validate the archive and resolve App Store Connect privacy manifest, signing, or export warnings.

### Real-Device QA

- [ ] Test on at least one physical iPhone using a field-agent account.
- [ ] Verify sign in, map load, current-location permission, manual map-center capture, selected-point enrichment, camera capture, photo-library fallback, offline queueing, and sync.
- [ ] Confirm Release navigation shows only Map, Capture, Queue, and Profile.
- [ ] Confirm Release has no demo role picker and no profile role picker.
- [ ] Confirm admin/client placeholder tabs are not reachable in the Release archive.
- [ ] Repeat the main capture path with intermittent connectivity and after app background/foreground.

### TestFlight

- [ ] Upload the validated Release archive to TestFlight.
- [ ] Complete beta app metadata, export compliance, and privacy labels.
- [ ] Add internal testers who can verify the field-agent workflow on real devices.
- [ ] Record build number, uploaded archive date, tested device model, iOS version, API environment, and reviewer demo account used.

### Screenshots

- [ ] Capture App Store screenshots for required device sizes.
- [ ] Use only shipped Release surfaces: map, capture form, offline queue/status, and profile/progress.
- [ ] Avoid screenshots of admin review, agent performance, client delta, or analytics placeholders.

### Demo Credentials and Review Notes

- [ ] Create or confirm a review-safe field-agent demo account.
- [ ] Confirm the demo account can submit in the documented test geography.
- [ ] Include credentials, target geography, and sample workflow in App Review notes: sign in, open map, create or enrich a point, attach evidence, queue offline if needed, and sync.
- [ ] Do not provide admin/client demo credentials for this candidate.

### Known Blockers

- [ ] Full Xcode 26 build/archive verification is blocked until the matching iOS 26.5 platform/simulator runtime is installed. Xcode 26 ships the iOS 26.5 SDK, but only the iOS 26.4 simulator runtime is present, so `xcodebuild` cannot resolve a simulator destination and falls back to the "Any iOS Device" placeholder. Install the runtime from Xcode > Settings > Components (or run `xcodebuild -downloadPlatform iOS` in a privileged terminal — it is a no-op under a sandboxed/non-interactive shell). Track follow-up in `africandatalayer-723`.
- Status (2026-06-03): all native Swift sources compile clean via whole-module `swiftc -c -wmo` against `iphonesimulator26.5`; `Info.plist` and `PrivacyInfo.xcprivacy` pass `plutil -lint`. The remaining gap is solely the device/simulator archive, which depends on the runtime install above.
- [ ] Native admin/client dashboards are placeholders and are intentionally gated out of Release. Track parity work in `africandatalayer-g4a`.
- [ ] Production or review-safe API availability, support URL, privacy policy URL, terms URL, and demo account readiness must be confirmed before App Review submission.

## Required Setup

- Enroll or confirm access to the Apple Developer Program team used for African Data Layer.
- In Xcode, open `ios/App/App.xcodeproj` on branch `ios` and confirm the App target uses bundle id `com.africandatalayer.app`.
- Configure signing for Release with the production Apple Developer team and an App Store distribution profile.
- Confirm `ios/App/App/PrivacyInfo.xcprivacy` is included in the App target Resources build phase.
- Keep `Info.plist` permission prompts aligned with the current field workflow:
  - Camera: photographing infrastructure points for geolocated submissions.
  - Location When In Use: attaching GPS coordinates and validating authorized collection zones.
  - Photo Library: attaching existing photos when capture is not required.

## Privacy Labels

Use App Store Connect privacy labels that match the shipped build and backend configuration:

- Location: precise location collected for app functionality, linked to the contributor account or submission, not used for tracking.
- User Content: photos or videos collected for app functionality, linked to the contributor account or submission, not used for tracking.
- Contact Info: email address, phone number, and name collected for authentication/account functionality, linked to the contributor account, not used for tracking. Phone number must remain disclosed while credentials auth accepts phone identifiers.
- Identifiers: user ID/account identifier collected for authentication, contributor profile, and submission ownership, linked to the contributor account, not used for tracking.
- Additional account data: disclose phone number or any other contact/account/profile fields if the shipped production auth or contributor profile flow collects them.
- Diagnostics and analytics: disclose crash data, performance data, product interaction, or analytics only if enabled in the native build or bundled SDKs.
- Tracking: leave disabled unless a future build shares data with third parties for advertising or cross-app tracking.

The privacy manifest currently declares precise location, photos/videos, email address, phone number, user ID, name, device ID, and `UserDefaults` required-reason API access for app-only storage (`CA92.1`). App Store Connect privacy labels must mirror the exact auth/profile fields and collection behavior in the shipped build. If native code starts collecting additional data or using additional Apple required-reason API categories, update the manifest before TestFlight upload.

## TestFlight Checklist

- Build and archive with Xcode 26 using the Release configuration.
- Validate the archive and resolve any App Store Connect privacy manifest warnings before distribution.
- Upload to TestFlight and complete beta app metadata.
- Smoke test on at least one physical iPhone with camera, location permission, and intermittent network coverage.
- Capture screenshots for the active device sizes required by App Store Connect, showing only the shipped agent surfaces: map, field capture, offline queue/status, and contributor progress states.

## App Review Notes

Include concise reviewer notes:

- African Data Layer is a field data capture app for mapping and verifying real-world infrastructure.
- GPS is requested only while the app is in use so submissions can include coordinates and collection-zone checks.
- Camera and photo library access support evidence photos for submitted infrastructure points.
- Offline queueing stores draft submission state locally and syncs via network requests when connectivity returns.
- Provide demo contributor credentials, target test geography, and a short sample workflow: sign in, open map, create a field submission, attach photo, submit or queue offline, then view status.

## Prerequisites Before App Review

- Production or review-safe API environment is reachable from Apple review networks.
- Demo account has permission to submit in a known test collection zone.
- Any seeded sample data is non-sensitive and safe for public reviewer access.
- Support, privacy policy, and terms URLs in App Store Connect point to current published documents.
- Version, build number, screenshots, age rating, export compliance, and privacy labels are complete before submitting for review.
