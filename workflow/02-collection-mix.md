# 02 — Data Collection Mix by Vertical

**What this document is:** The recommended source mix for initial data acquisition across all 7 verticals in the Bonamoussadi pilot, with operational effort estimates and concrete acquisition actions per source type.

**How to use it:** Reference the Mix Table when allocating field agent time, negotiating partner data access, or prioritizing public data scraping. Use the Acquisition Actions table as a weekly checklist during pilot ramp-up.

---

## Collection Mix Table

Percentages represent the recommended contribution of each data source to initial vertical coverage during the Bonamoussadi pilot.

| Source | `billboard` | `alcohol_outlet` | `census_proxy` | `fuel_station` | `mobile_money` | `pharmacy` | `transport_road` |
|---|---|---|---|---|---|---|---|
| **Field Ops** (paid agents) | 70% | 80% | 50% | 60% | 75% | 75% | 60% |
| **Satellite Imagery** | 5% | 0% | 25% | 5% | 0% | 0% | 15% |
| **Partner Data** (operators, telcos, fuel cos) | 5% | 5% | 5% | 15% | 10% | 5% | 5% |
| **Public Data** (govt registers, OSM) | 10% | 5% | 15% | 15% | 5% | 15% | 15% |
| **Competitor Tracking** (Google Maps, OSM, Alliance Media) | 10% | 10% | 5% | 5% | 10% | 5% | 5% |

---

## What This Means Operationally

### Why field ops dominate every vertical

Bonamoussadi's informal economy (30--50% of GDP) is invisible to satellites, government registers, and partner databases. Ground truth is ADL's core value proposition. No source other than trained field agents can determine whether a kiosk is an active mobile money agent, whether a roadside table sells pharmaceuticals, or whether an unmarked doorway is a functioning bar.

### Effort estimates by source type

| Source Type | % of Total Effort | Weekly Hours (3 agents) | Key Constraint |
|---|---|---|---|
| **Field Ops** | 65% | ~78 hrs/wk (26 hrs/agent) | Agent availability, weather (rainy season reduces field hours by ~30%) |
| **Satellite Imagery** | 8% | ~4 hrs/wk (analyst time) | Image acquisition cost, cloud cover (Jun--Oct), processing lag |
| **Partner Data** | 7% | ~3 hrs/wk (relationship management) | Willingness to share, NDA negotiation, data format inconsistency |
| **Public Data** | 12% | ~6 hrs/wk (scraping, cleaning, geocoding) | Outdated registers, no APIs, manual digitization of paper records |
| **Competitor Tracking** | 8% | ~4 hrs/wk (monitoring, extraction) | Terms of service restrictions, data freshness unknown |

### Vertical-specific operational notes

| Vertical | Operational Note |
|---|---|
| `billboard` | Field ops can cover all 30--60 locations in 1--2 agent-days/month. Competitor tracking (Alliance Media public inventory) provides useful baseline. |
| `alcohol_outlet` | Highest field dependency (80%). Requires **evening/night capture sessions** for night-only outlets. Plan 2--3 night shifts per week during initial mapping. |
| `census_proxy` | Most satellite-dependent vertical (25%). Acquire pre-pilot baseline imagery. Field agents validate and enrich with occupancy, use classification, and height data. |
| `fuel_station` | Smallest POI count (5--10) but highest partner data potential (15%). TotalEnergies and Tradex maintain station lists. CSPH publishes regulated prices. |
| `mobile_money` | High churn demands weekly re-survey. Operator directories (MTN, Orange) are proprietary but partially accessible through agent network managers. |
| `pharmacy` | Pharmacists Council registry provides formal baseline (15% public data). Informal vendors require weekly market and transport hub sweeps. |
| `transport_road` | Dual-source approach: satellite for surface type/condition baseline (15%), field agents for real-time blockage and condition updates. OSM provides road geometry. |

---

## Data Source Acquisition Actions

### Field Operations

| Action | Who | When | Deliverable |
|---|---|---|---|
| Recruit and onboard 3 field agents + 1 team lead | Project Lead | Week 1 | Signed contracts, completed training |
| Define per-vertical capture routes covering Bonamoussadi | Team Lead | Week 1 | Route maps with estimated time per route |
| Deploy offline-first mobile capture app to agent devices | Tech Lead | Week 1 | App installed, tested offline on all devices |
| Begin P0 vertical field capture (`transport_road`, `mobile_money`) | Field Agents | Week 1 | First submissions within 48 hrs of deployment |
| Begin P1 vertical field capture (`pharmacy`, `fuel_station`, `alcohol_outlet`) | Field Agents | Week 2--3 | Coverage targets set per vertical |
| Begin P2 vertical field capture (`billboard`, `census_proxy`) | Field Agents | Week 3--4 | Systematic block-by-block coverage initiated |
| Establish weekly re-survey cadence for high-churn verticals | Team Lead | Week 2 | Re-survey schedule for `mobile_money`, `alcohol_outlet` |
| Plan night/evening capture sessions for `alcohol_outlet` | Team Lead | Week 2 | Night shift roster (2--3 sessions/week) |

