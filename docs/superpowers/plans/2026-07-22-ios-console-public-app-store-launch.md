# ADL Console Public App Store Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the exact M0–M2-proven build through invited TestFlight cohorts and App Review into an invitation-only public iPhone listing for approved English- and French-speaking African storefronts.

**Architecture:** Product localization and invitation-only onboarding ship in the binary; versioned metadata, screenshots, review notes, privacy/storefront matrices, and release evidence live under `docs/app-store/`. Human App Store Connect actions consume those artifacts and must record exports/checksums so metadata cannot outrun tested behavior.

**Tech Stack:** SwiftUI String Catalogs, XCTest/XCUITest, App Store Connect, TestFlight, Greenlight, Apple App Analytics.

**Spec:** `docs/superpowers/specs/2026-07-22-ios-console-public-app-store-launch-design.md`

## Global Constraints

- Tracking issue: `africandatalayer-crw`; start only after M0–M2 evidence says GO.
- Public distribution, iPhone-only, portrait, iOS 17+, invitation-only; no signup, organization creation, IAP, advertising, tracking, social login, or Sign in with Apple in v1.
- Name: `ADL Console: Data Ops`; subtitle: `Capture, review, manage data`; both are within Apple's current 30-character limits but name availability must be confirmed before production.
- Primary category Business; secondary category Productivity.
- English and French receive real binary localization, metadata, screenshots, support, privacy, release notes, review notes, and accessibility validation.
- Use only product behavior and seeded non-sensitive content from the exact release candidate.
- Before submission, recheck current App Review Guidelines, App Store availability, metadata limits, and screenshot dimensions against Apple documentation linked at the end of this plan.

---

### Task 1: Ship invitation-only EN/FR onboarding and support access

**Files:**
- Create: `ios-console/ADLConsole/Localizable.xcstrings`
- Modify: `ios-console/ADLConsole/Shell/RootView.swift`
- Modify: `ios-console/ADLConsole/Auth/AuthView.swift`
- Create: `ios-console/ADLConsole/Support/SupportLinks.swift`
- Create: `ios-console/ADLConsoleTests/InvitationOnboardingTests.swift`
- Create: `ios-console/ADLConsoleUITests/InvitationOnboardingUITests.swift`

**Interfaces:**
- Produces: localized keys `onboarding.invited.body`, `auth.invited.help`, `action.sign_in`, `action.contact_support`, `action.privacy`; `SupportLinks.privacy` and `.support`.

- [ ] **Step 1: Write failing onboarding assertions**

```swift
func testSignedOutScreenHasNoSignupAndWorkingHelpLinks() {
    let model = InvitationOnboardingModel(locale: Locale(identifier: "fr"))
    XCTAssertEqual(model.body, "ADL Console est réservé aux membres invités d’une organisation African Data Layer.")
    XCTAssertFalse(model.actions.map(\.identifier).contains("create-account"))
    XCTAssertEqual(model.actions.map(\.identifier), ["sign-in", "contact-support", "privacy"])
    XCTAssertEqual(model.supportURL.scheme, "https")
    XCTAssertEqual(model.privacyURL.scheme, "https")
}
```

- [ ] **Step 2: Run and verify failure**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/InvitationOnboardingTests`
Expected: FAIL because the model/catalog/links are missing.

- [ ] **Step 3: Add exact customer-facing copy and links**

```swift
enum SupportLinks {
    static let privacy = URL(string: "https://www.africandatalayer.com/privacy")!
    static let support = URL(string: "https://www.africandatalayer.com/support")!
}
```

English body: `ADL Console is for invited members of an African Data Layer organization. Sign in with credentials supplied by your organization. Need access? Contact your organization administrator or ADL Support.` French body: `ADL Console est réservé aux membres invités d’une organisation African Data Layer. Connectez-vous avec les identifiants fournis par votre organisation. Besoin d’un accès ? Contactez votre administrateur ou l’assistance ADL.` Provide only Sign in, Contact support, and Privacy actions; remove any signup implication.

- [ ] **Step 4: Run EN/FR UI and link tests**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/InvitationOnboardingTests -only-testing:ADLConsoleUITests/InvitationOnboardingUITests`
Expected: both locales pass at accessibility text sizes; links open HTTPS URLs; no Create account control exists.

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/Localizable.xcstrings ios-console/ADLConsole/Shell/RootView.swift ios-console/ADLConsole/Auth/AuthView.swift ios-console/ADLConsole/Support/SupportLinks.swift ios-console/ADLConsoleTests/InvitationOnboardingTests.swift ios-console/ADLConsoleUITests/InvitationOnboardingUITests.swift
git commit -m "feat: add invitation only localized onboarding"
```

---

### Task 2: Version exact English and French metadata

**Files:**
- Create: `docs/app-store/v1/en-US.md`
- Create: `docs/app-store/v1/fr-FR.md`
- Create: `docs/app-store/v1/metadata.json`
- Create: `ios-console/Scripts/lint_app_store_metadata.swift`

**Interfaces:**
- Produces: validated localized name, subtitle, promotional text, description, keywords, support/privacy URLs, and release notes.

- [ ] **Step 1: Write the failing metadata linter fixture**

```swift
import Foundation

