# ADL Console Admin & Operations Design

**Status:** Draft subproject design

**Program:** `docs/superpowers/specs/2026-07-22-ios-console-public-launch-program-design.md`

**Tracking:** — (new subproject)

## Objective

Deliver the iOS console's admin and operations surface — a set of manager/owner-gated screens for running field programs, triaging compliance issues, managing communications, and providing in-app reference material. Every screen must work within the existing role-based navigation (`canAccessConsoleScreen`), reuse existing `ConsoleState` infrastructure, and talk to the existing backend endpoints. The project does not change the backend — it surfaces existing server capability on mobile.

> **Endpoint correction (verified against the codebase 2026-07-24):** the email/SMS/template/lead-queue capabilities are all real, but they are **not** exposed at `/api/email/*` or `/api/sms/*` (those routes do not exist). They live under **`api/privacy`** as `view=` sub-routes (handlers in `api/privacy/index.ts`, logic in `lib/server/email/campaigns.ts`, `lib/server/sms/campaigns.ts`, `lib/server/email/templates.ts`). Batch review is at `api/submissions/batch-review.ts`. The real map:
>
> | Capability | Real endpoint |
> |---|---|
> | List email campaigns | `GET /api/privacy?view=campaigns` |
> | Create email campaign | `POST /api/privacy?view=campaigns` (body validated by `campaignCreateSchema`, `createdBy` from session) |
> | Cancel email campaign | `POST /api/privacy?view=campaigns:cancel` (`{ id }`) |
> | List SMS campaigns | `GET /api/privacy?view=sms-campaigns` |
> | Create/cancel SMS campaign | `POST /api/privacy?view=sms-campaigns` / `?view=sms-campaigns:cancel` |
> | List email templates | `GET /api/privacy?view=email-templates` (`includeArchived` param) |
> | Archive template | `POST /api/privacy?view=email-templates:archive` |
> | Audience size preview (dry-run) | `GET /api/privacy?view=audience-preview` |
> | Lead queue (IP/privacy reports) | `GET /api/privacy?view=ip-reports` (list); `POST /api/privacy?view=ip-report` (file) |
> | Batch review | `POST /api/submissions/batch-review` |
> | Drain scheduled sends (cron) | `GET /api/analytics?view=campaign_drain` (already wired, not a console concern) |
>
> Still-unverified (treat as decision points during implementation, may need a small new `view`): a per-campaign **recipient drill-down** endpoint, and a **report resolution/decision** endpoint (list exists via `ip-reports`; resolve/dismiss action is not confirmed present).

## Current state

The iOS console has a review queue (`ReviewQueueView`) with single-record approve/reject, multi-select approve, and a notification composer. The org picker in `ConsoleShellView` already supports switching organizations, but it re-runs the full landing-route computation; an admin who needs to switch orgs to perform a management action and return sees a full route reload.

Settings (`AppSettingsView`) includes legal links to external URLs (privacy policy, terms, data compliance, IP reporting) — these are SFSafariViewController links, not native screens.

No admin/operations screens exist yet: no communications panel, no lead queue, no campaign history, no rich text editor, no batch review beyond the selection-based approve, no quality info, no data compliance screen, no help center, no sync error audit trail.

## Scope

This subproject delivers:

- A **communications panel** (email campaign list + create flow with template picker, audience filter, schedule picker, send)
- An **SMS campaign companion** alongside the email panel (twin create flow, shared audience builder)
- A **campaign history screen** (sent/failed/suppressed performance per campaign, per-recipient drill-down)
- A **lead queue** for IP/privacy report triage (table with filter/sort, action buttons, detail view)
- A **bulk/batch review enhancement** to the existing review queue (integrate the existing `POST /api/submissions/batch-review` endpoint replacing per-record iteration)
- A **rich text email editor** (branded email creation with a `WKWebView` contenteditable or `UITextView` + `NSAttributedString` toolbar)
- A **quality info documentation screen** (methodology explainer — static local content)
- A **data compliance screen** (GDPR/CCPA explainer — static local content)
- A **help center** (in-app docs browser with search — bundle-loaded markdown)
- A **sync error audit trail** in the admin queue (list sync failures with diagnostics from the ledger)
- **Admin global scope switching** (extend the org picker to let admins switch orgs without leaving their current screen)

