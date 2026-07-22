# ADL Console Public App Store Launch Design

**Status:** Approved subproject design

**Program:** `docs/superpowers/specs/2026-07-22-ios-console-public-launch-program-design.md`

**Depends on:** M0 Capture Integrity, M1 Offline Runtime, M2 Release Configuration and Operational Readiness gates

**Tracking:** `africandatalayer-crw`

## Objective

Launch ADL Console as an invitation-only, iPhone-only public App Store product in App Store-supported English- and French-speaking African countries. The listing and onboarding present collector, reviewer, and administrator journeys with equal weight, while every claim remains grounded in behavior proven by the preceding reliability milestones.

## Product positioning

### Name and subtitle

- Name: `ADL Console: Data Ops`
- Subtitle: `Capture, review, manage data`
- Primary category: Business
- Secondary category: Productivity

The name and subtitle remain within Apple's 30-character limits. Final availability of the name is confirmed in App Store Connect before metadata production; if Apple rejects the exact name because it is unavailable, product ownership chooses the closest brand-preserving variant without changing the balanced role promise.

### Core promise

ADL Console helps invited teams capture trustworthy infrastructure observations, preserve evidence through intermittent connectivity, review submissions, and manage the projects and roles that govern data quality.

### Audience hierarchy

The public listing treats the roles as one operational chain rather than three unrelated products:

1. Collector creates durable field evidence.
2. Reviewer verifies quality and resolves issues.
3. Administrator defines projects, schemas, membership, and governance.

Collector integrity remains the product's reliability floor, but screenshots and description allocate comparable attention to all three roles.

## Availability and device policy

- Public distribution uses the standard App Store, not Unlisted or Custom App distribution.
- The first version supports iPhone only and requires iOS 17.0 or later.
- Availability is enabled for App Store-supported African countries whose primary product audience operates in English or French.
- English and French are the only v1 product-page localizations.
- The release team verifies the exact current App Store Connect country list at configuration time because storefront support can change.
- Public availability does not create public platform access; valid organization credentials remain mandatory.

## Invitation-only onboarding

The first-run and signed-out experience states clearly:

- ADL Console is for invited members of an African Data Layer organization.
- Existing members sign in with the credentials supplied by their organization.
- Users without access contact their organization administrator or the published support channel.
- The app does not create an account or organization.

The app provides functioning Privacy Policy and Support links before sign-in. It does not display a nonfunctional Create account control or imply immediate self-service access.

Because public v1 does not support account creation, in-app account deletion is not part of this scope. The privacy policy and support experience still explain how a user can request account/data deletion through the organization. This assumption is rechecked against the current App Review Guidelines before every submission.

The first-party organization credential flow does not add social login. Sign in with Apple is not part of v1. This assumption is also rechecked before submission.

## Product-page narrative

### Screenshot sequence

| Frame | Message | Required proof in the screenshot |
|---|---|---|
| 1 | One operation from field to decision | Real role-aware overview/map and product identity |
| 2 | Capture trustworthy evidence | Real schema form, GPS/photo evidence, and an honest offline/pending state |
| 3 | Review with confidence | Evidence detail, quality context, and approve/reject controls |
| 4 | Manage projects and access | Projects/schemas plus role-based member governance |
| 5 | Never lose pending work | Pending, retrying, blocked, and recovery controls from the durable ledger |
| 6 | Work in English or French | Genuine localized role surface and operational accessibility |

Screenshots use seeded demo content created for launch. They do not show personal field data, real credentials, client-sensitive organization names, precise real-world coordinates, or fabricated functionality.

### Description structure

The localized description follows this order:

1. One-sentence data-operations promise.
2. Collector capabilities and offline integrity.
3. Reviewer capabilities and evidence-based decisions.
4. Administrator capabilities and role governance.
5. Invitation-only access requirement.
6. English/French availability, privacy, and support.

The description does not use real-time, lossless, secure, enterprise-ready, or production-ready as unqualified claims. Offline and reliability language must match measured release gates.

### Keywords

The initial English keyword set prioritizes field data, infrastructure, mapping, audit, review, offline, Africa, operations, and GIS without repeating words already indexed from the name/category where avoidable. The French set uses natural French search language rather than literal translation.

Keyword strings remain within App Store Connect limits and are reviewed against the final public positioning immediately before submission.

## Localization

- User-facing strings move to a String Catalog or equivalent native localization source; translation-in-comment patterns are not accepted as the final system.
- English and French screenshots use the corresponding real UI localization.
- Purpose strings, onboarding, session/offline states, recovery actions, destructive confirmation, support, privacy, metadata, review notes, and release notes receive both languages.
- Accessibility labels and VoiceOver reading order are validated in both languages.
- Storefront availability does not imply additional localizations in v1.

## App Review environment

### Seeded organization

A standing Staging/production-like review organization contains:

- A collector account with a published project/schema and safe map/capture fixtures.
- A reviewer account with pending and resolved sample records.
- An administrator account with projects, schemas, members, and organization settings.
- No real user, client, or sensitive field data.

