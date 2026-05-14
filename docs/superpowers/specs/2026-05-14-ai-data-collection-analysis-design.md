# AI Data Collection, Analysis, and POI Enrichment - Design Spec

**Date:** 2026-05-14
**Author:** Charles Victor Mahouve (with Codex)
**Status:** Approved direction - ready for implementation plan after user review
**Primary surfaces:** Field capture, admin review, client analytics, external POI enrichment

---

## 0. Context

African Data Layer already has the right foundation for AI-assisted data work:

- Field submissions with photo, GPS, EXIF, device, consent, and fraud metadata.
- Event-sourced `point_events` with `source` and `external_id`.
- Vertical-specific schemas in `shared/verticals.ts`.
- Deduplication in `lib/server/dedup.ts`.
- Risk scoring in `lib/server/submissionRisk.ts`.
- Snapshot, delta, and spatial intelligence pipelines in `lib/server/snapshotEngine.ts` and `lib/server/spatialIntelligence.ts`.
- A Gemini-backed local search endpoint in `api/ai/search.ts`.
- Voice input in `components/shared/VoiceMicButton.tsx`.

The approved product direction is: **AI assists every workflow, but verified field evidence remains the trust anchor.**

AI can recommend, extract, summarize, rank, and explain. It cannot replace field verification, admin enforcement, consent checks, or client-facing caveats.

## 1. Goals

### Data collection

- Help agents capture better submissions in fewer attempts.
- Extract structured values from photos and voice, including names, brands, prices, hours, phone numbers, and visible signage.
- Detect incomplete or weak evidence before submit.
- Reduce rejected submissions and admin cleanup.

### Admin review

- Help reviewers understand why a submission is risky.
- Cluster suspicious behavior across user, device, IP hash, time, GPS path, image hash, and content hash.
- Draft coaching feedback to improve future field work.
- Keep final enforcement decisions with humans.

### Client analysis

- Turn trusted snapshots, deltas, and spatial cells into client-readable insight.
- Support natural-language questions over aggregate, permission-safe data.
- Generate weekly and monthly briefs with confidence, caveats, and next validation actions.
- Improve export quality for CSV, GeoJSON, and PDF/report outputs.

### Online POI enrichment

- Use public or licensed POI sources as candidate leads.
- Normalize external POIs into ADL verticals.
- Match and deduplicate against existing field data.
- Route candidates to agents/admins for verification before promotion.

## 2. Non-goals

- No fully autonomous scraping from websites that disallow it.
- No permanent Google Places content store beyond fields allowed by Google policy. Place IDs may be stored; broader Places content requires strict policy review.
- No AI auto-ban, auto-rejection, or automatic trust-tier downgrade in the first release.
- No client-facing causal claims about demographics, income, politics, religion, ethnicity, or protected attributes.
- No hidden AI scoring. Every AI output must carry model/version, confidence, source evidence, and a human-readable reason.
- No replacement of GPS, EXIF, photo, and admin review controls.

## 3. Source and Policy Constraints

### OpenStreetMap

OSM is the preferred first online enrichment source because it is open data under ODbL, with attribution and license obligations. Any public product or export using OSM-derived data must display OSM attribution and make the ODbL license clear.

Sources:

- OpenStreetMap copyright and license: https://www.openstreetmap.org/copyright/no/
- OSMF attribution guidelines: https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
- OSM API policy notes read-heavy users should use extracts/providers, not the editing API: https://operations.osmfoundation.org/policies/api/

### Google Places

Google Places can be useful for discovery and matching, but it is not a good default permanent enrichment source. Google Places policy states that Places API content generally must not be prefetched, cached, or stored beyond allowed exceptions; `place_id` is exempt.

Source:

- Google Places API policies: https://developers.google.com/maps/documentation/places/web-service/policies

### Practical rule

Use OSM/Overpass or licensed data providers for stored candidate POIs. Use Google only for user-facing search or transient verification flows unless a reviewed license path explicitly permits storage.

## 4. Architecture

Add one AI foundation layer and four feature modules.

```text
Field app
  -> capture copilot API
  -> point_events
  -> fraud/risk + snapshots/deltas

Admin app
  -> review assistant API
  -> risk summaries + reviewer decisions

Client app
  -> analytics assistant API
  -> aggregate snapshots/deltas/spatial intelligence

POI enrichment jobs
  -> source adapters
  -> external_poi_candidates
  -> dedup/match queue
  -> agent/admin verification
  -> point_events when accepted
```