It does not deliver:

- New backend endpoints for email/SMS (the existing `lib/server/email/campaigns.ts` and `lib/server/sms/campaigns.ts` are sufficient and are already exposed via `api/privacy?view=campaigns|sms-campaigns|...` — the iOS app only needs an API client wrapper hitting those `api/privacy` routes; see the Endpoint correction table above)
- A full message inbox or two-way messaging
- Automatic campaign delivery scheduling on the client (the backend handles scheduled dispatch; the client sets `scheduledAt`)
- An email WYSIWYG editor equivalent to Mailchimp (the rich text editor is a basic toolbar for bold/italic/headings/links, not a full drag-and-drop builder)
- Any new database tables (existing backend `email_campaigns`, `email_templates`, `sms_campaigns`, `email_campaign_recipients`, `sms_campaign_recipients` tables are sufficient)

## Components

### 1. Communications panel (`CommunicationsView`)

**UI approach:** A tab-picker at the top toggling between Email and SMS, each with a list of existing campaigns and a "+" FAB to create a new one. The list shows subject/message preview, status badge (draft/scheduled/sending/completed/cancelled), recipient count, and sent time. Tapping a row opens the campaign detail.

A companion `CampaignListViewModel` fetches from `PlatformAPIClient.listEmailCampaigns()` and `listSmsCampaigns()` (new API client methods wrapping the existing `GET /api/privacy?view=campaigns` and `GET /api/privacy?view=sms-campaigns`).

**Create flow:** A multi-step form:

1. **Template picker** (Email only): list of saved templates from `GET /api/privacy?view=email-templates`. Selecting one pre-fills subject, HTML body, and text body. The user can also start from scratch.
2. **Audience picker** (shared Email/SMS): a form with pickers for roles (multi-select: agent/admin/client), trust tier (new/standard/trusted/elite/restricted), map scope (multi-select), recency filter (last active N days). Shows estimated recipient count from the dedicated preview endpoint `GET /api/privacy?view=audience-preview` (returns `recipientCount`).
3. **Schedule picker**: immediate send or a `UIDatePicker` for `scheduledAt`.
4. **Review & send**: summary card with subject/message, audience size, schedule. "Send" button calls `POST /api/privacy?view=campaigns` (email) or `POST /api/privacy?view=sms-campaigns` (SMS). The request body must match the server's `campaignCreateSchema`; `createdBy` is taken from the session server-side, not the client.

**Data source:** New `PlatformAPIClient` methods wrapping the existing `api/privacy` routes:

- `GET /api/privacy?view=campaigns` → `listEmailCampaigns()`
- `POST /api/privacy?view=campaigns` → `createEmailCampaign(...)`
- `POST /api/privacy?view=campaigns:cancel` (`{ id }`) → `cancelEmailCampaign(id:)`
- `GET /api/privacy?view=email-templates` → `listEmailTemplates()`
- `GET /api/privacy?view=audience-preview` → `previewAudience(filter:)`
- SMS: `GET/POST /api/privacy?view=sms-campaigns`, `POST /api/privacy?view=sms-campaigns:cancel`
- Note: there is **no** `getEmailCampaign(id:)` single-fetch route today; `listCampaigns` returns the full list. If a detail fetch is needed, either derive it from the list response or add a small `view=campaign` server sub-route.

**Integration with role-based access:** New `ConsoleScreen.communications` case, gated to `.manager` and `.owner` (same as members/projects). Added to `canAccessConsoleScreen` and `ConsoleNavigation.allDestinations`.

### 2. Lead queue management (`LeadQueueView`)

**UI approach:** A split view: top half is a sortable/filterable table of pending IP/privacy reports. Columns: report type (IP infringement / privacy violation), reporter email, submitted date, status (pending/investigating/resolved/dismissed), target entity. Bottom half or side sheet is the detail view when a row is tapped.

Filters: status, type, date range. Sort: date (default descending), status.

**Action buttons per row:** View details, Assign to self, Mark as resolved (with notes), Dismiss (with reason).

**Detail view:** Full report text, any uploaded evidence attachments (displayed as thumbnails with tap-to-preview), reporter info, audit log of status changes.