### Satellite Imagery

| Action | Who | When | Deliverable |
|---|---|---|---|
| Acquire high-resolution baseline imagery for Bonamoussadi | Tech Lead | Pre-pilot | Georeferenced image set (Maxar or Airbus) |
| Extract building footprints for `census_proxy` baseline | Data Analyst | Week 1--2 | Building footprint layer with count and area |
| Run road surface classification on imagery for `transport_road` | Data Analyst | Week 1--2 | Road segment layer with surface type estimate |
| Schedule repeat imagery acquisition for change detection | Tech Lead | Week 4 | Second image set for delta comparison |

### Partner Data

| Action | Who | When | Deliverable |
|---|---|---|---|
| Contact TotalEnergies, Tradex, OLA Energy for station lists | Project Lead | Week 1 | [ ] Station list with GPS, brand, services |
| Contact MTN and Orange agent network managers for agent directories | Project Lead | Week 1 | [ ] Agent point list (even partial/outdated is valuable) |
| Contact Pharmacists Council for licensed pharmacy registry | Project Lead | Week 1 | [ ] Registry extract with names and addresses |
| Negotiate NDA terms for any proprietary data sharing | Project Lead | Week 1--2 | Signed NDAs where required |
| Digitize and geocode any partner data received in paper/PDF form | Data Analyst | Ongoing | Geocoded partner data layers |

> **See [`04-contact-list.md`](04-contact-list.md) for the full priority contact list with names, organizations, channels, and outreach scripts per partner type.**

### Public Data

| Action | Who | When | Deliverable |
|---|---|---|---|
| Download OSM road network for Bonamoussadi | Data Analyst | Pre-pilot | Road geometry baseline layer |
| Download OSM POIs (pharmacies, fuel stations, businesses tagged) | Data Analyst | Pre-pilot | POI baseline for cross-reference |
| Obtain CSPH fuel price schedule | Data Analyst | Week 1 | Current regulated prices by fuel type |
| Request BUCREP 2005 census data for Douala V | Project Lead | Week 1 | Baseline population figures (outdated but useful) |
| Check Ministry of Communication billboard operator list (155 approved companies, 2023) | Data Analyst | Week 1 | Operator list for billboard attribution |
| Download HDX Cameroon roads dataset | Data Analyst | Pre-pilot | National road classification reference |

### Competitor Tracking

| Action | Who | When | Deliverable |
|---|---|---|---|
| Extract Google Maps business listings for Bonamoussadi | Data Analyst | Week 1 | Competitor POI baseline (all categories) |
| Assess OSM coverage completeness for each vertical | Data Analyst | Week 1 | Gap analysis: what OSM has vs. what ADL needs |
| Monitor Alliance Media public inventory for billboard baseline | Data Analyst | Week 1 | Known billboard locations from public sources |
| Set up monthly competitor tracking cadence | Data Analyst | Week 2 | Monthly comparison: ADL coverage vs. competitors |

---

## Decision Table: When to Increase a Source Mix

Use this table during weekly reviews to decide if the collection mix needs adjustment.

| Signal | Action |
|---|---|
| Field agents cannot physically cover all POIs within cadence | Increase agent count or reduce re-survey frequency for low-priority verticals |
| Partner provides comprehensive, geocoded station/agent list | Reduce field ops % for that vertical; shift agents to under-covered verticals |
| Satellite imagery reveals significant building changes | Increase satellite % for `census_proxy`; schedule field validation of changes |
| Public register is discovered to be current and geocoded | Reduce field ops % for that vertical; use register as baseline, field-verify only |
| Competitor data shows high coverage for a vertical | Use as cross-reference; do not reduce field ops (competitor data lacks ADL's verification depth) |
| Rainy season begins (June) | Increase field ops for `transport_road` to daily cadence; reduce `census_proxy` and `billboard` field time |

---

## Sources

- `research/10-FINAL-STRATEGY-synthesis.md` — Section 2 (Recommended Collection Mix Per Vertical), including rationale
- `research/01-data-analyst-local-context.md` — Sections 2 (Vertical Analysis, field realities and update frequencies) and 5 (Priority Matrix)
- `docs/vertical-delta-templates/00_verticals_overview_matrix.csv` — Recommended frequency per vertical

---

*Last updated: March 2026*