struct AppStoreMetadata: Decodable {
    struct Localization: Decodable { let name: String; let subtitle: String; let keywords: String; let description: String }
    let localizations: [String: Localization]
}

let metadata = try JSONDecoder().decode(AppStoreMetadata.self, from: Data(contentsOf: URL(fileURLWithPath: "docs/app-store/v1/metadata.json")))
precondition(metadata.localizations.keys.sorted() == ["en-US", "fr-FR"])
for item in metadata.localizations.values {
    precondition((2...30).contains(item.name.count))
    precondition(item.subtitle.count <= 30)
    precondition(item.keywords.count <= 100)
    precondition(item.description.count <= 4_000)
    precondition(item.description.localizedCaseInsensitiveContains("invited" ) || item.description.localizedCaseInsensitiveContains("invités"))
}
```

- [ ] **Step 2: Run and verify failure**

Run: `swift ios-console/Scripts/lint_app_store_metadata.swift`
Expected: FAIL because metadata files do not exist.

- [ ] **Step 3: Add complete v1 metadata**

English description:

```text
Turn field observations into trustworthy data operations.

COLLECT
Capture structured infrastructure observations with GPS and photo evidence. Keep pending work recoverable when connectivity is interrupted and see exactly when data is pending, syncing, blocked, or up to date.

REVIEW
Inspect submitted evidence, focus on records that need attention, and make authorized review decisions with clear quality context.

MANAGE
Organize projects and published schemas, manage invited members and roles, and keep operational access aligned with your organization.

ADL Console is available only to invited members of an African Data Layer organization. The app does not create public accounts or organizations. Contact your organization administrator or ADL Support if you need access.

Available in English and French. Privacy and support information is accessible before sign-in.
```

French description:

```text
Transformez les observations terrain en opérations de données fiables.

COLLECTER
Saisissez des observations structurées avec preuves GPS et photo. Conservez le travail en attente lorsque la connexion est interrompue et voyez clairement si les données sont en attente, en synchronisation, bloquées ou à jour.

RÉVISER
Examinez les preuves soumises, concentrez-vous sur les relevés qui nécessitent une action et prenez des décisions autorisées avec un contexte qualité clair.

GÉRER
Organisez les projets et schémas publiés, gérez les membres invités et leurs rôles, et alignez les accès opérationnels de votre organisation.

ADL Console est réservé aux membres invités d’une organisation African Data Layer. L’application ne crée pas de compte public ni d’organisation. Contactez votre administrateur ou l’assistance ADL pour demander un accès.