**Data source:** The lead queue list already exists — `GET /api/privacy?view=ip-reports` returns the IP/privacy report queue; reports are filed via `POST /api/privacy?view=ip-report`. Wrap those in new client methods. **Verify during implementation:** a resolve/dismiss **decision** endpoint is not confirmed to exist — if `api/privacy` has no `ip-report:resolve` (or similar) view, a small new server sub-route is needed for the resolve/dismiss actions (this is the one place in this subproject that may require a backend addition).

**Integration with role-based access:** New `ConsoleScreen.leadQueue` case. Gated to `.manager` and `.owner`.

### 3. Campaign history (`CampaignHistoryView`)

**UI approach:** A list similar to the communications panel but focused on completed/sent campaigns only. Shows per-campaign metrics:

- Subject/message preview
- Sent / failed / suppressed counts (as a horizontal bar or three-chip display)
- Delivery rate (sent / total × 100)
- Created date, completed date
- Tap → per-recipient drill-down list (recipient email, status, sent time, error if failed)

**Drill-down:** A `CampaignRecipientListView` showing `email_campaign_recipients` or `sms_campaign_recipients` rows with status and error text. Supports searching by email.

**Data source:** Same as Communications panel — `listEmailCampaigns()` / `listSmsCampaigns()` (i.e. `GET /api/privacy?view=campaigns` / `sms-campaigns`) already return per-campaign sent/failed/suppressed counts. **The per-recipient drill-down endpoint does not exist yet** — `listCampaigns` returns campaign-level rows, not the `email_campaign_recipients` breakdown. This drill-down needs a small new server sub-route (e.g. `GET /api/privacy?view=campaign-recipients&id=<id>`); scope it as the one net-new backend view for this screen, or defer the drill-down.

**Integration:** Reached from the Communications panel (a "History" tab or button at the top), or as a standalone destination. Gated same as Communications.

### 4. Rich text email editor (`EmailEditorView`)

**UI approach:** A view with:

- Subject text field
- Body area: a `WKWebView` loaded with a `contenteditable` HTML document that includes ADL brand CSS (navy/gold/terra palette, standard font stack, responsive container). A toolbar above the keyboard (or a floating bar) with buttons for: bold, italic, underline, heading (H2/H3), bullet list, link insert, image embed (URL-based), undo/redo.
- The WKWebView communicates formatting commands back to Swift via `WKUserContentController` message handlers (or a `UITextView` + `NSAttributedString` fallback if WKWebView proves too heavy for offline).
- Plain text / source HTML toggle for power users.

**Alternative (recommended):** `UITextView` with `NSAttributedString` and a custom inputAccessoryView toolbar. This avoids WKWebView's memory overhead and works fully offline. Supported attributes: bold, italic, underline, font size/color, paragraph styles. The attributed string is converted to HTML server-ready format via `NSAttributedString.DocumentType.html` export.

**Data source:** No API call until save — the editor produces HTML + plain text strings, which are submitted to `POST /api/email/campaigns` (or saved as a template via `POST /api/email/templates`).

**Integration:** Accessed from the Communications panel's create flow (step 1: template picker or start blank → step 1.5: open editor → set subject + body → step 2: audience picker).

### 5. Bulk/batch review enhancement (`ReviewQueueBatchExtension`)

**Current state:** `ReviewQueueView` already has multi-select and a "mass-approve" action that iterates the selection calling the per-record `reviewPlatformRecord` endpoint sequentially. This works but is O(n) network calls.

**Enhancement:** Add an alternative path using the existing `POST /api/submissions/batch-review` endpoint. The view-model:

1. Collects selected `eventId`s (these map to record IDs in the submission system).
2. Calls `apiClient.batchReviewRecords(eventIds: decision: notes:)` — a new wrapper for the batch-review route.
3. Processes the per-item result array: items with `status: "ok"` are removed from the local list; items with `"error"` or `"skipped"` stay selected and surface per-item error messages.

The existing per-row approve/reject path is unchanged. The batch endpoint is used only for multi-select approval (and a future multi-select reject). This is net-new functionality on top of what exists, not a replacement.

**Data source:** New `PlatformAPIClient` method wrapping `POST /api/submissions/batch-review`. Body: `{ eventIds: [string], decision: "approved" | "rejected", notes?: string }`. Response: `{ results: [{ eventId, decision, status, error?, skippedReason? }], skippedCount: number }`.