### Shared AI foundation

New server namespace:

```text
lib/server/ai/
  modelClient.ts
  promptContracts.ts
  outputSchemas.ts
  safety.ts
  audit.ts
  redaction.ts
  evaluation.ts
```

Responsibilities:

- Validate prompt input and model output with Zod schemas.
- Redact personal data before model calls when the task does not need it.
- Store all AI outputs in audit tables.
- Enforce rate limits and role permissions at API boundaries.
- Normalize confidence fields to `0..1`.
- Attach `model_provider`, `model_name`, `model_version`, `prompt_version`, and `created_at`.

## 5. Module A - Field Capture Copilot

### User experience

In `ContributionFlow`, after photo capture or voice input:

- Agent sees AI suggestions as editable draft fields.
- Agent can accept, edit, or ignore each suggestion.
- AI warning appears only when it helps capture quality: blurry photo, weak text, missing storefront, GPS mismatch, missing required field, likely duplicate.
- Low-end/offline behavior degrades gracefully: keep current manual flow.

### Features

- Photo vertical classifier.
- OCR and visual extraction.
- Bilingual voice-to-form cleanup.
- Missing-field advisor using `shared/verticals.ts` required/enrichable fields.
- Duplicate warning using existing `buildDedupCandidates`.
- Evidence quality hints.

### Server API

```text
POST /api/ai/extract-submission
```

Input:

- `category` or null when unknown.
- `imageData` or hosted photo URL.
- `location`.
- `language`.
- `draftDetails`.

Output:

- `detectedCategory`.
- `fieldSuggestions[]`.
- `qualityWarnings[]`.
- `duplicateCandidates[]`.
- `confidence`.
- `modelMetadata`.

### Persistence

Table: `ai_extractions`

Core columns:

- `id`
- `submission_draft_id`
- `event_id`
- `user_id`
- `category`
- `input_hash`
- `output_json`
- `accepted_fields_json`
- `rejected_fields_json`
- `model_provider`
- `model_name`
- `prompt_version`
- `created_at`

## 6. Module B - Admin Review Assistant

### User experience

In `AdminQueue`, each pending/review-risk item gets:

- A one-paragraph risk summary.
- Top positive evidence.
- Top risk drivers.
- Suggested reviewer checklist.
- Draft agent feedback in EN/FR.
- Cluster link when similar suspicious submissions exist.

The assistant does not approve, reject, suspend, or reduce trust automatically.

### Features

- Risk explanation from `riskScore`, `riskComponents`, `reviewFlags`, EXIF status, GPS integrity, velocity, duplicate hashes, and user trust.
- Suspicious cluster detection by shared device, image/perceptual hash, IP hash, repeated location, impossible travel, and content hash.
- Agent coaching draft.
- Reviewer decision quality logging.

### Server API

```text
POST /api/ai/review-summary
GET /api/ai/review-clusters?status=pending_review
```

Output:

- `summary`.
- `recommendedChecks[]`.
- `riskDrivers[]`.
- `supportingEvidence[]`.
- `caveats[]`.
- `agentFeedbackDraft`.
- `confidence`.

### Persistence

Table: `ai_review_summaries`

Core columns:

- `id`
- `event_id`
- `point_id`
- `review_status_at_generation`
- `risk_score_at_generation`
- `summary_json`
- `reviewer_action`
- `reviewer_feedback`
- `model_provider`
- `model_name`
- `prompt_version`
- `created_at`

## 7. Module C - Client Data Analyst

### User experience

In `DeltaDashboard` and client dashboards:

- Client asks natural-language questions over aggregate data.
- Response includes answer, evidence table, charts/data references, confidence, caveats, and export CTA.
- Weekly brief generation produces a structured report draft, not free-form unverifiable prose.

### Features

- Natural-language query over `snapshot_stats`, `snapshot_deltas`, `spatial_intelligence`, and KPI endpoints.
- Weekly vertical brief generator.
- Coverage gap explanation.
- Market movement summary.
- Export copy generation for PDF/report surfaces.

### Server APIs

```text
POST /api/ai/analytics-query
POST /api/ai/report-draft
```

Inputs:

- `question`.
- `vertical`.
- `zone`.
- `dateRange`.
- `clientScope`.
- `exportFormat`.

