# African Data Layer — Workflow Deliverables

**Purpose:** Field-ready operational documents for the ADL data acquisition pilot in Bonamoussadi, Douala, Cameroon.

---

## How to Use

- Each document is **self-contained**: print it, hand it to a field lead, and they can act on it without needing the full research library.
- Documents use **7 canonical vertical names** consistently across all tables and checklists. Use these names in code, schemas, dashboards, and field forms.
- Cross-references between documents use relative links (e.g., `04-contact-list.md`). If a referenced document does not yet exist, it is planned.
- Decision tables and checklists are designed for **weekly operational reviews** during the 6-week pilot.
- When in doubt, trace back to the source research docs listed below for full context and rationale.

---

## Canonical Verticals

| # | Vertical ID | Description |
|---|---|---|
| 1 | `billboard` | Billboards and OOH advertising panels |
| 2 | `alcohol_outlet` | Bars, off-licences, informal drinking spots, retail alcohol |
| 3 | `census_proxy` | Building footprints, occupancy, demographic proxy indicators |
| 4 | `fuel_station` | Branded fuel stations and informal fuel vendors |
| 5 | `mobile_money` | Mobile money agent kiosks (MTN MoMo, Orange Money, CAMTEL) |
| 6 | `pharmacy` | Licensed pharmacies and informal drug vendors |
| 7 | `transport_road` | Road segments, blockages, surface condition, flood events |

---

## Deliverable Index

| # | File | Description | Status |
|---|---|---|---|
| 01 | [`01-vertical-matrix.md`](01-vertical-matrix.md) | Vertical-by-vertical matrix with priority, POI estimates, complexity, data needs, actors, gaps, and delta methods | Complete |
| 02 | [`02-collection-mix.md`](02-collection-mix.md) | Recommended data collection source mix per vertical with operational effort estimates and acquisition actions | Complete |
| 03 | `03-pilot-plan.md` | 6-week Bonamoussadi pilot execution plan with weekly milestones and Go/No-Go criteria | Planned |
| 04 | `04-contact-list.md` | Priority contact list for partner data acquisition, organized by vertical and source type | Planned |
| 05 | `05-risk-register.md` | Risk register with likelihood, impact, mitigations, and owners | Planned |
| 06 | `06-validation-sop.md` | Standard operating procedures for field data validation and quality scoring | Planned |
| 07 | `07-field-protocols.md` | Per-vertical field capture protocols, classification rules, and edge-case guidance | Planned |

---

## Source Documents

These workflow deliverables synthesize and operationalize content from the following research and design documents:

| Source | Path | Content |
|---|---|---|
| Local Context Analysis | `research/01-data-analyst-local-context.md` | Market context, vertical analysis, competitor landscape, priority matrix |
| Final Strategy Synthesis | `research/10-FINAL-STRATEGY-synthesis.md` | Executive synthesis of all 9 teammate deliverables |
| Verticals Overview Matrix | `docs/vertical-delta-templates/00_verticals_overview_matrix.csv` | Structured vertical metadata: data needed, actors, products, problems, gaps, delta methods |
| Collection Workflow | `research/02-system-design-collection-workflow.md` | Data model, delta computation, schemas |
| Technical Architecture | `research/03-cloud-architect-technical-architecture.md` | Architecture, offline-first design, API |
| Execution Plan | `research/09-project-leader-execution-plan.md` | 6-week plan, budget, KPIs |

---

*Last updated: March 2026*
