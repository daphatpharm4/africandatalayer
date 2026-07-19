# ADL Console — Native iOS Company App (design + plan)

**Date:** 2026-07-19
**Status:** Design approved, implementation via subagent-driven-development
**Corresponds to:** the web company console at `/console`
**Isolation constraint:** MUST NOT modify the existing `ios/` (agent app). New app
lives in a separate top-level folder `ios-console/`. Self-contained — no shared
refactor of `ios/`.

---

## What this is

A native SwiftUI iOS app for **company/tenant users** of African Data Layer —
the mobile counterpart of the web company console (`https://www.app.africandatalayer.com/console`).
Distinct product from the field-agent app (`ios/`) and from ADL-internal admin.

**Audience roles** (`PlatformRole`, `shared/platformTypes.ts`):
`owner | manager | reviewer | collector | viewer`.

**NOT the agent app, NOT ADL-internal admin.** No gamification, no "Data" mascot
(mascot is agent-app-only). Clinical/premium register per CLAUDE.md (admin/client).

---

## Isolation & structure

New folder, does not touch `ios/`:

```
ios-console/                         ← NEW, top-level, isolated from ios/
├── ADLConsole.xcodeproj
├── Packages/
│   └── ConsoleCore/                 ← local SwiftPM package (Foundation-only, CLI-testable)
│       ├── Sources/ConsoleModels/   ← port of shared/platformTypes.ts
│       ├── Sources/ConsoleAPI/      ← port of lib/client/platformApi.ts
│       ├── Sources/ConsoleState/    ← port of lib/client/consoleState.ts (routing + access)
│       └── Tests/                   ← contract + unit tests (swift test, no Xcode needed)
└── ADLConsole/                      ← app target (SwiftUI)
    ├── ADLConsoleApp.swift          ← @main
    ├── DesignSystem/                ← own tokens (navy/terra/forest/gold), ports patterns from ios/ (copied, not shared)
    ├── Auth/                        ← session login (same @auth/core backend)
    ├── Shell/                       ← role-based tab/nav
    └── Screens/                     ← SwiftUI screens (see below)
```

**Bundle id:** `com.africandatalayer.console`. **Display name:** "ADL Console".
Public App Store listing.

**Why self-contained (not sharing ios/ code):** the isolation constraint forbids
touching `ios/`. Porting the ~4 things we reuse (design tokens, an API/session
client pattern, an offline-queue pattern) is cheaper and safer than extracting a
shared package out of the `ADLViews.swift` monolith and refactoring the agent app.

---

## Data model (port `shared/platformTypes.ts` → Swift `ConsoleModels`)

Codable structs/enums, 1:1 with the TS types (contract-tested):

- `PlatformRole` (enum, string-backed)
- `BilingualLabel`, `PlatformFieldType`, `PlatformFieldOption`, `PlatformFieldDefinition`
- `PlatformEvidenceRules`, `PlatformRecordType`, `PlatformSchemaDefinition`, `PlatformSchemaVersion`
- `PlatformOrganization`, `PlatformOrganizationAccessStatus`, `PlatformMembership`
- `PlatformProject`, `PlatformProjectStatus`, `PlatformProjectCoverageScope`
- `PlatformRecord`, `PlatformRecordGps`, `PlatformRecordEvidence`, `PlatformRecordSummary`, `PlatformNearbyPoint`
- `PlatformInvite`
- Admin summaries: `PlatformAdminMemberSummary`, `PlatformAdminProjectSummary`, `PlatformAdminOrganizationSummary`

## API client (port `lib/client/platformApi.ts` → Swift `ConsoleAPI`)

All ops are `GET|POST /api/user?view=platform_<name>`, JSON body, idempotency key
on mutations. Async/await `PlatformAPIClient` with one method per op:

- Orgs: `listMyOrganizations`, `createOrganization`, `getOrganization`, `updateOrganization`
- ADL-admin: `listAdminOrganizations`, `updateAdminOrganizationAccess` (gated, may defer)
- Members/invites: `listOrgMembers`, `createInvite`, `acceptInvite`, `revokeInvite`, `updateMember`, `removeMember`
- Projects: `createProject`, `listProjects`
- Schema: `getSchema`, `saveSchemaDraft`, `publishSchema`
- Records: `createPlatformRecord`, `listPlatformRecords`, `listApprovedPlatformRecords`, `nearbyPlatformPoints`, `getMyPlatformRecordSummary`
- Review: `reviewPlatformRecord`