Output:

- `answer`.
- `facts[]` with source query references.
- `charts[]` or existing dashboard links.
- `caveats[]`.
- `suggestedNextValidations[]`.
- `confidence`.

### Persistence

Table: `ai_analytics_runs`

Core columns:

- `id`
- `user_id`
- `role`
- `client_scope`
- `question`
- `query_plan_json`
- `answer_json`
- `model_provider`
- `model_name`
- `prompt_version`
- `created_at`

## 8. Module D - Online POI Enrichment

### Data principle

External POIs are **leads**, not verified ADL points.

They should enter a candidate queue, be scored for usefulness and match confidence, then be field-verified or admin-approved before becoming `point_events`.

### Source adapters

```text
lib/server/poi/
  sourceAdapters/osmOverpass.ts
  sourceAdapters/manualCsv.ts
  normalizePoi.ts
  candidateMatcher.ts
  candidateScoring.ts
  promoteCandidate.ts
```

Initial sources:

- OSM/Overpass for pharmacies, fuel stations, mobile money-like finance/payment tags where available, roads, transport stops, billboards where tagged.
- Manual CSV import for partner or research datasets.

Later sources:

- Licensed commercial POI providers.
- Government or open-data portals with explicit reuse rights.

### Candidate lifecycle

```text
discovered
  -> normalized
  -> matched_to_existing | needs_field_verification | rejected
  -> assigned_to_agent
  -> verified
  -> promoted_to_point_event
```

### Matching logic

Use existing `buildDedupCandidates` as the core, then extend with:

- Source ID exact match.
- Name similarity.
- Category/vertical mapping.
- Distance by vertical.
- Brand/operator match.
- Address or road-name similarity when present.
- Recency and source reliability.

### Tables

Table: `external_poi_candidates`

Core columns:

- `id`
- `source`
- `source_license`
- `source_attribution`
- `external_id`
- `raw_json`
- `normalized_json`
- `category`
- `latitude`
- `longitude`
- `name`
- `match_status`
- `matched_point_id`
- `match_score`
- `confidence`
- `needs_field_verification`
- `assigned_to`
- `created_at`
- `updated_at`

Table: `poi_source_runs`

Core columns:

- `id`
- `source`
- `zone_id`
- `verticals_json`
- `started_at`
- `completed_at`
- `status`
- `fetched_count`
- `candidate_count`
- `matched_count`
- `error_message`

### APIs

```text
POST /api/poi/import/osm
GET /api/poi/candidates
PATCH /api/poi/candidates/:id
POST /api/poi/candidates/:id/promote
POST /api/poi/candidates/:id/assign
```

Admin-only:

- Start imports.
- Review candidates.
- Promote candidates.

Agent-visible:

- Assigned POI verification tasks.
- Candidate context shown as "unverified lead" with source attribution.

## 9. Data Flow Details

### Field capture flow

1. Agent takes photo or speaks details.
2. Client calls extraction endpoint when online and battery/network allow.
3. AI returns suggestions and warnings.
4. Agent edits/accepts.
5. Submission goes through existing validation, fraud, and risk scoring.
6. Accepted AI suggestions are stored for evaluation.

### Review flow

1. Risk engine marks submission `pending_review` or admin opens item.
2. Admin requests or preloads AI review summary.
3. Summary uses only internal evidence and no hidden unsupported claims.
4. Reviewer takes final action.
5. Reviewer action is logged against the summary for evaluation.

### Client analysis flow

1. Client asks question or requests brief.
2. Server builds deterministic query plan first.
3. AI writes explanation from query results only.
4. Response shows facts and caveats.
5. Export surfaces use same answer object.

### POI enrichment flow

1. Admin starts OSM import for zone/vertical.
2. Adapter fetches candidates using compliant source path.
3. Normalizer maps tags to ADL categories/details.
4. Matcher compares to current projected points.
5. High-confidence existing matches enrich candidate metadata only.
6. Unmatched valuable candidates become verification tasks.
7. Verified candidate promotion writes a `point_events` row with `source` and `external_id`.

## 10. Security, Privacy, and Fairness

### Privacy

- Redact phone/email/user identity where not needed.
- Never send private agent profile data to client-facing analysis prompts.
- Do not include real faces or personal details in model calls unless consent and purpose are explicit.
- Store only output needed for audit and evaluation.

### Safety

