# ADL Console Offline Runtime Design

**Status:** Approved subproject design

**Program:** `docs/superpowers/specs/2026-07-22-ios-console-public-launch-program-design.md`

**Depends on:** `docs/superpowers/specs/2026-07-22-ios-console-capture-integrity-design.md`

**Tracking:** `africandatalayer-60t`

## Objective

Allow a previously verified collector to relaunch and capture within an authorized cached workspace for 72 hours without connectivity, while keeping reviewer and administrator mutations online-only. Synchronization must resume from lifecycle and connectivity triggers and expose one truthful operational status across the shell.

## Scope

This subproject delivers:

- Explicit session availability states instead of treating every restore failure as signed-out.
- Owner-scoped GRDB workspace snapshots for organization membership, role, projects, published schemas, active organization, and bounded read caches.
- A 72-hour cached authorization policy.
- `NWPathMonitor` connectivity hints combined with session/API outcomes.
- A lifecycle-driven `SyncEngine` actor over the Capture Integrity ledger.
- Truthful localized shell status and pending/blocked navigation.
- Foreground, reconnect, immediate, manual, and opportunistic background triggers.
- Sign-out locking and same-user/same-organization unlock behavior.
- Cold-start offline, expiry, role-matrix, retry, and recovery tests.

It does not change the platform API, add offline reviewer/admin mutations, or make background execution a delivery guarantee.

## Components

### SessionRepository

`SessionRepository` owns Auth.js session interpretation and publishes one `SessionAvailability` value:

- `restoring`: launch or foreground refresh is in progress.
- `onlineVerified`: the server session is valid and membership refresh succeeded.
- `offlineAuthorized(expiresAt)`: transport/server is unavailable, the last verified snapshot belongs to the same cookie identity, and the 72-hour window remains open.
- `reauthenticationRequired(reason)`: no session, expired cached authorization, HTTP 401, or an identity mismatch.
- `signedOut`: explicit local sign-out completed.

`NetworkAuthService` continues to perform the cookie handshake. Its restore result must distinguish no session from transport/server failure; swallowing all restore errors into `nil` is removed. Passwords are never persisted.

### WorkspaceRepository

`WorkspaceRepository` owns the last verified workspace snapshot and bounded role-surface caches. A snapshot is written only after a valid session and successful membership response establish user, organization, and role.

The snapshot contains:

- User ID and active organization ID.
- Organization display data and membership role.
- Verification timestamp and expiry timestamp.
- Project IDs, display data, published schema IDs, schema definitions, and version hashes needed by capture.
- Active locale and selected organization.
- Bounded map, review, and administration read responses with independent freshness timestamps.

The collector capture bootstrap is required offline. Reviewer/admin caches are best-effort and visibly stale. Sensitive record content is stored only when the existing API and privacy policy already permit it; caches are size-bounded and owner/org scoped.

### ConnectivityMonitor

`ConnectivityMonitor` wraps `NWPathMonitor` and publishes path state. It does not claim that authentication or the platform backend is healthy. The runtime combines path state with the most recent session and API outcome.

### SyncEngine

`SyncEngine` is an actor with one active drain loop. It consumes due records from `RecordLedger`, calls `ExistingPayloadSubmissionAdapter`, and commits each result before claiming the next record.

Triggers are coalesced from:

- A newly persisted record.
- Network path becoming satisfied.
- App entering foreground.
- User tapping Retry.
- An opportunistic `BGAppRefreshTask` execution.

The engine never relies on an in-memory timer as the source of truth. `next_attempt_at` is durable. Background expiration stops cleanly after the current database transition; remaining records stay recoverable.

### OperationalStatusModel

The shell consumes one derived status:

- `offline`: no usable path or a confirmed transport failure.
- `connecting`: path exists while session/API health is being established.
- `pending(count)`: durable work is waiting and no send is active.
- `syncing(current, total)`: a drain loop is active.
- `blocked(count)`: at least one record needs user action; this outranks a cosmetic online state.
- `upToDate(lastSuccessfulSyncAt)`: no pending/blocked work and the last API outcome succeeded.

The model removes the hard-coded Connected label. Every state includes English and French copy and an accessibility label.

## Authorization policy

### Verification clock

The 72-hour clock begins when the backend verifies both the Auth.js session and current organization membership. A foreground refresh that verifies both advances the clock. Device clock rollback does not extend authorization; the runtime stores wall-clock and monotonic reference information and chooses the more conservative result when they conflict.

### Collector

Within 72 hours, the collector may:

- Enter the cached organization and project.
- Load the cached published schema version.
- View the bounded cached map context.
- Create and edit local drafts.
- Acquire GPS and photo evidence.
- Inspect, export, retry, and explicitly discard owned pending records.

Submission waits until a usable path and session are available. After 72 hours, the collector may inspect and export existing pending work but may not create a new record or mutate server state until reauthentication succeeds.

### Reviewer

Offline, the reviewer may inspect explicitly labeled cached queue items and evidence if present. Approve, reject, batch, comment, and other server mutations are disabled with a Reconnect to continue explanation.

### Administrator

Offline, the administrator may inspect explicitly labeled cached summaries, projects, schemas, members, and organization settings. Publish, invite, role, removal, schema mutation, branding mutation, and organization mutation actions are disabled.

### Identity and organization isolation

Every cached workspace, record, and media query includes owner user ID and organization ID. Switching organizations changes the visible snapshot and does not merge pending work. A different signed-in user cannot see or unlock another user's pending data.