## Navigation & access (port `lib/client/consoleState.ts` → `ConsoleState`)

Screens: `OVERVIEW, DATA, REVIEW, PROJECTS, SCHEMA_BUILDER, MEMBERS, SETTINGS, ONBOARDING, JOIN`.
Access matrix ported **verbatim** from `canAccessConsoleScreen`:

| Screen | Who |
|--------|-----|
| Overview, Projects, Join | all roles |
| Data | not collector |
| Review | reviewer, manager, owner |
| Schema Builder, Members | manager, owner |
| Settings | owner |
| Onboarding | ADL admin only |

Landing: reviewer → Review, else → Overview.

## Screens (SwiftUI, port of `components/Console/`)

Auth/Join · Overview · Data (records list + detail) · Review Queue
(approve/reject/mass) · Projects · **Schema Builder** (dynamic schema editor —
hardest) · Members (invite/roles) · Settings · Onboarding wizard.

## Auth

Same `@auth/core` backend as web/agent. Native credential login → session →
`listMyOrganizations` + membership sets the active role. Reuse the agent app's
session-cookie handling pattern (ported, not shared).

## Offline

Collector capture must work offline: record drafts queued locally (idempotency
keys already in the API), synced on reconnect. Port the agent app's offline-queue
pattern.

---

## Verification ceiling (be honest)

- `ConsoleCore` package (Models, API, State) is **Foundation-only → buildable and
  unit/contract-testable via `swift build` / `swift test` on the CLI**, no Xcode.
  This is where correctness is proven.
- SwiftUI screens + the `.xcodeproj` **cannot be compiled/run in this environment**
  (needs Xcode + iOS SDK). Those are written to spec and must be built/verified by
  the human in Xcode. Every phase states what is CLI-verifiable vs Xcode-only.

---

## Phased plan (self-contained; no P0 refactor of ios/)

- **P1 — ConsoleCore scaffold + models.** SwiftPM package; port `platformTypes.ts`
  to Codable Swift; JSON round-trip + contract tests. *(CLI-verifiable.)*
- **P2 — PlatformAPIClient.** Port `platformApi.ts` (view routing, idempotency,
  error mapping); mocked-URLProtocol tests per op. *(CLI-verifiable.)*
- **P3 — ConsoleState.** Port `consoleState.ts` routing + `canAccessConsoleScreen`;
  exhaustive access-matrix tests. *(CLI-verifiable.)*
- **P4 — App target + auth + role shell.** `.xcodeproj`, `@main`, design tokens,
  login, org/role bootstrap, role-based tab/nav, Overview. *(Xcode-only.)*
- **P5 — Collector capture.** Schema-driven dynamic forms, photo/GPS, offline
  queue, `createPlatformRecord`. *(Xcode-only; form-engine logic unit-tested in Core.)*
- **P6 — Reviewer queue.** Review list + approve/reject/mass. *(Xcode-only.)*
- **P7 — Manager/Owner.** Projects, Schema Builder, Members, Settings, Onboarding. *(Xcode-only.)*
- **P8 — App Store.** Icons, Info.plist, capabilities, privacy manifest, submission. *(Xcode-only.)*

Each phase is an independent subagent task with its own tests and a review
checkpoint. Correctness-critical logic (models, API contract, access rules,
form-schema engine) lives in `ConsoleCore` so it is CLI-verifiable independent of
Xcode.

## Risks

1. **Schema Builder / dynamic forms** — hardest; put the schema→form engine in
   ConsoleCore (testable) and keep SwiftUI a thin renderer.
2. **TS↔Swift model drift** — contract tests against real API JSON fixtures.
3. **Native session/cookie auth** — validate against a real preview deploy early.
4. **App Store review** for a B2B login-gated app — provide a demo org/reviewer login.

## Out of scope (v1)

- ADL-internal admin surfaces (that lives in `ios/`).
- Android (separate effort).
- Sharing a package back into `ios/` (possible later; not now — isolation).