- AI outputs are advisory.
- Enforcement stays rule-based plus admin decision.
- Client outputs must include caveats when evidence is thin.
- External POIs remain labeled unverified until checked.

### Bias controls

Evaluate AI and matching quality by:

- Language: EN vs FR.
- Device class: low-end vs higher-end.
- Agent trust tier.
- Zone/neighborhood.
- Vertical/category.

Required metrics:

- Suggestion acceptance rate.
- Rejection rate after accepted AI suggestions.
- False positive review-assistant concern rate.
- POI match false positive rate.
- Client answer citation completeness.

## 11. Observability

Every AI call logs:

- Route.
- User role.
- Input hash, not full private input.
- Model/provider/prompt version.
- Token/cost estimates when available.
- Latency.
- Outcome status.
- Confidence.
- Error class.

Dashboards should track:

- AI extraction usage.
- Accepted vs rejected suggestions.
- Admin summary usage and reviewer overrides.
- Report generation count.
- POI candidates discovered, assigned, verified, promoted, rejected.

## 12. Rollout Plan

### Phase 1 - POI candidates and capture copilot

Build:

- OSM/Overpass import into `external_poi_candidates`.
- Candidate matching with current dedup logic.
- Admin candidate list.
- Field photo/voice extraction endpoint.
- Editable suggestions in `ContributionFlow`.

Success gate:

- At least 80% of promoted POI candidates have no duplicate incident after admin review.
- AI suggestions improve completion rate without raising rejection rate.

### Phase 2 - Admin review assistant

Build:

- AI risk summary endpoint.
- AdminQueue summary panel.
- Cluster view.
- Coaching feedback drafts.

Success gate:

- Median review time drops.
- Reviewer override tracking shows summaries are useful and not over-aggressive.

### Phase 3 - Client data analyst

Build:

- Analytics query endpoint.
- Report draft endpoint.
- DeltaDashboard chat/report panel.
- Export-ready narrative sections.

Success gate:

- Client reports cite source facts.
- No unsupported causal claims in QA review.

### Phase 4 - Assignment routing and predictive intelligence

Build:

- Coverage-gap to assignment suggestions.
- Candidate value scoring.
- Price/delta anomaly forecasting.
- Route suggestions based on high-value gaps and agent proximity.

Success gate:

- More verified points per agent hour.
- Better coverage of high-opportunity spatial cells.

## 13. Testing Strategy

### Unit tests

- Prompt input redaction.
- Output schema validation.
- POI tag normalization.
- POI match scoring.
- Analytics query plan validation.
- Safety/caveat generation for weak evidence.

### Integration tests

- `/api/ai/extract-submission` with mocked model output.
- `/api/ai/review-summary` from a seeded risky event.
- `/api/ai/analytics-query` over seeded snapshots/deltas.
- `/api/poi/import/osm` with fixture Overpass response.
- Candidate promotion writes a valid `point_events` row.

### Evaluation tests

- Golden set of field photos or mocked OCR outputs by vertical.
- Golden set of duplicate and non-duplicate POI candidates.
- Admin summaries compared to expected risk drivers.
- Client report outputs checked for citations and forbidden claims.

## 14. Implementation Boundaries

Recommended first implementation slice:

1. Database migrations for `external_poi_candidates`, `poi_source_runs`, and `ai_extractions`.
2. OSM import adapter using fixtures first.
3. Candidate matching and admin candidate list.
4. Capture extraction endpoint with mocked model in tests.
5. ContributionFlow suggestion UI.

This first slice creates immediate data-collection value and sets the audit pattern for the later AI modules.

## 15. Acceptance Criteria

- AI modules have typed inputs and typed outputs.
- AI outputs are stored with model and prompt version metadata.
- No external POI becomes a trusted map point without field/admin verification.
- OSM attribution and license metadata are stored with OSM candidates.
- Google Places content is not stored beyond allowed fields unless a reviewed license path is added.
- Admin enforcement remains human-owned.
- Client analysis includes source facts and caveats.
- Tests cover redaction, schema validation, POI matching, and at least one mocked model flow per module.

## 16. Sources

- OpenStreetMap copyright and license: https://www.openstreetmap.org/copyright/no/
- OSMF attribution guidelines: https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
- OSMF API usage policy: https://operations.osmfoundation.org/policies/api/
- Google Places API policies: https://developers.google.com/maps/documentation/places/web-service/policies
