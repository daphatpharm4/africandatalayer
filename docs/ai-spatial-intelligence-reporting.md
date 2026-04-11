# AI Spatial Intelligence & Monetizable Reporting

**Status:** Phase 1 documented and initial backend slice implemented  
**Owner lens:** `ai-engineer` + `data-engineer`  
**Primary product surface:** explainable, sellable spatial intelligence built on top of ADL's trusted field data

## 1. Goal

ADL should not stop at showing points on a map. It should explain:

- where activity is concentrated
- where meaningful change is happening
- which areas look commercially important
- which areas are under-covered and need more field validation
- what the strongest likely drivers are, with explicit confidence and caveats

The commercial output is not "AI guesses". The commercial output is a repeatable intelligence product:

- neighborhood intelligence briefs
- whitespace and expansion reports
- competitor movement reports
- weekly delta alerts
- API subscriptions for structured intelligence

## 2. What AI Should And Should Not Claim

### Allowed

AI can say:

- "This cell has above-average pharmacy density."
- "This cluster shows elevated publishable change activity."
- "The strongest observed drivers are freshness, evidence quality, operator diversity, and repeated updates."
- "This area appears commercially important but still under-validated."

### Not allowed

AI should not say:

- "This business is here because income is low."
- "This zone is underserved because population is poor."
- "This cluster proves demand from a specific demographic group."

Those are causal claims that require stronger external evidence and bias controls. Phase 1 stays evidence-backed and descriptive. Phase 2 can move into probabilistic causal hypotheses once external context layers and fairness checks are in place.

## 3. Product Thesis

ADL's moat is not just collection. It is:

- trusted last-mile evidence
- recurring freshness
- micro-geographic delta tracking
- informal-sector coverage
- explainable intelligence that buyers can act on

The most sellable sentence is:

> "We do not just show what exists. We show what changed, where it matters, how strong the evidence is, and what to investigate next."

## 4. Existing ADL Foundations

The current codebase already contains the correct primitives:

- event-sourced point capture and replay
- snapshot and delta tables
- confidence scoring
- fraud and GPS anomaly signals
- geohash-based point identity
- vertical-specific schemas
- dashboard and export surfaces

Key files:

- `lib/server/pointProjection.ts`
- `lib/server/snapshotEngine.ts`
- `lib/server/confidenceScore.ts`
- `lib/server/gpsAnomalyDetection.ts`
- `lib/shared/pointId.ts`
- `docs/delta-intelligence.md`
- `docs/team/07-marketing-strategy.md`

## 5. Data Architecture

### Bronze

Immutable operational facts:

- `point_events`
- photos and EXIF-derived integrity checks
- reviewer actions
- contributor metadata
- public or partner enrichment inputs added later

### Silver

Conformed spatial entities and features:

- current projected points
- snapshots by date
- point-level deltas
- per-cell aggregates using `geohash_6`
- freshness, confidence, completeness, and evidence ratios

### Gold

Sellable intelligence outputs:

- `spatial_intelligence` response objects
- top opportunity cells
- coverage-gap cells
- client-ready report facts
- alert candidates by vertical and zone

Phase 1 computes gold facts on demand from snapshots. If usage grows, these should become scheduled persisted gold tables.

## 6. Phase 1 Intelligence Model

### Spatial unit

Use `geohash_6` as the first cell unit because:

- it already exists in the repo's design direction
- it is consistent with current point identifiers
- it avoids a PostGIS dependency for the MVP
- it is good enough for dense urban neighborhood intelligence

### Cell-level metrics

For each `vertical_id x snapshot_date x cell_id`, compute:

- `total_points`
- `completed_points`
- `completion_rate`
- `avg_confidence_score`
- `photo_coverage_rate`
- `recent_activity_rate`
- `publishable_change_count`
- `new_count`
- `removed_count`
- `changed_count`
- `operator_diversity`
- `median_freshness_days`

### Derived scores

#### Market signal score

How strong and commercially meaningful the current signal looks.

Inputs:

- point density percentile
- change intensity percentile
- operator diversity percentile
- recent activity rate

#### Opportunity score

How promising the cell is for reporting and client attention right now.

Inputs:

- density percentile
- change intensity percentile
- confidence ratio
- completeness ratio
- photo coverage ratio

#### Coverage gap score

How badly the area needs more evidence before strong claims should be made.

Inputs:

- incomplete field coverage
- weak photo coverage
- low confidence

## 7. Explainability Contract

Every ranked cell must return:

- a short summary sentence
- top positive drivers
- top negative drivers or caveats
- explicit score values

Example:

> "This mobile money cell stands out because it has above-average density, repeated publishable changes, and strong evidence quality. Watch-out: photo coverage remains weak."

This is the minimum standard for anything shown to a client or used by an LLM report writer.

## 8. Monetizable Outputs

### A. Weekly neighborhood intelligence brief

- top opportunity cells
- major changes since baseline
- strongest likely drivers
- confidence and caveats
- next validation actions

### B. Competitor movement report

- where new outlets appear
- where brands or operators shift
- where churn accelerates
- what changed relative to last week or month

### C. Expansion / whitespace report

- high-signal but low-coverage cells
- areas where expected density and observed density diverge
- recommended field routes for closing evidence gaps

### D. Alerting product

- sudden new-cluster formation
- elevated removals
- unusual churn
- change spikes in premium cells

## 9. Likely Best Early Buyers

Based on repo strategy and current fields, the strongest early wedges are:

1. Mobile money operators and fintechs
2. Pharmacy / health distribution actors
3. FMCG and alcohol brands needing retail audit intelligence
4. Out-of-home advertising stakeholders for billboard movement

Best first outputs:

- "Bonamoussadi Agent Landscape"
- "Pharmacy Formal vs Informal Change Brief"
- "Billboard Campaign Shift Report"

## 10. Guardrails

### Data and modeling

- Coverage bias must be surfaced, not hidden.
- Low-confidence cells must be labeled explicitly.
- Freshness must be included in every report.
- Gold outputs must never read directly from raw events in client-facing flows.

### AI safety

- No demographic inference from coordinates alone
- No protected-attribute profiling
- No causal wording without supporting data
- Explanations must come from structured evidence, not free-form hallucination

## 11. Phase Roadmap

### Phase 1: Explainable heuristics on ADL-first data

Deliver:

- cell intelligence API
- ranked opportunity and coverage-gap cells
- structured drivers and caveats
- report-ready narrative summary

### Phase 2: External context enrichment

Add:

- roads and transport nodes
- market and landmark proximity
- building or settlement density proxies
- public POI baselines
- satellite-derived context where useful

Deliver:

- "why here" hypotheses with stronger context
- expected vs observed density models

### Phase 3: Predictive intelligence

Add:

- zone-level forecasting
- likely new-entry or churn zones
- client-specific alerting thresholds

## 12. Initial Build Scope

The initial build in this repo should do four things:

1. Expose a new analytics view for spatial intelligence
2. Aggregate snapshots and deltas into `geohash_6` cells
3. Return opportunity, market-signal, and coverage-gap scores with explanations
4. Produce narrative facts that a later PDF or LLM report layer can consume safely

## 13. Non-Goals For This First Slice

- Full ML training pipeline
- PostGIS migration
- Satellite ingestion
- Automated PDF generation
- Client-facing dashboard redesign

Those are valid next steps, but they are not required to prove the commercial value of explainable spatial reporting.