Credentials remain active throughout review, are tested immediately before submission, and are stored only in App Store Connect review fields and the release credential vault.

### Review notes

Review notes provide:

- Invitation-only explanation.
- Three role credentials or one explicitly documented account-switching procedure.
- Exact steps for the six screenshot journeys.
- Explanation of offline capture and how to observe pending/reconnect behavior without waiting for an outage.
- Confirmation that the backend is live during review.
- Explanation that there is no public signup, no in-app purchase, no advertising, no tracking, and no social login.
- Contact details for a release owner who can respond during review.

## Privacy and compliance package

The release owner verifies consistency among:

- `PrivacyInfo.xcprivacy`.
- App Store Connect App Privacy answers.
- The public privacy policy.
- In-app privacy and support links.
- Backend retention and deletion behavior.
- The Apple-native telemetry inventory.

The declared data remains email address, precise/coarse location, photos/videos, and other user content when those are the actual linked app behaviors. All are for app functionality, linked to the user's account as applicable, and not used for tracking. Required-reason API declarations remain synchronized with the binary.

Notification permission is requested contextually after an explicit user choice, not at first launch. Location and camera/photo access are requested in the capture context with useful denial recovery.

Greenlight, archive validation, and a current-guideline review run before submission. Passing a static scan does not replace the runtime review-account smoke.

## Analytics and optimization

The v1 baseline uses App Store Connect Analytics for impressions, product-page views, conversion, downloads, retention, and crashes where Apple exposes them. No third-party product analytics SDK is added.

The release owner records the baseline before changing creative. Product Page Optimization begins only after the listing has enough first-time downloads and impressions for a meaningful result. One variable changes per experiment, beginning with the lead screenshot or screenshot order.

Custom Product Pages may later support collector-, reviewer-, or administrator-specific campaigns. They do not replace the balanced default page and are created only after the default conversion baseline is understood.

## TestFlight and rollout

### Internal TestFlight

Five to ten trained internal contributors use the seeded organization and non-sensitive data. They complete capture, offline/reconnect, recovery, review, administration, sign-out/reauthentication, English/French, and permission-denial scripts.

### External invited TestFlight

A controlled invited cohort representing collector, reviewer, and administrator roles uses a limited real operational project with support on call. Promotion requires:

- All M0–M2 gates passing on the exact build.
- No open Sev-1 or Sev-2 issue.
- Successful migration and blocked-record recovery drills.
- Seven consecutive pilot days without a new reproducible Sev-1 or Sev-2 integrity defect.
- Privacy/support links and review credentials verified.

### Public release

The App Store version uses manual release after App Review approval, followed by Apple's phased release for automatic updates where available. New downloads remain available in the configured storefronts; the team monitors diagnostics, support, authentication, sync, and reviews throughout the rollout.

The release owner may pause the phased release or remove storefront availability if a Sev-1 occurs. The prior approved build and recovery runbook remain available.

## Review and support operations

- Support responses are available in English and French.
- App Store reviews are triaged for authentication, offline/sync, data-integrity, accessibility, and expectation mismatch themes.
- Responses contain no personal data and do not ask users to disclose evidence publicly.
- Critical reports create or update a Beads issue with severity and release impact.
- Store metadata and screenshots are updated when product behavior changes; old claims are not carried forward automatically.

## Testing strategy

### Metadata and asset checks

- Character limits, localization presence, supported device sizes, screenshot order, and absence of sensitive data.
- iPhone-only metadata matches the binary device family.
- Privacy/support URLs return successfully from supported storefront networks.
- Invitation-only access is explicit before download expectations and inside onboarding.

### Review-account smoke

- Fresh install and sign-in for collector, reviewer, and administrator.
- Complete every documented review journey against the live review organization.
- Confirm role permissions and online-only privileged mutations.
- Confirm offline/pending behavior and recovery instructions.
- Confirm credentials remain valid after build processing and immediately before submission.

### Localization and accessibility

- Screenshot source fixtures produce the same safe content in English and French.
- Long French strings do not truncate required actions.
- VoiceOver reads onboarding, role navigation, status, recovery, and support controls correctly.
- Dynamic Type and reduced motion preserve every review journey.

## Acceptance gates

The subproject is complete when:

- App Store Connect is configured for an iPhone-only public app in the approved African storefront set.
- English and French metadata, screenshots, privacy, support, and review notes are complete and truthful.
- The balanced six-frame screenshot story uses the exact release-candidate behavior.
- Invitation-only onboarding contains no dead end and no public signup implication.
- Collector, reviewer, and administrator review credentials pass a fresh-install smoke.
- The exact build passes M0–M2, Greenlight, archive validation, and the seven-day external TestFlight gate.
- App Review approves the version and the owner signs the manual public release decision.
- App Store Connect baseline metrics and support/review ownership are recorded for post-launch operation.

## Dependencies and handoff

This is the final portfolio subproject. It consumes the exact product behavior and release evidence produced by the preceding specs. It does not permit metadata production to outrun implemented, tested functionality.
