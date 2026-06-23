# Point Operator Accounts Design

**Date:** 2026-06-24

**Status:** Approved for implementation planning

**Issue:** `africandatalayer-aek`

## Summary

African Data Layer will add a fourth account role, `point_operator`. A point operator is the authorized person or organization responsible for one existing verified map point. This includes business owners and non-business custodians such as billboard operators or road authorities.

An admin creates the account and links it to exactly one point. The operator receives a deliberately small application with two tabs:

1. **Status** — up to three large, vertical-specific controls.
2. **Profile** — point photo, read-only verified identity, and account settings.

Operator updates enrich the existing point instead of creating a parallel data model. Status and photo changes remain event-sourced, auditable, freshness-aware, visible to point viewers, and compatible with snapshots and delta analytics.

## Product Goals

- Let responsible point operators provide current, high-value information directly.
- Make updating a point possible in seconds with minimal training.
- Preserve ADL's verified point identity and trust model.
- Support intermittent connectivity through offline queueing and automatic replay.
- Reuse the existing point-event projection, review, snapshot, and delta systems.
- Give admins full control over account creation, point linkage, revocation, and replacement.

## Non-Goals

The first release will not allow point operators to:

- self-register;
- create a point;
- control multiple points or branches;
- change point name, category, coordinates, or verified identity fields;
- access the field-agent map, contribution workflow, rewards, leaderboard, assignments, client analytics, or admin tools;
- customize which controls appear;
- invite additional operators;
- delete point history.

## Terminology

- **Point operator:** The user-facing and technical role for a person or organization authorized to report information about one point.
- **Verified point:** An existing projected ADL point selected by an admin.
- **Ownership link:** The audited relationship granting one operator access to one point. The term does not imply legal ownership.
- **Operator signal:** A vertical-approved status field reported by the point operator.

The role is named `point_operator` in storage, API contracts, JWT claims, web code, and native code. User-facing labels are:

- English: **Point Operator**
- French: **Opérateur du point**

## Account and Ownership Model

### Role

Extend `UserRole` from:

```text
agent | admin | client
```

to:

```text
agent | admin | client | point_operator
```

`point_operator` is never accepted by public registration. Only an authenticated admin may create or assign it.

### Ownership table

Add a dedicated table instead of placing a mutable `point_id` on `user_profiles`.

```text
point_operator_assignments
  id                  uuid primary key
  operator_user_id    text not null
  point_id            text not null
  status              active | revoked
  granted_by          text not null
  granted_at          timestamptz not null
  revoked_by          text null
  revoked_at          timestamptz null
  revoke_reason       text null
```

Database constraints:

- one active assignment per `operator_user_id`;
- one active assignment per `point_id`;
- revoked rows remain immutable audit history;
- the target point must exist before activation;
- activation and account role updates occur transactionally.

The service layer must verify that the selected point is a real projected point. An operator account cannot be activated against an arbitrary point ID.

### Ownership changes

When responsibility changes:

1. Admin revokes the old assignment.
2. Old operator sessions lose point access on the next authenticated request.
3. Admin creates or selects a different account.
4. Admin grants a new assignment to the same point.

Accounts are not transferred or shared. Historical events remain attributed to the original operator.

## Admin Experience

Extend Account Access with a distinct **Point Operator** workflow. Do not overload ordinary role editing with an unlinked `point_operator` option.

### Create and link

Admin supplies:

- email or phone;
- operator/contact display name;
- temporary password;
- an existing verified point selected through point search;
- optional internal assignment note.

The point search result shows point name, vertical, location, point ID, current photo, and whether it already has an active operator.

Creation is atomic:

1. validate admin permission;
2. validate account identifier and password;
3. validate target point;
4. reject a point or account with an active assignment;
5. create profile with role `point_operator`;
6. set `must_change_password = true`;
7. create active ownership link;
8. write security audit events.

If any step fails, no partial account or assignment remains.

### Existing account

An admin may assign an existing non-admin account after explicit confirmation. Assignment changes its role to `point_operator`, resets its map scope to the most restrictive default, and invalidates existing sessions so new claims take effect.

Admin accounts cannot become point operators through this workflow.

### Revoke and replace

The admin view shows active operator, grant date, last operator update, and recent operator events. Revocation requires a reason. Replacement is revoke-then-grant, with no period containing two active operators.

### Audit events

Add security audit types for:

- `point_operator_account_created`;
- `point_operator_assignment_granted`;
- `point_operator_assignment_revoked`;
- `point_operator_assignment_replaced`;
- `point_operator_password_changed`.

## Operator Application

The operator shell is identical in information architecture across the responsive web/Capacitor app and native iOS app. Android receives the responsive experience through Capacitor.

### Navigation

Only two tabs appear:

- **Status / Statut**
- **Profile / Profil**

Server authorization remains authoritative. Hiding navigation is not considered a security control.

### Status tab

Use the approved status-first layout:

- compact point header with vertical, verified name, optional photo, and freshness;
- one to three large independent status cards;
- minimum 48 px touch targets;
- each control saves independently;
- explicit state labels, not color alone;
- per-control timestamp or expiry state;
- sync state: `Saved`, `Pending sync`, `Syncing`, or actionable error.