**Integration:** Replaces the iteration approach in `ReviewQueueViewModel.approveSelected()` when the batch endpoint is available (feature-flag gated initially, or directly switched).

### 6. Quality info documentation (`QualityInfoView`)

**UI approach:** A plain scrollable view with styled text and illustrations, loaded from a local bundle asset (JSON or markdown). Sections:

- Data collection methodology (how field agents capture, how GPS/photos/fields are structured)
- Review process (how approval/rejection works, reviewer training standards)
- Trust tiers (how contributor trust is calculated — new/standard/trusted/elite)
- Data freshness (how often data is updated, what triggers re-capture)

Illustrations are app-bundled PNG/PDF assets (methodology diagrams, tier pyramid, lifecycle flow).

**Data source:** Local bundle files (`QualityInfoContent.json` or directory of `.md` files). No network call. Rendered via a simple markdown-to-AttributedString parser or a `MarkdownUI` renderer (if the dependency is acceptable).

**Integration:** New `ConsoleScreen.qualityInfo` case. Gated to all roles (it is informational, not admin-only). Added to a "Resources" section in the settings screen or as a pill in the main nav.

### 7. Data compliance screen (`DataComplianceView`)

**UI approach:** A scrollable view similar to Quality Info, with expandable sections covering:

- GDPR rights (access, rectification, erasure, portability, objection)
- CCPA rights (know, delete, opt-out)
- Data retention policy
- How to exercise rights (link to `privacy@africandatalayer.com`, inline form for deletion request)
- Third-party data sharing disclosures
- Data Processing Agreement (DPA) information

**Data source:** Local bundle content (same approach as Quality Info). A "Request data export" button that triggers the existing data export flow from the Capture Integrity subproject.

**Integration:** Replaces the external URL in `AppSettingsView`'s legal section ("Data & Compliance") with an in-app navigation to this screen. New `ConsoleScreen.dataCompliance` case. Gated to all roles.

### 8. Help center (`HelpCenterView`)

**UI approach:** A master-detail layout:

- **Master (list):** Categories (Getting Started, Capture Guide, Review Guide, Account & Billing, Troubleshooting, FAQ). Each category shows a disclosure arrow and the first few words of its first article.
- **Detail (article):** Rendered markdown with images, code blocks (for API docs if applicable), and "Was this helpful?" feedback buttons at the bottom.
- **Search:** A search bar at the top that filters articles by title and keywords (fuzzy prefix match on a local search index).

**Data source:** Bundle-loaded markdown files in `HelpCenter/` directory. Articles are `.md` files with YAML frontmatter for title, category, keywords, and order. A lightweight search index is built at first launch (in memory) from keywords and titles.

**Integration:** New `ConsoleScreen.helpCenter` case. Gated to all roles. Added to the menu in the app header (alongside Settings) or as a bottom pill in the main nav.

### 9. Sync error audit trail (`SyncAuditView`)

**UI approach:** A list within the existing Pending Work center or a new subtab of the admin queue. Shows sync failure records from the `RecordLedger` queried by `last_error_class IS NOT NULL` and `state` in `{retryScheduled, blockedAuthentication, blockedAuthorization, blockedValidation, blockedStorage}`.

Each row shows:

- Record type and captured time
- Error class (network/server/auth/validation/storage)
- Error code (HTTP status or local diagnostic)
- Error message (localized-safe)
- Retry count and next retry time
- Action: Retry now, View details (open the record in inspection), Export diagnostic

**Data source:** `RecordLedger.queryFailures(ownerUserID:organizationID:)` — a new query method that returns failed/blocked records with their error metadata. Uses the existing `queued_records` table (from Capture Integrity) filtered by error state.

**Integration:** Reached from the Pending Work center ("Failed syncs" section), or as a new `ConsoleScreen.syncAudit` case gated to `.manager` and `.owner`.

### 10. Admin global scope switching (`ScopeSwitcherExtension`)

**Current state:** `ConsoleShellView` already has an org picker in the header (a `Menu` of organizations). Switching orgs calls `appState.selectOrganization(organizationId:)`, which recomputes the landing route and forces a navigation to the new org's landing screen. This means an admin on the Members screen of Org A who switches to Org B gets thrown to Org B's Overview — they cannot stay on the same screen type.

