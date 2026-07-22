# ADL Console Capture Integrity Foundation Design

**Status:** Approved subproject design

**Program:** `docs/superpowers/specs/2026-07-22-ios-console-public-launch-program-design.md`

**Tracking:** `africandatalayer-c1l`, `africandatalayer-c0k`

## Objective

Replace fabricated schema-photo references and the lossy JSON retry queue with a durable capture system that preserves every record and attachment until verified acknowledgement or explicit user discard. The implementation must continue using the existing `PlatformAPIClient.createPlatformRecord` request and Auth.js backend behavior.

## Current problems

- `CaptureFieldControl.photoFieldControl` toggles a generated `field-photo-…` string without acquiring a photo.
- Record-level photos are prepared as data URLs and embedded directly in `RecordDraft`.
- `FileRecordQueueStore` rewrites one JSON array containing every queued record and embedded photo.
- `RecordQueue.sync` removes records after permanent errors, retry exhaustion, or 72 hours.
- Existing pending work has no durable dead-letter state, export path, or per-record recovery controls.
- The queue cannot isolate one malformed record from the rest of the file.

## Scope

This subproject delivers:

- GRDB dependency and migration infrastructure in `ConsoleCore`.
- A transactional `RecordLedger` with explicit lifecycle states.
- A protected `CaptureMediaStore` for prepared upload bytes.
- Real camera and PhotosPicker acquisition for schema-photo and record-evidence controls.
- A submission adapter that hydrates local files into the existing API payload at send time.
- An atomic and repeatable migration from `FileRecordQueueStore` JSON.
- Pending, retrying, blocked, export, retry, and confirmed-discard user flows.
- Unit, migration, corruption, integration, UI, accessibility, and storage-limit tests.

It does not deliver automatic connectivity/lifecycle scheduling, workspace authorization caching, or global shell status; those belong to Offline Runtime.

## Components

### RecordLedger

`RecordLedger` is an actor-backed repository over one GRDB `DatabasePool`. It is the source of truth for local record state. All state transitions execute in database transactions.

Required operations:

- Create a record and its attachment metadata after media files have been durably staged.
- Fetch one record, all recoverable records for the signed-in owner/org, and all records due for synchronization.
- Atomically claim a due record for one sending attempt.
- Record retryable failure, blocked failure, verified acknowledgement, export receipt, and explicit discard.
- Restore an interrupted `sending` record to a recoverable state on launch.
- Publish a snapshot containing pending, sending, retrying, blocked, and acknowledged-this-session counts.

### CaptureMediaStore

`CaptureMediaStore` stores prepared upload bytes under Application Support in an owner/org/record-scoped directory. Files use `NSFileProtectionCompleteUntilFirstUserAuthentication`. Reconstructible thumbnails and map/image caches are excluded from this directory and may use cache storage.

The stored evidence file is the compressed, orientation-normalized upload representation, not the full camera original. This preserves the exact bytes and checksum that will be submitted while keeping the existing payload cap enforceable.

The preparer preserves the current server-compatible client limits: maximum dimension 1,280 pixels, initial JPEG quality 0.76, quality floor 0.48, and a complete data-URL string no longer than 300,000 characters. These constants move behind the shared media-preparation boundary so schema-photo and record-evidence controls cannot diverge.

Required operations:

- Prepare camera or photo-picker input using the existing dimension and data-URL byte constraints.
- Write to a staging filename, calculate SHA-256, fsync/close, and atomically move into the record directory.
- Resolve attachment bytes by local ID.
- Remove prepared originals only after acknowledgement or explicit discard.
- Quarantine unreadable or checksum-mismatched files without deleting their database metadata.

### CaptureCoordinator

`CaptureCoordinator` separates capture intent from SwiftUI rendering. It validates schema values and evidence requirements, asks the media store to stage attachments, and asks the ledger to commit the record. A submission is considered locally accepted only after this durable commit succeeds.

`CaptureViewModel` may remain the observable façade initially, but persistence, media, and submission logic move behind coordinator/repository protocols. Existing user changes in `CaptureView.swift`, `CaptureViewModel.swift`, and their tests must be preserved and integrated rather than replaced.

### ExistingPayloadSubmissionAdapter

The adapter converts a durable local record into the existing server call:

1. Load the immutable record, schema snapshot, and ordered attachments.
2. Verify attachment checksums.
3. Convert prepared bytes to the existing data-URL string format in memory.
4. Replace local attachment references in schema-photo field values.
5. Populate `PlatformRecordEvidence.photos` for record-level evidence.
6. Call `PlatformAPIClient.createPlatformRecord` with the stored idempotency key.
7. Discard hydrated strings immediately after the attempt returns.