The operator cannot reorder or customize controls.

### Profile tab

The Profile tab contains:

- current point photo;
- **Update photo** action;
- read-only point name, vertical, locality, and abbreviated point ID;
- explanation that verified identity and location are managed by ADL;
- language;
- change password;
- help and privacy;
- sign out.

The displayed photo is the point photo, not a separate user avatar.

## Vertical Operator Controls

All current verticals are eligible. The shared vertical configuration defines the controls, labels, expiry, and canonical detail field. A vertical may expose one, two, or three controls, but never more than three.

Initial matrix:

| Vertical | Control | Canonical field | Freshness |
|---|---|---|---|
| Pharmacy | Open now | `isOpenNow` | expires after 6 hours |
| Pharmacy | On guard | `isOnDuty` | expires after 12 hours |
| Pharmacy | Essential medicines available | `hasEssentialMedicinesAvailable` | expires after 24 hours |
| Mobile money | Open now | `isOpenNow` | expires after 6 hours |
| Mobile money | At least 50,000 XAF cash available | `hasMin50000XafAvailable` | expires after 4 hours |
| Mobile money | Electronic float available | `hasFloat` | expires after 4 hours |
| Fuel station | Open now | `isOpenNow` | expires after 6 hours |
| Fuel station | Fuel available | `hasFuelAvailable` | expires after 6 hours |
| Fuel station | Long queue | `isQueueBusy` | expires after 2 hours |
| Alcohol outlet | Open now | `isOpenNow` | expires after 6 hours |
| Alcohol outlet | Food currently available | `isFoodAvailableNow` | expires after 6 hours |
| Alcohol outlet | Seating currently available | `isSeatingAvailableNow` | expires after 6 hours |
| Billboard | Currently occupied | `isOccupied` | expires after 7 days |
| Billboard | Lit at night | `isLit` | expires after 30 days |
| Billboard | Operational/undamaged | `isOperational` | expires after 7 days |
| Transport road | Blocked | `isBlocked` | expires after 4 hours |
| Transport road | Flooded | `isFlooded` | expires after 4 hours |
| Transport road | Street lighting working | `hasWorkingStreetLight` | expires after 7 days |
| Census proxy | Electricity available | `hasElectricity` | expires after 30 days |
| Census proxy | Water available | `hasWater` | expires after 30 days |
| Census proxy | Commercial ground floor active | `hasCommercialGround` | expires after 30 days |

All controls are bilingual. Newly introduced fields must be added to `SubmissionDetails`, vertical normalization, enrichable-field allowlists, delta semantics where relevant, API validation, and native models.

Expiry means **unknown**, not false. An expired “Open now: true” must never become “Closed.”

## Event and Projection Model

### Status update

Each successful toggle creates one `ENRICH_EVENT` for the assigned point:

```text
eventType: ENRICH_EVENT
userId: operator account
pointId: assigned point
category: verified point category
details: { one allowed canonical field: boolean }
source: point_operator
```

The server derives point ID and category from the active assignment. Client-supplied point IDs or categories are ignored or rejected.

An operator request may update only fields configured as operator controls for that point's vertical. It cannot use the broader agent enrichment allowlist.

### Provenance and freshness

Projection/API responses expose operator metadata per signal:

```text
field
value
reportedBy: point_operator
reportedAt
expiresAt
isExpired
eventId
reviewState
```

Public point surfaces show:

> Reported by point operator · updated 10 min ago

Expired signals show **Unknown — last reported …** and are excluded from assertions of current availability.

### Snapshots and deltas

Operator events flow through the existing point projection and snapshot engine. Fresh, non-rejected signals affect current snapshots and deltas. Expired time-sensitive signals project as unknown for current-state consumers.

Historical raw events remain available for analysis, even after expiry or rejection.

## Trust and Review

### Normal status events

Normal status changes publish immediately and receive the equivalent of an auto-approved review state.

### Anomalous status events

An update remains immediately visible but is flagged for admin review when any of these apply:

- toggle frequency exceeds a configured threshold;
- repeated contradictory changes occur within a short interval;
- update conflicts with a recent verified agent observation;
- account is suspended, revoked, or otherwise unauthorized;
- impossible category/field combination;
- replay or idempotency anomaly.

Unauthorized events are rejected before publication. Authorized but suspicious events publish with a flagged review state. Admin rejection removes the event from current projection and restores the previous valid value.

### Photo updates

Photo update behavior:

1. operator captures or chooses a supported image;
2. client compresses within current upload limits;
3. server creates a photo-only `ENRICH_EVENT` with `source = point_operator`;
4. new photo publishes immediately;
5. previous photo remains recoverable through event history;
6. event enters admin review;
7. rejection causes projection to fall back to the previous valid photo.

The public surface may show that a new photo is awaiting review. Photo updates use existing upload security, size, and format controls.

## API Boundaries

Use dedicated point-operator endpoints or handlers rather than exposing unrestricted point enrichment:

