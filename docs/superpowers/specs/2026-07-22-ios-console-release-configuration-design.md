# ADL Console Release Configuration Design

**Status:** Approved subproject design

**Program:** `docs/superpowers/specs/2026-07-22-ios-console-public-launch-program-design.md`

**Tracking:** `africandatalayer-61m`

## Objective

Make `project.yml` and checked-in configuration the deterministic source of truth for the iPhone-only application, environments, signing identity, versioning, privacy declarations, and generated Xcode project. Remove hard-coded production routing and stale release/auth documentation without changing the existing backend contract.

## Current problems

- `ADLConsoleApp.swift` hard-codes the production base URL.
- `project.yml` is documented as authoritative but differs from the generated project signing settings.
- The generated project targets iPhone and iPad even though public v1 is now iPhone-only.
- `README.md`, `RELEASE.md`, `PrivacyInfo.xcprivacy` comments, and `AppState` comments contain stale statements about stub/future authentication.
- No automated XcodeGen drift gate proves that source configuration and the checked-in project agree.
- No explicit Staging release channel exists for live-contract and App Review preparation.

## Scope

This subproject delivers:

- Checked-in Debug, Staging, and Release configuration files.
- `AppEnvironment` parsing and validation.
- XcodeGen configuration for build settings, schemes, bundle identity, signing, Info.plist values, and iPhone-only device family.
- Deterministic project regeneration and CI drift detection.
- Updated README, release runbook, privacy-manifest comments, and auth/app-state comments.
- Archive, validation, build-number, and TestFlight promotion instructions.
- Tests proving environment selection and safe failures.

It does not add secrets to the repository, alter the production hostname, create App Store Connect records, upload builds, or change backend behavior.

## Source-of-truth layout

The configuration design uses:

- `ios-console/project.yml`: targets, dependencies, schemes, supported platform, device family, signing style, version keys, purpose strings, privacy manifest inclusion, and configuration-file mapping.
- `ios-console/Config/Debug.xcconfig`: local/debug channel and explicit development endpoint.
- `ios-console/Config/Staging.xcconfig`: staging channel and staging HTTPS endpoint.
- `ios-console/Config/Release.xcconfig`: production channel and production HTTPS endpoint.
- `ios-console/ADLConsole/Configuration/AppEnvironment.swift`: runtime validation and typed environment values.
- `ios-console/ADLConsole.xcodeproj`: generated, checked-in artifact that must exactly reflect `project.yml` and the configuration files.

The Apple development team ID already present in the generated project is declared intentionally in the XcodeGen source rather than retained as an unexplained generated-only edit. Signing certificates and provisioning material remain in Apple/Xcode credential stores, not the repository.

## AppEnvironment contract

`AppEnvironment` exposes:

- `channel`: debug, staging, or production.
- `apiBaseURL`: an absolute HTTPS URL except for an explicitly permitted localhost Debug override.
- `bundleIdentifier`: the compiled application identifier.
- `marketingVersion` and `buildNumber`.
- Network timeout policy consumed by auth and platform transports.
- Telemetry subsystem/category prefix.

The base URL enters the generated Info.plist through `ADL_API_BASE_URL = $(ADL_API_BASE_URL)`. `ADLConsoleApp` asks `AppEnvironment` for the value and injects the same URL into `PlatformAPIClient` and `NetworkAuthService`.

Production fails fast to a safe configuration error screen if the URL is absent, malformed, non-HTTPS, or not the approved production host. It never falls back silently to production or development.

## Build configurations and schemes

The generated project contains:

- Debug configuration and `ADLConsole-Debug` run/test scheme.
- Staging configuration and `ADLConsole-Staging` run/test/archive scheme.
- Release configuration and `ADLConsole` production archive scheme.

Staging uses the production feature set with a distinct channel label and endpoint. Debug-only previews and mock transports remain compile-gated. Release contains no role switcher, mock transport, preview seed, or debug endpoint.

## Device and platform policy

- Deployment target remains iOS 17.0.
- `TARGETED_DEVICE_FAMILY` becomes `1` for the application target.
- Public v1 supports iPhone portrait orientation.
- iPad screenshots, iPad layout guarantees, and iPad App Store compatibility are removed from release documentation and metadata requirements.
- Existing iPad-specific orientation settings are removed from `project.yml` and the generated project.