The adapter does not modify the API client signature, request body keys, status mapping, or server storage.

## Durable data model

### `queued_records`

| Column | Purpose |
|---|---|
| `local_id` | Stable UUID primary key |
| `owner_user_id` | User identity that created and may unlock the record |
| `organization_id` | Tenant boundary |
| `project_id` | Existing API project identifier |
| `schema_version_id` | Published schema version used at capture |
| `record_type_key` | Existing record type key |
| `field_values_json` | Validated local values; photo fields contain local attachment IDs |
| `point_id` | Optional enrichment target |
| `captured_at` | Original RFC 3339 capture time |
| `idempotency_key` | Stable key used on every server attempt |
| `state` | Durable lifecycle enum |
| `automatic_attempt_count` | Number of scheduled attempts |
| `next_attempt_at` | Earliest automatic retry time |
| `last_error_class` | Network, server, authentication, authorization, validation, storage, or unknown |
| `last_error_code` | HTTP status or stable local diagnostic code |
| `last_error_message` | Localized-safe recovery explanation; no payload data |
| `server_record_id` | Verified acknowledgement identifier |
| `acknowledged_at` | Successful server acknowledgement time |
| `discarded_at` | Explicit user discard time |
| `created_at`, `updated_at` | Audit timestamps |

### `media_attachments`

| Column | Purpose |
|---|---|
| `local_id` | Stable attachment UUID |
| `record_local_id` | Owning record foreign key |
| `placement` | Record evidence or schema field key |
| `ordinal` | Stable order within its placement |
| `relative_file_path` | App-support path, never an unrestricted absolute path |
| `mime_type` | Existing accepted upload media type |
| `sha256` | Integrity verification |
| `byte_count` | Payload/storage budgeting |
| `pixel_width`, `pixel_height` | Prepared dimensions |
| `state` | Staged, committed, acknowledged, quarantined, or removed |
| `created_at`, `removed_at` | Lifecycle timestamps |

### `queue_migrations`

| Column | Purpose |
|---|---|
| `migration_id` | Stable migration version |
| `source_path` | Legacy queue filename |
| `source_sha256` | Detect source changes and repeated work |
| `source_item_count` | Verification baseline |
| `imported_item_count` | Verification result |
| `state` | Preparing, importing, verified, activated, or failed |
| `failure_code` | Stable diagnostic without record content |
| `started_at`, `completed_at` | Migration audit times |

## State machine

The durable states are:

- `drafting`: UI-only state before durable acceptance; not stored as a queued record.
- `pending`: durable and eligible for an immediate attempt.
- `sending`: claimed by one SyncEngine execution.
- `retryScheduled`: transient failure with `next_attempt_at`; record remains durable.
- `blockedAuthentication`: requires successful sign-in/session refresh.
- `blockedAuthorization`: membership or tenant authority must be refreshed.
- `blockedValidation`: schema or payload correction is required.
- `blockedStorage`: attachment or database integrity requires recovery/export.
- `acknowledged`: server record ID and receipt are stored; local prepared originals may be removed.
- `discarded`: user confirmed removal; sensitive content and media are purged while a minimal tombstone remains.

There is no retry-count or age transition that removes a record. Automatic attempts may stop after the configured backoff budget, but the state becomes blocked/recoverable.

## Error policy

| Condition | Transition | User action |
|---|---|---|
| Network unavailable, timeout, transport error | `retryScheduled` | Wait or Retry now |
| HTTP 500–599 | `retryScheduled` | Wait or Retry now |
| HTTP 401 or offline authorization expired | `blockedAuthentication` | Sign in, then resume |
| HTTP 403 | `blockedAuthorization` | Refresh membership/contact administrator; export or discard remains available |
| HTTP 400/409/422 when not an acknowledged idempotent replay | `blockedValidation` | Show actionable server reason; edit if safe, export, retry, or discard |
| Checksum mismatch or unreadable file | `blockedStorage` | Preserve metadata and quarantine file; export diagnostic/recoverable material |
| Process terminates during `sending` | Restore to `pending` or `retryScheduled` on next launch | Automatic recovery |
| Verified success | `acknowledged` | Show receipt; remove prepared originals |

Unknown failures default to retryable for a bounded automatic budget, then become a generic blocked state. They never default to deletion.