- admin create-and-link operator;
- admin search eligible points;
- admin load assignment;
- admin revoke assignment;
- operator load assigned point and control definitions;
- operator submit one status signal;
- operator submit point photo;
- operator change temporary password.

Every operator endpoint:

- requires an authenticated `point_operator` role;
- resolves the active assignment server-side;
- enforces vertical control allowlists;
- uses idempotency keys for writes;
- applies rate limits;
- writes audit/security context;
- returns bilingual-safe error codes/messages to clients.

Existing agent submission endpoints must not implicitly grant `point_operator` access.

## Authentication and Session Rules

- JWT/session claims support `point_operator`.
- Admin-created operator accounts have `must_change_password = true`.
- First login routes directly to password replacement before Status/Profile access.
- Successful replacement clears the flag and invalidates the temporary credential.
- Role or assignment changes invalidate active sessions.
- Revoked operators see a restricted “Access removed — contact ADL” screen and can only sign out or access privacy/help information.
- Public registration rejects `point_operator`.

## Offline and Synchronization Behavior

Status controls are offline-first:

- optimistic local state updates immediately;
- request enters the existing durable offline queue;
- queue item contains field, boolean value, client timestamp, device ID, and idempotency key;
- server derives point and vertical after authentication;
- replay preserves original client capture time while recording server receipt time;
- duplicate replay returns the original result;
- automatic retry handles transient failures;
- permanent authorization or validation failure restores the current server value and shows an actionable message.

Photo updates may queue when storage capacity permits. If a photo cannot be safely retained locally, the UI must explain that connectivity is required instead of pretending the update was queued.

Conflict resolution is last accepted event by server order, while retaining client capture time for audit and anomaly analysis.

## Public and Internal Consumption

Operator signals are visible to every user who can view the point, including unauthenticated/public views where currently allowed.

Consumers receive:

- signal value;
- freshness/expiry;
- operator provenance;
- review state when disclosure is appropriate.

Clients and admins may filter or analyze operator-originated events separately from agent events. Operator events must not award agent XP or count toward agent contribution quotas, assignments, or leaderboards.

## Error Handling

Key controlled states:

- no active assignment;
- assignment revoked;
- point missing or no longer projectable;
- unsupported operator field;
- stale client configuration;
- duplicate request;
- storage unavailable;
- photo too large or unsupported;
- session requires password change;
- temporary network failure.

The UI never exposes generic agent screens as a fallback. Unknown roles or missing assignments fail closed.

## Accessibility and Design Constraints

- Light mode first with strong daylight contrast.
- 48 px minimum targets.
- English/French labels designed for expansion.
- Text labels accompany every toggle state.
- Reduced-motion support.
- Status changes do not depend on animation.
- Screen-reader announcements identify point, control, new value, and sync state.
- The two-tab shell remains usable one-handed on mid-range Android devices.

## Testing Strategy

### Data and migration

- role constraint accepts `point_operator`;
- active assignment uniqueness by operator and point;
- revoked history remains;
- account creation and assignment are atomic;
- existing roles and profiles migrate unchanged.

### Authorization

- only admins create, link, revoke, or replace;
- public registration cannot request the role;
- operators cannot call agent, client, or admin actions;
- operators cannot update another point;
- revoked operator access fails immediately;
- direct point ID/category spoofing fails.

### Event behavior

- each toggle creates one allowed `ENRICH_EVENT`;
- unsupported fields fail;
- current projection includes fresh signals;
- expiry becomes unknown;
- normal events publish immediately;
- anomalous events route to review while remaining visible;
- rejected events restore prior projected value;
- operator events do not award XP.

### Offline and idempotency

- offline toggle queues and replays;
- repeated replay does not duplicate events;
- multiple queued changes resolve deterministically;
- permanent rejection reconciles UI to server state;
- photo queue respects local storage limits.

### Photo review

- update publishes immediately;
- prior photo is retained;
- review queue receives event;
- rejection restores prior photo.

### UI

- web/Android operator sees exactly Status and Profile;
- native iOS operator sees exactly Status and Profile;
- vertical renders one to three configured controls;
- Profile identity fields are read-only;
- first login forces password change;
- revoked assignment shows restricted state;
- bilingual and accessibility checks pass.

### Regression

- agent, admin, and client navigation remains unchanged;
- existing point projection, snapshots, and deltas continue to work;
- admin account creation for current roles still works;
- existing offline agent submission queue remains compatible.

## Rollout

1. Ship schema and server authorization behind a feature flag.
2. Add admin creation/linking workflow.
3. Enable operator shell for internal test accounts.
4. Verify each vertical's controls and expiry behavior.
5. Enable public provenance display.
6. Pilot with a small set of verified points.
7. Monitor rejected events, contradiction rates, sync failures, and stale-signal rates before broader rollout.

## Success Criteria

- A trained admin can create and link an operator in under two minutes.
- An operator can update a status in under ten seconds.
- Offline status updates replay without duplicates.
- No operator can mutate point identity or another point.
- Every published operator value shows provenance and freshness.
- Expired values never masquerade as current facts.
- Photo and anomalous-status review preserves the previous valid state.
- Existing agent, admin, and client experiences remain unchanged.
