# ADL Console Missions & Gamification Design

**Status:** Draft subproject design

**Program:** `docs/superpowers/specs/2026-07-22-ios-console-public-launch-program-design.md`

**Tracking:** TBD

## Objective

Give organization collectors visible, time-bounded missions (daily/weekly) with manager-assigned quotas, and surface an org-scoped leaderboard so contributors can see their rank. This creates the collection-guidance and competitive-progress layer the iOS console currently lacks, bridging manager operational intent with collector daily motivation using the same API conventions and role gates as the existing screens.

## Current state

- Collectors see a map, an overview with capture counts, and project lists — no guidance on what to collect, by when, or how their output ranks within the org.
- Managers/owners have no tool to assign quotas, set collection targets to specific collectors, or track progress toward those targets within the iOS console. The web console also lacks dedicated missions assignment (only collection assignments exist as zone-based field-app constructs).
- The existing `GET /api/leaderboard` endpoint returns a global (cross-org) leaderboard of all contributors ranked by XP, with name redaction and a `stale-while-revalidate` cache-control header. It is not scoped to a single organization.
- XP is server-canonical: `computeCanonicalUserXp` derives `UserProfile.XP` from point events, and the existing `api/user` endpoint returns per-user XP. The iOS console does not display XP anywhere today.
- The 2026-06-03 gamification design proposed client-side-only missions derived from local data (queued draft counts, synced records). Those missions were never shipped. This spec supersedes that approach with server-authoritative missions.

## Scope

This subproject delivers:

- **Mission model** — server-side table, API views, and Swift types for daily (auto-generated for every collector, reset each day) and weekly (manager-created, assigned to collectors, reset each week) missions with progress tracking.
- **Mission cards UI** (`MissionCardsView.swift`) — collector-facing scrollable card stack showing active missions with progress bars, deadlines, and reward XP. Accessible from the overview tab.
- **Manager mission creation/assignment flow** — form to create a weekly mission with quota, target collectors, deadline, and reward XP. Assignment picker shows org member list filtered to collectors.
- **Public leaderboard view** (`LeaderboardView.swift`) — org-scoped ranking of collectors by submission count and quality. Uses a new org-scoped leaderboard API endpoint.
- **API routes** — two new platform API views (`mission_list`, `mission_create`, `mission_assign`, `mission_progress`) and one new or extended leaderboard endpoint with `organizationId` scoping.
- **Integration with role-based access** — collectors see missions and their own progress; managers/owners create and assign missions; every role sees the leaderboard (consistent with the web console's data-browse access).

It does **not** deliver:

- Server-side mission templates or recurrence rules beyond daily/weekly periods.
- Automated mission generation beyond daily auto-missions (e.g., no "collect 3 pharmacies near X" proximity missions).
- Push notifications for mission deadline reminders (deferred to operational notifications infrastructure).
- Badges, achievements, or tier/level systems (may be a follow-up; the existing XP system and 06-03 badge models are reference material but not implemented here).
- Developer/admin mission analytics or completion-rate dashboards.

## Components

### Mission model

The mission has two source types:

| Field | Daily | Weekly |
|-------|-------|--------|
| Source | Auto-generated for all collectors in an org at midnight | Created by manager/owner |
| Period | `daily` — resets each day | `weekly` — resets each Monday 00:00 UTC |
| Quota | Fixed at 5 submissions (org-configurable later) | Set by manager at creation |
| Reward XP | 10 XP (bonus for completing all daily missions) | Set by manager at creation |
| Assignment | Implicit — every collector in the org gets it | Explicit — manager picks target collectors |
| Progress | Count of `PlatformRecord` submissions today by this collector | Count of submissions this week for assigned project/category |

**Mission lifecycle states:**

```
pending → in_progress → completed
                              ↘ expired
```

- `pending` — mission period has not started yet (weekly missions created before the week begins).
- `in_progress` — mission is active and accepting progress.
- `completed` — collector reached the quota before the deadline. XP is awarded at completion (server-side).
- `expired` — deadline passed without reaching quota.

### Mission cards UI (`MissionCardsView.swift`)

A scrollable vertical card stack shown on the collector's overview, replacing or supplementing the existing `OverviewView` summary tiles for `.collector` role. Also reachable via a dedicated tab pill (MISSIONS) if space permits.

Each card shows:

- Mission title (e.g., "Daily submissions", "Collect 10 pharmacies")
- Mission period label ("Today" / "This week") with deadline timestamp
- Progress bar (`current / quota`) with percentage
- Reward XP badge (terra-colored pill with star icon)
- Completion state: progress bar fills to full, card gets a green checkmark overlay

Empty state: "No active missions. Your manager hasn't assigned any weekly missions yet."

The view model (`MissionsViewModel`) fetches missions from `platform_mission_list` and derives progress from the same endpoint response (the server computes current progress from submission counts).

### Manager mission creation/assignment flow

Two screens:

1. **Mission creation form** (`MissionCreateView.swift`) — manager/owner-only. Fields:
   - Title (bilingual EN/FR)
   - Period: always "weekly" for manager-created missions (daily is auto-generated)
   - Quota (integer, min 1, max 100)
   - Deadline (date picker for end-of-week, defaults to Sunday 23:59 of current week)
   - Reward XP (integer, default 20, max 500)
   - Project scope (optional — picker of org projects; if nil, counts all submissions)
   - Category scope (optional — picker of submission categories)
   - Notes (optional text, bilingual)

2. **Collector assignment picker** (`MissionAssignView.swift`) — multi-select list of org members with role `.collector`. Shows: avatar/initial, name, email. Search/filter by name. Selected collectors appear as a summary tag row.

Both screens are presented as sheets from the Manager's overview or a dedicated MISSIONS tab.

### Public leaderboard view (`LeaderboardView.swift`)

Org-scoped ranking, accessible by every role (consistent with `.data` screen's current access: `role != .collector` blocks data-browse, but leaderboard should be visible to collectors — mirroring the map and overview screens' open access).

Shows:

- Rank number (1-based)
- Contributor display name (same `getPublicDisplayName` redaction as the global leaderboard)
- XP total
- Submission count
- Average quality score (derived from `confidenceScore` per submission)
- Vertical breakdown (icon per category, e.g., pharmacy pill, gas pump, etc.)

The view is a single-section `List` with pull-to-refresh. Top 3 ranks get gold/silver/bronze accent styling.

### API routes needed

New **platform API views**, following the `POST/GET /api/user?view=platform_<name>` convention established by `PlatformAPIClient`:

| View name | Method | Purpose | Params |
|-----------|--------|---------|--------|
| `mission_list` | GET | List missions visible to the caller | `organizationId`, `role` (used server-side for filtering) |
| `mission_create` | POST | Create a new weekly mission | `organizationId`, `titleEn`, `titleFr`, `quota`, `deadline`, `rewardXp`, `projectId?`, `category?`, `notesEn?`, `notesFr?` |
| `mission_assign` | POST | Assign mission to collectors | `missionId`, `targetUserIds: string[]` |
| `mission_progress` | GET | Get progress for a specific mission | `missionId`, `organizationId` |

New or extended **leaderboard endpoint**:

| Endpoint | Method | Purpose | Params |
|----------|--------|---------|--------|
| `GET /api/leaderboard?organizationId=<id>` | GET | Org-scoped leaderboard | `organizationId` (optional — omitting returns the existing global leaderboard) |

The leaderboard extension modifies `api/leaderboard/index.ts` to accept an optional `organizationId` query parameter. When provided, `buildContributionEvents` is filtered to only include events from members of that organization (via the org membership table).

### Integration with role-based access

Access is gated at two levels:

1. **Console nav tab visibility** — MISSIONS tab is visible to all roles (consistent with how MAP and OVERVIEW are open). The leaderboard is a sub-tab of MISSIONS or a standalone tab visible to all roles except `.viewer` (who has read-only access to data but no competitive need for a leaderboard).

2. **Screen-internal feature gates** — Mission creation/assignment buttons are only rendered for `PlatformRoleRank.atLeast(role, .manager)`. The `MissionsViewModel` checks `role` before showing the create button, and the API rejects mission creation from non-manager/non-owner roles with 403.

New `ConsoleScreen` cases:

```swift
case missions = "MISSIONS"
case leaderboard = "LEADERBOARD"
```

`ConsoleNavigation.allDestinations` gets two new entries. `canAccessConsoleScreen` gates:

| Screen | Role access |
|--------|------------|
| MISSIONS | All roles (like OVERVIEW) |
| LEADERBOARD | All roles except `.viewer` |

## Data model

### Swift types (new file `ConsoleModels/Sources/ConsoleModels/PlatformMission.swift`)

```swift
public enum MissionPeriod: String, Codable, Sendable, Equatable {
    case daily = "daily"
    case weekly = "weekly"
}

public enum MissionState: String, Codable, Sendable, Equatable {
    case pending = "pending"
    case inProgress = "in_progress"
    case completed = "completed"
    case expired = "expired"
}

public struct PlatformMission: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let organizationId: String
    public let period: MissionPeriod
    public let state: MissionState
    public let titleEn: String
    public let titleFr: String
    public let quota: Int
    public let current: Int
    public let rewardXp: Int
    public let deadline: String?       // RFC 3339; nil for daily (always end of day)
    public let projectId: String?
    public let category: String?
    public let notesEn: String?
    public let notesFr: String?
    public let assignedUserIds: [String]?
    public let createdAt: String
    public let updatedAt: String

    public var progress: Double {
        guard quota > 0 else { return 0 }
        return min(Double(current) / Double(quota), 1.0)
    }
}

public struct PlatformMissionCreateInput: Codable, Equatable {
    public let organizationId: String
    public let titleEn: String
    public let titleFr: String
    public let quota: Int
    public let deadline: String
    public let rewardXp: Int
    public let projectId: String?
    public let category: String?
    public let notesEn: String?
    public let notesFr: String?
}

public struct PlatformMissionAssignInput: Codable, Equatable {
    public let missionId: String
    public let targetUserIds: [String]
}
```

### API contracts

**platform_mission_list** (GET) response:

```json
{
  "missions": [
    {
      "id": "mission_abc123",
      "organizationId": "org_xyz",
      "period": "daily",
      "state": "in_progress",
      "titleEn": "Daily submissions",
      "titleFr": "Soumissions quotidiennes",
      "quota": 5,
      "current": 3,
      "rewardXp": 10,
      "deadline": null,
      "projectId": null,
      "category": null,
      "notesEn": null,
      "notesFr": null,
      "assignedUserIds": null,
      "createdAt": "2026-07-24T00:00:00Z",
      "updatedAt": "2026-07-24T10:30:00Z"
    }
  ]
}
```

**platform_mission_progress** (GET, returns per-user progress for manager views) response:

```json
{
  "mission": { ... },
  "progress": [
    { "userId": "user_1", "current": 3, "state": "in_progress" },
    { "userId": "user_2", "current": 5, "state": "completed" }
  ]
}
```

### Server-side storage

New table `mission_definitions`:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID PK | Stable mission identity |
| `organization_id` | UUID FK → organizations | Tenant boundary |
| `period` | text | `daily` or `weekly` |
| `title_en` | text | English title |
| `title_fr` | text | French title |
| `quota` | integer | Submission target |
| `deadline` | timestamptz | Weekly deadline (null for daily) |
| `reward_xp` | integer | XP awarded on completion |
| `project_id` | UUID FK → projects | Optional project scope |
| `category` | text | Optional submission category scope |
| `notes_en` | text | English notes |
| `notes_fr` | text | French notes |
| `created_by` | UUID FK → users | Creator (null for auto-generated daily) |
| `created_at` | timestamptz | Creation time |
| `updated_at` | timestamptz | Last update |

New table `mission_assignments`:

| Column | Type | Purpose |
|--------|------|---------|
| `mission_id` | UUID FK → mission_definitions | Mission |
| `user_id` | UUID FK → users | Assigned collector |
| `state` | text | `pending`, `in_progress`, `completed`, `expired` |
| `current` | integer | Current progress count |
| `completed_at` | timestamptz | When collector hit quota |
| `xp_awarded` | boolean | Whether reward XP was granted |

### PlatformAPIClient additions

Following the existing `callPlatform` pattern in `PlatformAPIClient.swift`:

```swift
// MARK: - Missions

private struct MissionsEnvelope: Decodable {
    var missions: [PlatformMission]
}

public func listMissions(organizationId: String) async throws -> [PlatformMission] {
    let envelope: MissionsEnvelope = try await callPlatform(
        "mission_list",
        method: .get,
        params: ["organizationId": organizationId]
    )
    return envelope.missions
}

private struct MissionEnvelope: Decodable {
    var mission: PlatformMission
}

public func createMission(_ input: PlatformMissionCreateInput) async throws -> PlatformMission {
    let bodyData = try JSONEncoder().encode(input)
    let envelope: MissionEnvelope = try await callPlatform("mission_create", method: .post, bodyData: bodyData)
    return envelope.mission
}

public func assignMission(_ input: PlatformMissionAssignInput) async throws {
    let bodyData = try JSONEncoder().encode(input)
    let _: PlatformEmptyResponse = try await callPlatform("mission_assign", method: .post, bodyData: bodyData)
}
```

### AppState factory patterns

Following the existing factory pattern in `AppState.swift`:

```swift
func makeMissionsViewModel(organizationId: String) -> MissionsViewModel {
    MissionsViewModel(
        apiClient: apiClient,
        organizationId: organizationId,
        role: role ?? .collector,
        language: language
    )
}

func makeLeaderboardViewModel(organizationId: String) -> LeaderboardViewModel {
    LeaderboardViewModel(
        apiClient: apiClient,
        organizationId: organizationId,
        language: language
    )
}
```

## Testing strategy

### Unit tests

- Every permitted and forbidden mission state transition (`pending → in_progress`, `in_progress → completed`, `in_progress → expired`).
- Progress calculation: `current / quota` at 0%, 50%, 100%, and past-quota (capped at 100%).
- Daily mission auto-generation logic: all collectors in org receive a mission at midnight reset.
- Weekly mission creation validation: quota min/max, deadline must be in the future, title must be non-empty in at least one language.
- Mission assignment: valid collector IDs, rejection of non-collector roles, deduplication.
- XP award at completion: verify `xp_awarded` flag and `UserProfile.XP` increment.
- Org-scoped leaderboard: entries filtered to org members only, ranking order by ranking score.
- `PlatformMission` Codable round-trip (following `RecordModelTests` pattern).

### API contract tests

- `platform_mission_list` returns only missions visible to the caller's role (manager sees all, collector sees assigned).
- `platform_mission_create` returns 403 for non-manager/non-owner roles.
- `platform_mission_assign` rejects non-existent user IDs, non-collector roles.
- `GET /api/leaderboard?organizationId=<id>` returns filtered results; omitting the param returns the existing global leaderboard.
- Cache-control headers on leaderboard (existing `s-maxage=30` maintained).

### Integration tests

- Mission auto-generation cron: daily at midnight, a scheduled function creates daily missions and resets progress for all active orgs.
- Progress updates: submitting a platform record increments `mission_assignments.current` for all active missions scoped to that project/category.
- XP reconciliation: completing a mission awards XP; `reconcileUserProfileXp` produces the updated total.

### UI tests

- Mission cards render with correct progress bar width, completion overlay, and deadline label.
- Empty state shows "No active missions" copy in EN and FR with the correct illustration/icon.
- Manager create flow: form validation, date picker interaction, quota field accepts numeric input only.
- Assignment picker: multi-select, search, selected tags.
- Leaderboard: ranking order, top-3 accent styling, pull-to-refresh.
- VoiceOver labels on mission cards: title, progress percentage, deadline, reward amount.
- Dynamic Type does not truncate mission card content at largest accessibility size.

## Risk

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Daily mission auto-generation cron misses timezone boundaries | Medium | Medium | Store deadlines in UTC; run cron at 00:00 UTC with a 15-minute grace window; collector sees "Today" label derived from device local time, not server time |
| Mission progress is stale (submission counted but not yet reflected) | Medium | Low | Progress is eventually consistent (driven by submission events); the UI shows the server-returned `current` value and accepts up to 5-minute staleness — missions are motivational, not transactional |
| Manager creates mission targeting a collector who no longer belongs to the org | Low | Low | `platform_mission_assign` validates all `targetUserIds` against current org membership; invalid IDs return 400 with a list of rejected IDs |
| XP double-counted on mission completion + normal submission XP | Medium | Medium | Mission completion XP is separate from submission XP. The server awards mission XP via a separate ledger entry (`xpAction: "mission_reward"`) that is distinct from `getEffectiveEventXp`. `reconcileUserProfileXp` sums both sources without overlap |
| Daily mission auto-generation creates duplicate active missions | Low | Medium | The daily cron upserts: `organization_id + period='daily' + state='in_progress' + created_at::date = today`. If a mission already exists for today, it is reused rather than duplicated |