**Enhancement:** Extend `selectOrganization` (or add a new `switchOrganizationPreservingRoute`) to allow switching orgs while remaining on the same screen type. The behavior:

1. If the current screen type is accessible in the target org's role, stay on it (but reload its data with the new `organizationId`).
2. If the current screen type is NOT accessible in the target org's role, fall back to the landing route (same as today).
3. The header shows the current org name and avatar, updating instantly on switch.

Implementation: `AppState.switchOrganization(organizationId:)`:

```swift
func switchOrganization(organizationId: String) {
    guard let membership = organizations.first(where: { $0.organization.id == organizationId }),
          membership.organization.id != organization?.id
    else { return }
    let currentScreen = route.screen
    organization = membership.organization
    role = membership.role
    if canAccessConsoleScreen(role: membership.role, screen: currentScreen, isAdlAdmin: isAdlAdmin) {
        route = ConsoleRoute(screen: currentScreen) // same screen, will reload via .task/.onChange
    } else {
        route = consoleLandingRoute(role: membership.role)
    }
    // persist selection, refresh runtime etc (same as selectOrganization tail)
}
```

The existing `selectOrganization` is unchanged for the initial landing case. The `Menu` in the header calls `switchOrganization` instead when the user is already inside a screen.

## Data model additions

### New `ConsoleScreen` cases

```swift
case communications = "COMMUNICATIONS"
case leadQueue = "LEAD_QUEUE"
case campaignHistory = "CAMPAIGN_HISTORY"
case qualityInfo = "QUALITY_INFO"
case dataCompliance = "DATA_COMPLIANCE"
case helpCenter = "HELP_CENTER"
case syncAudit = "SYNC_AUDIT"
```

### Updated access matrix (`canAccessConsoleScreen`)

| Screen | collector | reviewer | manager | owner | isAdlAdmin |
|---|---|---|---|---|---|
| communications | — | — | ✓ | ✓ | — |
| leadQueue | — | — | ✓ | ✓ | — |
| campaignHistory | — | — | ✓ | ✓ | — |
| qualityInfo | ✓ | ✓ | ✓ | ✓ | — |
| dataCompliance | ✓ | ✓ | ✓ | ✓ | — |
| helpCenter | ✓ | ✓ | ✓ | ✓ | — |
| syncAudit | — | — | ✓ | ✓ | — |

### New API client methods

All wrap the existing `api/privacy` / `api/submissions/batch-review` routes (see the Endpoint correction table). **Exceptions** that may need a small new server `view`: `listEmailCampaignRecipients` / `listSmsCampaignRecipients` (drill-down) and `resolveLeadQueueItem` (report decision). Everything else is a pure client wrapper — no backend change.

```swift
// Email campaigns
func listEmailCampaigns(limit: Int = 50) async throws -> [EmailCampaign]
func getEmailCampaign(id: String) async throws -> EmailCampaignDetail
func createEmailCampaign(_ input: EmailCampaignCreateInput) async throws -> EmailCampaign
func cancelEmailCampaign(id: String) async throws -> Bool

// Email templates
func listEmailTemplates(includeArchived: Bool = false) async throws -> [EmailTemplate]

// SMS campaigns
func listSmsCampaigns(limit: Int = 50) async throws -> [SmsCampaign]
func createSmsCampaign(_ input: SmsCampaignCreateInput) async throws -> SmsCampaign
func cancelSmsCampaign(id: String) async throws -> Bool

// Batch review
func batchReviewRecords(eventIds: [String], decision: ReviewDecision, notes: String?) async throws -> BatchReviewResponse

// Lead queue
func listLeadQueueItems(filters: LeadQueueFilter) async throws -> [LeadQueueItem]
func resolveLeadQueueItem(id: String, decision: LeadDecision, notes: String?) async throws -> LeadQueueItem

// Campaign recipients (drill-down)
func listEmailCampaignRecipients(campaignId: String, search: String?) async throws -> [CampaignRecipient]
func listSmsCampaignRecipients(campaignId: String, search: String?) async throws -> [SmsCampaignRecipient]
```

### Request/response types

All map 1:1 to the backend Zod schemas in `campaigns.ts`, `templates.ts`, and `batch-review.ts`.

