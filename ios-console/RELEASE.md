# ADL Console — App Store submission checklist

Status snapshot as of this task: the app builds and tests green
(`ADLConsole.xcodeproj`, XcodeGen'd from `project.yml`) and has icon,
versioning, and privacy-manifest config in place. **Nothing has been
signed, archived, or uploaded** — every step below that needs an Apple
Developer account is marked `TODO (human, Apple account)` and was
intentionally left undone by this task.

## 0. Prerequisites (human, Apple account)

- [ ] `TODO (human, Apple account)` — Apple Developer Program membership
      for African Data Layer (or whichever legal entity owns the
      distribution), active and in good standing.
- [ ] `TODO (human, Apple account)` — an App ID registered for
      `com.africandatalayer.console` in the Apple Developer portal.
- [ ] `TODO (human, Apple account)` — a distribution certificate + an
      App Store provisioning profile for that App ID (or let Xcode
      "Automatically manage signing" generate them once a team is
      selected — see step 2).
- [ ] `TODO (human, Apple account)` — an App Store Connect app record
      created for bundle id `com.africandatalayer.console`, with a
      unique app name reserved (e.g. "ADL Console").

## 1. Bump build number

Every new build uploaded to App Store Connect (including TestFlight
builds) needs a `CURRENT_PROJECT_VERSION` (`CFBundleVersion`) higher
than the last uploaded build, even across the same
`MARKETING_VERSION`. This project pins both in `project.yml` under
`targets.ADLConsole.settings.base`:

```yaml
MARKETING_VERSION: "1.0.0"    # CFBundleShortVersionString — bump for user-facing releases
CURRENT_PROJECT_VERSION: "1"  # CFBundleVersion — bump for every build upload, even patch/TestFlight
```

To bump: edit `project.yml`, then regenerate the project —

```sh
cd ios-console
xcodegen generate
```

— and commit both `project.yml` and the regenerated `ADLConsole.xcodeproj`.

## 2. Select signing team (`TODO (human, Apple account)`)

1. Open `ios-console/ADLConsole.xcodeproj` in Xcode.
2. Select the `ADLConsole` target → **Signing & Capabilities**.
3. Check **Automatically manage signing**, then pick the Apple
   Developer team for the `com.africandatalayer.console` bundle id
   from the **Team** dropdown.
4. Repeat for the `ADLConsoleTests` target if Xcode flags it (test
   bundles usually don't need distribution signing, only a local
   development identity).

This step requires an Apple Developer account signed into Xcode and is
**not something this task attempted** — no credentials were available
or should be entered by an automated agent.

## 3. Archive

1. In Xcode, set the run destination to **Any iOS Device (arm64)**
   (archiving is not available for a simulator destination).
2. `Product` → `Archive`.
3. Wait for the build to finish; the Organizer window
   (`Window` → `Organizer` → `Archives`) opens automatically with the
   new archive selected.

Command-line equivalent (still requires a signing team selected in
step 2 — this will fail with no signing identity available otherwise):

```sh
xcodebuild -project ADLConsole.xcodeproj -scheme ADLConsole \
  -configuration Release -archivePath build/ADLConsole.xcarchive archive
```

## 4. Validate

In the Organizer, with the new archive selected:

1. Click **Validate App**.
2. Choose the distribution method: **App Store Connect**.
3. Accept the default signing/distribution options (automatic signing
   should already match step 2's team).
4. Let validation run — it checks bundle structure, entitlements,
   Info.plist keys (including the `ITSAppUsesNonExemptEncryption` /
   privacy-manifest keys this task added), and icon assets against
   App Store Connect's rules before anything uploads.
5. Fix and re-archive if validation reports issues; re-run this step
   until it passes clean.

## 5. Upload

Still in the Organizer, on the same validated archive:

1. Click **Distribute App** → **App Store Connect** → **Upload**.
2. Accept the same signing options used for validation.
3. Upload completes; the build appears under **TestFlight** /
   **App Store Connect → Builds** after Apple's processing finishes
   (usually minutes, occasionally longer).

## 6. App Store Connect metadata (`TODO (human, Apple account)`)

Before the build can be submitted for review, fill in on
[appstoreconnect.apple.com](https://appstoreconnect.apple.com):

- [ ] App name, subtitle, category (Business), and age rating
      questionnaire.
- [ ] Privacy Policy URL (required — the app collects account/email,
      location, and photo data per `ADLConsole/PrivacyInfo.xcprivacy`;
      the public-facing privacy policy needs to describe the same
      data types and purposes declared there).
- [ ] App Privacy section in App Store Connect — this is filled in
      from the same source of truth as `PrivacyInfo.xcprivacy`
      (Email Address, Precise Location, Coarse Location, Photos or
      Videos, Other User Content — all linked to identity, all for
      App Functionality only, no tracking). Keep the two in sync if
      either changes.
- [ ] Screenshots for at least one required device size (6.7" or
      6.9" iPhone at minimum; iPad screenshots if the app is
      submitted as universal/iPad-compatible).
- [ ] Support URL and marketing URL (marketing URL optional).
- [ ] Export compliance: this app uses only standard HTTPS/TLS via
      `URLSession`, no custom/proprietary encryption — `project.yml`
      already sets `ITSAppUsesNonExemptEncryption = NO`, so App Store
      Connect should not re-prompt for this during submission, but
      confirm the answer if it does ask.
- [ ] **App Review notes / demo account** — ADL Console is a
      login-gated B2B tool (org members only, no public sign-up
      flow). Reviewers cannot get in without credentials. This step
      needs:
      - [ ] `TODO (human, Apple account + platform access)` — create
            a standing demo organization + reviewer member account
            against the real platform auth (`/api/auth/csrf` →
            `/api/auth/callback/credentials` → `/api/auth/session`,
            mirroring `lib/client/auth.ts`).
      - [ ] Provide that demo login (email + password) in App Store
            Connect's **App Review Information → Sign-In Required**
            fields, plus a one-line note on what to tap first (e.g.
            "Sign in, then use the Capture tab to submit a test
            record against the Demo project").
      - [ ] Rotate/reset that demo account's password after each
            review cycle if reviewers are expected to write data.

## 7. Submit for review (`TODO (human, Apple account)`)

1. Attach the uploaded build to the version being submitted.
2. Answer the remaining App Store Connect submission questions
   (Advertising Identifier: **No**, since this app has no ad SDK).
3. Submit for review.

## M3 TestFlight Gate

See `docs/app-store/v1/testflight-plan.md` and `docs/release/evidence/m3-testflight.md`.

- **Build:** com.africandatalayer.console 1.0.0 (1)
- **Internal TestFlight:** Completed across all roles
- **External Invited TestFlight:** 7 consecutive days, all PASS, zero Sev-1/Sev-2
- **Decision:** GO

Configuration at time of gate: `TARGETED_DEVICE_FAMILY=1` (iPhone only).

## Notes

- If `project.yml`, `Assets.xcassets`, or any file under `ADLConsole/`
  changes, re-run `xcodegen generate` and commit the regenerated
  `.xcodeproj` alongside the source change — this repo's convention
  (see `README.md`) is to commit the generated project, not regenerate
  it in CI.
- Configuring signing, archiving, uploading, and App Store Connect
  metadata are human-in-the-loop steps requiring an Apple Developer
  account and are documented above.