## Legacy JSON migration

Migration runs before the new ledger becomes active:

1. Detect the legacy JSON queue and compute its checksum and item count.
2. Copy it to a versioned rollback backup in a protected, owner-locked recovery directory without modifying the source.
3. Decode each `RecordQueueItem` independently so one malformed item can be reported without erasing other items.
4. Decode embedded data-URL photos into staged media files and map each reference to a stable attachment ID.
5. Insert records, attachments, idempotency keys, retry metadata, and migration journal entries in GRDB.
6. Verify record count, idempotency keys, media byte counts, and checksums against the source.
7. Mark the database migration activated and rename the source to a retained `.migrated-backup` file.

If any verification fails, the new ledger is not activated. The legacy source remains authoritative, staged files remain isolated, and the next launch can resume or restart from the journal. Migration is idempotent by source checksum and migration version.

The backup is not automatically deleted by this subproject. A later release may offer explicit cleanup only after field validation and product approval.

## User experience

### Schema photo fields

- Tapping an empty photo field opens a contextual camera/PhotosPicker choice.
- The field shows a real thumbnail, attachment count, removal control, and any preparation error.
- A required photo field validates only when a durable attachment exists.
- Removing an attachment updates the local draft and deletes an uncommitted staged file.
- Accessibility labels name the field and attachment action in English and French.

### Record evidence photos

The existing evidence section uses the same attachment component and media pipeline. It no longer stores data URLs in observable view-model state or queue JSON.

### Pending work center

The capture surface exposes a route to a pending-work center with sections for Pending, Retrying, Blocked, and Recently acknowledged. Each row shows project, record type, captured time, attachment count, last safe error, and available actions.

Blocked records support Retry, Sign in, Edit where the schema is compatible, Export, and Discard. Discard requires a destructive confirmation that states the number of photos and that server submission has not succeeded.

## Security and privacy

- Files and GRDB use iOS data protection and remain inside the app container.
- Owner and organization IDs scope every query and UI presentation.
- Sign-out locks pending data; it does not delete it.
- Exports require explicit user action and use a system share sheet.
- Logs contain local diagnostic IDs, state transitions, counts, byte sizes, and error classes only.
- Reconstructible thumbnails use cache storage and may be purged by the system.
- Prepared originals are removed after verified acknowledgement; the ledger retains only receipt metadata and checksums.

## Testing strategy

### Unit tests

- Every permitted and forbidden state transition.
- Stable idempotency across retry, relaunch, edit, migration, and app upgrade.
- Field-photo and evidence-photo attachment mapping.
- Retry classification for transport, 5xx, 401, 403, 400, 409, 422, storage, and unknown failures.
- Confirmed discard and acknowledgement cleanup.
- Owner/org query isolation.

### Migration tests

- Empty, one-item, full 75-item, retrying, and mixed-state legacy queues.
- Multiple data-URL photos and schema-photo values.
- Malformed JSON, one malformed item, invalid base64, duplicate IDs, disk-full simulation, interrupted migration, and repeated launch.
- Source and backup remain recoverable when verification fails.

### Integration tests

- GRDB transaction rollback when media or record commit fails.
- Submission adapter produces the same JSON body and idempotency header expected by existing `PlatformAPIClientTests`.
- Successful acknowledgement records the server ID before media cleanup.
- Relaunch after process termination during `sending` recovers the record.

### UI and accessibility tests

- Camera and PhotosPicker success, cancellation, denial, preparation failure, removal, and required-field validation.
- Pending/retrying/blocked list and all recovery actions in English and French.
- VoiceOver names real attachments and destructive discard confirmation accurately.
- Dynamic Type does not hide recovery controls.

## Acceptance gates

The subproject is complete when:

- No code path fabricates a photo reference.
- No automatic transition deletes a non-acknowledged record or attachment.
- The legacy migration passes verification and rollback fixtures.
- The existing server request contract and idempotency header tests remain unchanged and green.
- A queued record survives six retries, 72 hours, relaunch, sign-out, and a simulated storage/API failure.
- A successful record stores its acknowledgement before removing prepared originals.
- A blocked record can be inspected, retried, exported, or explicitly discarded.
- All existing ConsoleCore and ADLConsole tests remain green with the new tests added.

## Dependencies and handoff

This is the first implementation subproject. It produces the `RecordLedger`, `CaptureMediaStore`, record state enum, submission adapter, migration result, and ledger snapshot contracts required by Offline Runtime and Operational Readiness.