```swift
struct EmailCampaignCreateInput: Codable {
    var subject: String
    var htmlBody: String
    var textBody: String
    var language: CampaignLanguage // en | fr
    var recipientMode: RecipientMode // audience | manual
    var audience: AudienceFilter
    var manualRecipients: [String]
    var cc: [String]
    var scheduledAt: Date?
    var dryRun: Bool?
}

struct AudienceFilter: Codable {
    var roles: [PlatformRole]?
    var trustTiers: [TrustTier]?
    var mapScopes: [String]?
    var requireEmailOptIn: Bool?
    var lastActiveDays: Int?
}

struct BatchReviewInput: Codable {
    var eventIds: [String]
    var decision: ReviewDecision // "approved" | "rejected"
    var notes: String?
}
```

## Testing strategy

### Unit tests

- Every new `ConsoleScreen` case is tested through `canAccessConsoleScreen` for each role (cross-checked against the matrix above).
- `CampaignListViewModel` parsing and filtering from mock API responses.
- `AudienceFilter` serialization matches backend Zod schema.
- `EmailEditorViewModel` HTML export from `NSAttributedString` produces valid fragment.
- `AppState.switchOrganization` preserves or falls back route correctly for every role/screen combination.
- `LeadQueueViewModel` filter/sort logic.
- `SyncAuditViewModel` error classification mapping.
- `RecordLedger.queryFailures` returns only error-state records.

### Integration tests

- Communications create + list round-trip against mock API transport.
- Batch-review submission matches backend contract (existing `PlatformAPIClientTests` pattern).
- Org switch + screen preservation: verify that switching orgs with a compatible role stays on the same screen type; switching to an incompatible role lands on the correct fallback.

### UI and accessibility tests

- Communications panel: create flow (template picker → audience → schedule → review), cancel, history drill-down.
- Lead queue: filter, sort, resolve, dismiss.
- Rich text editor: bold/italic/heading/link toolbar buttons produce correct attributed string.
- Help center: search returns expected articles; article renders markdown.
- Sync audit: error list shows correct diagnostics; retry action triggers sync.
- All new screens tested in English and French.
- VoiceOver labels for campaign status badges, audience picker roles, lead queue actions, editor toolbar buttons.
- Dynamic Type does not clip audience picker or lead queue rows.

## Risk

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| WKWebView rich text editor has poor offline behavior or memory pressure | Medium | Medium | Start with `UITextView` + `NSAttributedString` + `inputAccessoryView` toolbar; WKWebView is the fallback only if attributed-to-HTML conversion loses too much formatting |
| Audience filter UI is complex and hard to use on a phone | Medium | Medium | Build the audience picker as a single scrollable form with section headers and estimated-recipient-count preview; test on mid-range iPhone SE screen sizes |
| Email campaign creation from scratch (no template) produces un-branded HTML | Low | Low | The rich text editor loads a base HTML template with ADL brand CSS; new campaigns always start from that template |
| Batch-review endpoint expects `eventId` (submission event ID), but console operates on `PlatformRecord.id` | High | High | Map record IDs to event IDs before calling the batch endpoint; verify mapping in the API layer or add a `submissionEventId` field to the record model |
| Scope switching preserves route but the new org may have different projects/schemas, causing stale view state | Medium | Medium | Each view-model already re-fetches on `organizationId` change via `.task(id: appState.organization?.id)` or `.onChange`; verify all admin VMs follow this pattern |

## Dependencies and handoff

This subproject depends on:

- The existing `lib/server/email/` and `lib/server/sms/` backend modules, exposed as `api/privacy?view=campaigns|sms-campaigns|email-templates|audience-preview|ip-reports` (verified present in `api/privacy/index.ts`). Two drill-down/decision views (campaign-recipients, report-resolution) are **not** confirmed and may be the only backend additions this subproject needs.
- The existing `api/submissions/batch-review.ts` endpoint (already deployed)
- `ConsoleState.ConsoleScreen` from ConsoleCore (extended with new cases)
- `PlatformAPIClient` from ConsoleAPI (extended with new methods)
- `RecordLedger` from the Capture Integrity subproject (for sync audit query)

It handoffs to:

- The next admin iteration (two-way messaging, automated campaign triggers, contributor NPS survey results)
- Release configuration (API base URL configuration for staging/production endpoint verification)