Disponible en anglais et en français. Les informations de confidentialité et d’assistance sont accessibles avant la connexion.
```

English keywords: `field data,infrastructure,mapping,audit,review,offline,Africa,operations,GIS,evidence`; French keywords: `données terrain,infrastructure,cartographie,audit,révision,hors ligne,Afrique,SIG,preuves`. Release notes: `Initial public release for invited African Data Layer organizations, with field capture, evidence review, role-based administration, recoverable offline work, and English/French support.` / `Première version publique destinée aux organisations African Data Layer invitées : collecte terrain, révision des preuves, administration par rôle, travail hors ligne récupérable et prise en charge anglais/français.`

- [ ] **Step 4: Run metadata lint**

Run: `swift ios-console/Scripts/lint_app_store_metadata.swift`
Expected: exit 0; both names/subtitles <=30, keywords <=100, descriptions <=4,000, URLs HTTPS, and invitation-only copy present.

- [ ] **Step 5: Commit**

```bash
git add docs/app-store/v1 ios-console/Scripts/lint_app_store_metadata.swift
git commit -m "docs: add bilingual app store metadata"
```

---

### Task 3: Produce the balanced six-frame screenshot system

**Files:**
- Create: `docs/app-store/v1/screenshots/manifest.json`
- Create: `ios-console/ADLConsoleUITests/AppStoreScreenshotTests.swift`
- Create: `ios-console/Scripts/capture_app_store_screenshots.sh`
- Create: `ios-console/Scripts/lint_app_store_screenshots.swift`
- Output: `docs/app-store/v1/screenshots/en-US/*.png`
- Output: `docs/app-store/v1/screenshots/fr-FR/*.png`

**Interfaces:**
- Produces: six ordered portrait PNGs per locale at an Apple-accepted 6.9-inch size, without alpha or sensitive data.

- [ ] **Step 1: Add failing manifest assertions**

```swift
import Foundation

struct ScreenshotManifest: Decodable {
    struct Frame: Decodable { let id: String }
    let locales: [String]
    let frames: [Frame]
    let width: Int
    let height: Int
    static func load(_ path: String) throws -> Self { try JSONDecoder().decode(Self.self, from: Data(contentsOf: URL(fileURLWithPath: path))) }
}

let manifest = try ScreenshotManifest.load("docs/app-store/v1/screenshots/manifest.json")
precondition(manifest.locales == ["en-US", "fr-FR"])
precondition(manifest.frames.map(\.id) == ["operation", "capture", "review", "manage", "recover", "bilingual"])
precondition(manifest.width == 1_320 && manifest.height == 2_868)
```

- [ ] **Step 2: Run and verify failure**

Run: `swift ios-console/Scripts/lint_app_store_screenshots.swift`
Expected: FAIL because manifest/assets do not exist.

- [ ] **Step 3: Implement deterministic screenshot capture**

Seed a fictional `Kivu Infrastructure Demo` organization with no real people, clients, credentials, or coordinates. Capture frames in this exact order: operation overview/map; schema capture with GPS/photo and honest Pending status; reviewer evidence/decision; projects/schemas/member roles; Pending/Retrying/Blocked recovery; genuine French localized role surface. Use XCUITest attachments and `simctl io`/image processing only for framing; never fabricate controls or data.

- [ ] **Step 4: Capture and lint all assets**

Run: `bash ios-console/Scripts/capture_app_store_screenshots.sh && swift ios-console/Scripts/lint_app_store_screenshots.swift`
Expected: 12 PNGs, 1,320×2,868 portrait, no alpha, ordered manifest hashes, zero prohibited fixture terms, and both locales complete.

- [ ] **Step 5: Commit**

```bash
git add docs/app-store/v1/screenshots ios-console/ADLConsoleUITests/AppStoreScreenshotTests.swift ios-console/Scripts/capture_app_store_screenshots.sh ios-console/Scripts/lint_app_store_screenshots.swift
git commit -m "docs: produce balanced app store screenshots"
```

---

### Task 4: Build the privacy, storefront, and review package

**Files:**
- Create: `docs/app-store/v1/privacy-matrix.md`
- Create: `docs/app-store/v1/storefronts.md`
- Create: `docs/app-store/v1/review-notes-en.md`
- Create: `docs/app-store/v1/review-notes-fr.md`
- Create: `docs/app-store/v1/review-smoke.md`

**Interfaces:**
- Produces: reconciled privacy answers, exact storefront selection, three-role review credentials procedure, and six-journey smoke.

- [ ] **Step 1: Reconcile the privacy matrix against binary behavior**

Record email address, precise/coarse location, photos/videos, and other user content as linked to the account where applicable, used for app functionality, and not tracking. Cross-check `PrivacyInfo.xcprivacy`, App Privacy answers, public privacy policy, backend retention/deletion support, notifications, MetricKit/OSLog, and required-reason APIs; each row records `binary evidence`, `store answer`, `policy section`, and `owner`.

- [ ] **Step 2: Establish and verify the African storefront candidate set**

Use Specific Countries or Regions. Candidate English/French markets: Algeria, Benin, Botswana, Burkina Faso, Burundi, Cameroon, Central African Republic, Chad, Comoros, Côte d’Ivoire, Democratic Republic of the Congo, Djibouti, Eswatini, Gabon, Gambia, Ghana, Guinea, Kenya, Lesotho, Liberia, Madagascar, Malawi, Mali, Mauritania, Mauritius, Morocco, Namibia, Niger, Nigeria, Republic of the Congo, Rwanda, Senegal, Seychelles, Sierra Leone, South Africa, Tanzania, Togo, Tunisia, Uganda, Zambia, and Zimbabwe. In `storefronts.md`, mark a country `selected` only after it appears as available in the current App Store Connect selector and product/support ownership confirms English or French service coverage; record the dated App Store Connect export.

- [ ] **Step 3: Write exact review instructions**

Review notes state public distribution but invited access; provide collector/reviewer/admin credentials stored only in App Store Connect; list fresh-install sign-in and six screenshot journeys; explain airplane-mode Pending demonstration and reconnect; confirm live backend; state no signup, IAP, ads, tracking, social login, or public account creation; provide a named release contact in the secure App Store Connect field, not the repository.

- [ ] **Step 4: Run package checks**

Run: `greenlight preflight ios-console --exit-code && curl --fail --location --silent --show-error https://www.africandatalayer.com/privacy >/dev/null && curl --fail --location --silent --show-error https://www.africandatalayer.com/support >/dev/null && rg -n 'collector|reviewer|administrator|offline|no signup|live backend' docs/app-store/v1/review-notes-en.md`
Expected: Greenlight and URL checks pass; every review concept is present.

- [ ] **Step 5: Commit**

```bash
git add docs/app-store/v1/privacy-matrix.md docs/app-store/v1/storefronts.md docs/app-store/v1/review-notes-en.md docs/app-store/v1/review-notes-fr.md docs/app-store/v1/review-smoke.md
git commit -m "docs: assemble app review package"
```

---

### Task 5: Run internal and external invited TestFlight gates

**Files:**
- Create: `docs/app-store/v1/testflight-plan.md`
- Create: `docs/release/evidence/m3-testflight.md`
- Modify: `ios-console/RELEASE.md`

**Interfaces:**
- Produces: exact build cohort assignment, seven-day defect ledger, and M3 GO/NO-GO.

- [ ] **Step 1: Validate the exact archive and upload identity**

Run: `xcodebuild -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -configuration Release -showBuildSettings | rg 'PRODUCT_BUNDLE_IDENTIFIER|MARKETING_VERSION|CURRENT_PROJECT_VERSION|TARGETED_DEVICE_FAMILY'`
Expected: production bundle, intended version/build, and device family `1`.

- [ ] **Step 2: Complete internal TestFlight**

Assign 5–10 trained internal testers across all roles. Each completes capture, offline/reconnect, blocked recovery, review, administration, sign-out/reauthentication, EN/FR, notification denial, camera denial, and photo-library cancellation; record tester role/device/OS/result without credentials or captured content.

- [ ] **Step 3: Complete external invited TestFlight**

Use a controlled cohort representing all roles and a limited non-sensitive operational project. Run seven consecutive dated checks. Any open/new reproducible Sev-1 or Sev-2 resets the seven-day counter after a fixed build is deployed.

- [ ] **Step 4: Decide M3**

Run: `rg -n '^Day [1-7]: PASS$|^Open Sev-1: 0$|^Open Sev-2: 0$|^M3 decision: GO$' docs/release/evidence/m3-testflight.md`
Expected: seven PASS lines, zero open critical severities, and GO on the exact build.

- [ ] **Step 5: Commit**

```bash
git add docs/app-store/v1/testflight-plan.md docs/release/evidence/m3-testflight.md ios-console/RELEASE.md
git commit -m "docs: record ios testflight launch gate"
```

---

### Task 6: Submit, manually release, monitor, and baseline optimization

**Files:**
- Create: `docs/app-store/v1/submission-checklist.md`
- Create: `docs/release/evidence/m4-public-launch.md`
- Create: `docs/app-store/v1/post-launch-baseline.md`

**Interfaces:**
- Consumes: exact M3 GO build and versioned launch assets.
- Produces: App Review result, manual phased release decision, rollback owner, and App Analytics baseline.

- [ ] **Step 1: Upload metadata/assets and run the fresh-install review smoke**

Select public distribution, Specific Countries or Regions from the verified storefront file, English primary plus French localization, six screenshots per locale, manual release, and the exact build. Run every review-note step for all three accounts immediately before submission; record result and UTC timestamp.

- [ ] **Step 2: Submit only if mutable Apple rules still match**

Record the date/version of App Review Guidelines, App Store availability count, name/subtitle/keyword limits, screenshot specification, account-creation/deletion interpretation, privacy answers, encryption answer, age rating, and review credential check. A mismatch produces `Submission decision: HOLD` and a Beads issue.

- [ ] **Step 3: Handle approval with manual phased release**

After approval, the owner records `Owner decision: RELEASE`, manually releases, enables phased release for automatic updates where available, and confirms storefront statuses. A Sev-1 triggers immediate pause/removal-from-sale decision and the rollback runbook.

- [ ] **Step 4: Record baseline and operating ownership**

At launch and after 7/14/30 days record impressions, product-page views, conversion, first-time downloads, retention/crashes where Apple exposes them, support volume/themes, and review themes. Do not start Product Page Optimization until sample size is adequate; first test changes only the lead screenshot/order.

- [ ] **Step 5: Commit final evidence**

```bash
git add docs/app-store/v1/submission-checklist.md docs/release/evidence/m4-public-launch.md docs/app-store/v1/post-launch-baseline.md
git commit -m "docs: record ios public launch decision"
```

## Apple sources to verify at submission

- [App information limits](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)
- [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Manage App Store availability](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-for-your-app-on-the-app-store)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Localize app information](https://developer.apple.com/help/app-store-connect/manage-app-information/localize-app-information)
- [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