## Version and build policy

- `MARKETING_VERSION` changes only for a user-facing version.
- `CURRENT_PROJECT_VERSION` increases for every uploaded build.
- CI prints and validates both values for Release candidates.
- Release notes record the commit, build number, environment, Greenlight result, archive validation result, and TestFlight cohort.

## Deterministic generation

The repository continues to check in `ADLConsole.xcodeproj`.

CI performs a clean XcodeGen regeneration and fails if `git diff --exit-code` reports changes in the generated project. Contributors modify `project.yml` or `.xcconfig` first and commit the regenerated project in the same change.

User-specific workspace state under `xcuserdata` is removed from version-control expectations and must not participate in drift checks.

## Documentation reconciliation

The following statements become explicit and consistent:

- Production app construction uses `NetworkAuthService`; `StubAuthService` exists only for deterministic tests and previews.
- Auth.js CSRF, credentials callback, session restore, local cookie clearing, and best-effort server sign-out behavior are current, not future work.
- Debug, Staging, and Production endpoints are selected by build configuration.
- Public v1 is iPhone-only and invitation-only.
- App Privacy declarations match email, location, photos/videos, other user content, and required-reason API use actually linked by the binary.
- The privacy manifest contains factual comments only; implementation-history comments are removed.
- The release runbook distinguishes automated gates from Apple-account human actions.

## Network configuration

Auth and platform transports receive an injected `URLSession` or transport policy derived from `AppEnvironment`. The policy defines request/resource timeouts and does not rely on `URLSession.shared` defaults for release behavior.

The environment layer does not introduce certificate pinning, custom TLS, or a new network abstraction beyond what is required for deterministic endpoint and timeout configuration.

## Error behavior

| Configuration failure | Behavior |
|---|---|
| Missing base URL | Safe configuration screen; no network request |
| Invalid URL | Safe configuration screen; privacy-safe diagnostic log |
| Non-HTTPS Staging/Release URL | Build/test failure and runtime safe failure |
| Production channel with unapproved host | Build/test failure and runtime safe failure |
| Missing version/build | Build gate failure |
| Generated project drift | CI failure with regeneration command |
| Signing credentials unavailable locally | Unsigned simulator tests remain available; archive gate reports the human signing prerequisite |

## Testing strategy

### Unit tests

- Parse each channel from an injected Info.plist dictionary.
- Validate HTTPS and approved production host behavior.
- Confirm both clients receive the same base URL and timeout policy.
- Confirm malformed/missing values produce the safe error state.
- Confirm Debug localhost exception cannot compile into Staging or Release.

### Generation tests

- Generate from a clean checkout and verify no diff.
- Confirm iOS 17.0 and `TARGETED_DEVICE_FAMILY = 1` in generated build settings.
- Confirm all schemes use their matching configuration files.
- Confirm the development team and automatic signing settings are present only through source configuration.

### Build and archive tests

- Build and test Debug on the supported simulator.
- Build and test Staging on the supported simulator.
- Build Release with signing disabled as a compile gate.
- Archive and validate the signed Release candidate on the release machine before TestFlight promotion.

### Documentation tests

- Search for the stale stub/future-auth claims identified by the audit and fail if they reappear.
- Validate `PrivacyInfo.xcprivacy` with `plutil` and Greenlight.
- Verify the release runbook commands match the generated scheme names.

## Acceptance gates

The subproject is complete when:

- `ADLConsoleApp.swift` contains no hard-coded environment URL.
- Debug, Staging, and Release select intentional endpoints through checked-in configuration.
- XcodeGen regeneration is deterministic in CI.
- Public Release targets iPhone only on iOS 17.0.
- Signing settings are intentional in `project.yml` and not unexplained generated drift.
- README, RELEASE, privacy-manifest comments, auth comments, and app-state comments agree with the current implementation.
- Simulator builds/tests pass for Debug and Staging; Release compile and signed archive gates are documented and exercised.
- Greenlight remains GREENLIT after regeneration.

## Dependencies and handoff

This subproject can begin after Capture Integrity names its files and package dependency changes. It provides deterministic channels and archive inputs used by Operational Readiness and Public App Store Launch.