## Launch and foreground flow

1. Read the last owner-scoped workspace snapshot and Capture Integrity ledger.
2. Begin session restoration without hiding recoverable local state behind an indefinite loading screen.
3. If verification succeeds, refresh membership/workspace, update expiry, and schedule synchronization.
4. If the network fails and the snapshot remains within 72 hours, enter `offlineAuthorized` and route to the cached role landing surface.
5. If the snapshot is expired or identity cannot be proven, enter `reauthenticationRequired`; retain pending work behind its owner lock.
6. When the app returns to foreground, repeat verification unless an equivalent request is already active.

## Sign-out behavior

Sign-out synchronously clears local cookies/session capability before the best-effort server request. It clears in-memory and cached authorization state, then locks workspace snapshots and pending records. It does not delete records or media.

When the same user later authenticates and membership in the same organization is verified, the repository unlocks that pending work. A different user or revoked membership leaves it locked and exportable only through an owner-approved recovery path defined by product policy.

## Synchronization policy

- Records are processed oldest first unless the user explicitly retries one blocked record.
- Only one send attempt per local record may be active.
- Every attempt uses the stored idempotency key.
- Retryable failures use exponential backoff with jitter and a bounded automatic-attempt budget.
- Exhausting automatic attempts changes the record to a visible blocked state; it does not remove it.
- A path change may make a record eligible immediately, but an HTTP/session failure can return the runtime to Offline or Reauthentication required.
- HTTP 401 pauses the drain loop and blocks affected records for sign-in.
- HTTP 403 pauses organization work and refreshes membership before any further mutation.
- Validation and storage errors block only the affected record.
- Verified acknowledgement commits receipt state before media cleanup.

## Background behavior

The app registers a refresh task only to opportunistically drain already-durable records. It does not request background location. It does not keep GPS, camera, map, or network sessions active while idle. The engine respects task expiration and records a privacy-safe outcome.

User-facing correctness never depends on iOS granting background time. Foreground and reconnect triggers remain sufficient.

## Notification policy

The app no longer requests notification permission automatically at launch. Notification settings default to off until the user opts in from a contextual explanation tied to pending-work status.

Local notifications are limited to meaningful outcomes such as a blocked record that needs action or completion of a user-initiated batch after the app backgrounds. Routine workspace loading does not generate notifications.

## Error and recovery behavior

| Situation | Runtime behavior |
|---|---|
| No path at launch, valid snapshot | Open cached role surface and show Offline with expiry |
| Server 5xx during restore, valid snapshot | Treat as service unavailable, not signed-out; use offline policy |
| HTTP 401 | Require sign-in; retain and lock pending data |
| HTTP 403 after prior membership | Refresh memberships; block organization mutations and records until resolved |
| Cached schema missing | Do not offer new capture; pending records remain inspectable/exportable |
| Snapshot older than 72 hours | Prevent new capture and all mutations; require reauthentication |
| Sign-out with pending records | Clear auth; retain and owner-lock records/media |
| Background task expires | Finish current durable transition, stop, and resume later |
| Connectivity monitor says online but API fails | Show Connecting or Offline based on API outcome; never Up to date |

## Testing strategy

### Session and authorization tests

- Valid online session and membership produce `onlineVerified`.
- Transport and 5xx failures use a valid unexpired snapshot.
- Missing session, HTTP 401, identity mismatch, revoked membership, and 72-hour expiry require reauthentication.
- Device clock rollback cannot extend the window.
- Same-user/same-org reauthentication unlocks pending work; different identity does not.

### Workspace tests

- Cold-start offline loads the correct owner/org/project/schema snapshot.
- Organization switching isolates snapshots and records.
- Missing or incompatible schema prevents new capture without hiding recovery.
- Reviewer/admin caches are labeled stale and their mutation methods are never called offline.

### SyncEngine tests

- Every trigger coalesces into one drain loop.
- Oldest due order, single claim, stable idempotency, backoff jitter bounds, manual retry, and background expiration.
- 401 pauses the queue; one validation error does not block unrelated records.
- Relaunch recovers interrupted sending state.
- Acknowledgement is durable before media cleanup.

### UI and accessibility tests

- Offline, Connecting, Pending, Syncing, Blocked, Up to date, expiry, and last-sync copy in English and French.
- Collector capture within and beyond the 72-hour boundary.
- Reviewer/admin mutation controls disabled offline with useful explanation.
- Sign-out with pending data and same-user recovery.
- Contextual notification opt-in and denial.

## Acceptance gates

The subproject is complete when:

- A previously verified collector can relaunch offline and capture against a cached published schema within 72 hours.
- New capture is blocked after expiry while existing pending work remains inspectable and exportable.
- Reviewer/admin mutations cannot call the API offline.
- Pending work retries after reconnect and foreground without another capture submission.
- The shell never claims Connected from a constant or `NWPathMonitor` alone.
- Sign-out clears auth immediately without deleting pending records or media.
- Background expiration cannot leave a record permanently in sending state.
- All new behavior passes English/French accessibility and state tests.

## Dependencies and handoff

This subproject consumes Capture Integrity's ledger, media, state, and submission contracts. It produces `SessionRepository`, `WorkspaceRepository`, `ConnectivityMonitor`, `SyncEngine`, and `OperationalStatusModel` for Operational Readiness instrumentation and public launch screenshots.
