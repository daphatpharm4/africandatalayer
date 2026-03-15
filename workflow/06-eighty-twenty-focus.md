# 80/20 Analysis: High-Value Data Points

**Document:** workflow/06-eighty-twenty-focus.md
**Date:** March 2026
**Purpose:** Operational guide for field agents and team leads to maximize revenue impact per hour of collection effort

---

> **EXECUTIVE SUMMARY**
>
> Focus **30% of agent time** on **transport_road + mobile_money + fuel_station** to capture **65% of estimated revenue**.
>
> These three verticals have the highest revenue-to-effort ratios (2.0x--2.5x). Everything else is important but secondary. When time is short, collect Roads, MoMo, and Fuel first.

---

## 1. Revenue / Effort Ratio by Vertical

| Priority | Vertical | Collection Effort | Est. Revenue Share | Revenue/Effort Ratio | Action |
|:---:|---|:---:|:---:|:---:|---|
| **P0** | `transport_road` | 10% | 25% | **2.5x** | Allocate first; baseline before rainy season (June) |
| **P0** | `mobile_money` | 15% | 30% | **2.0x** | Highest absolute revenue; collect alongside roads |
| **P0** | `fuel_station` | 5% | 10% | **2.0x** | Quick wins (5--10 stations in Bonamoussadi); cross-sell with roads |
| P1 | `alcohol_outlet` | 25% | 20% | 0.8x | Strong buyer interest (SABC, breweries) but high collection difficulty |
| P1 | `billboard` | 10% | 8% | 0.8x | Fixed, visible, daytime collection -- easy but smaller market |
| P2 | `pharmacy` | 15% | 5% | 0.3x | High project-based value (WHO/USAID); slower sales cycle |
| P2 | `census_proxy` | 20% | 2% | 0.1x | Strategic long-term asset; collect passively during other surveys |

**Key takeaway:** P0 verticals consume 30% of effort and return 65% of revenue. P1 adds 35% effort for 28% revenue. P2 is strategic but not revenue-urgent.

---

## 2. Must-Have vs Nice-to-Have Fields (Field Agent Cheat Sheet)

Use this table when filling the capture form. **Must-Have fields are what buyers pay for.** If you only have 2 minutes at a location, capture the Must-Have fields and move on.

| Vertical | Must-Have Fields (buyers pay for these) | Nice-to-Have (add on revisit) |
|---|---|---|
| `transport_road` | Blockage status (`isBlocked`), vehicle passability (`passableBy`), condition, bypass route info | Surface type (`surfaceType`), traffic density (`trafficLevel`), street lights |
| `mobile_money` | Agent GPS location, operator (`providers`: MTN/Orange/both), activity status (`isActive`) | Float availability (`hasFloat`), services offered (`paymentModes`), agent type |
| `fuel_station` | Station GPS location, operator/brand, availability status (`hasFuelAvailable`) | Services offered, queue length (`queueLength`), informal vendor count, prices |
| `alcohol_outlet` | POS location, brands available (`brandsAvailable`), formal/informal (`isFormal`) | Operating hours, price range (`priceRange`), license status, outlet type |
| `billboard` | GPS location, advertiser/brand (`advertiserBrand`), occupancy status (`isOccupied`) | Format/size (`size`), condition, is lit (`isLit`), facing direction |
| `pharmacy` | GPS location, formal/informal (`isFormal`), operating status (`isOpenNow`) | On-duty rotation (`isOnDuty`), product categories, stock-out data, license |
| `census_proxy` | Building count, construction activity (`occupancyStatus`), building type | Storey count, occupancy, residential/commercial split, materials |

---

## 3. Highest-Value Delta Types

Deltas (changes between weekly snapshots) are the core product -- not static maps. Rank your re-visits to detect these changes first.

| Rank | Delta Type | Verticals Affected | Why Highest Value | Primary Buyer |
|:---:|---|---|---|---|
| **1** | **Blockage / disruption events** | `transport_road`, `fuel_station` (stock-outs) | Immediate operational impact; time-sensitive; saves CFA 50--200K per truck reroute avoided | Logistics companies, ride-hailing apps |
| **2** | **New entity openings** | `mobile_money`, `alcohol_outlet`, `pharmacy` | Distribution expansion signal; competitive intelligence; first-mover advantage | Telcos (MTN, Orange), breweries (SABC), pharma distributors |
| **3** | **Entity closures** | `mobile_money`, `alcohol_outlet` | Network health signal; competitor opportunity; market contraction indicator | Telcos, breweries |
| **4** | **Brand / operator switches** | `mobile_money`, `billboard` | Competitive market share shift signal | Telcos, advertising agencies |
| **5** | **Formal / informal ratio shifts** | `alcohol_outlet`, `pharmacy` | Regulatory environment signal; market maturation | Regulators, public health orgs, development agencies |
| **6** | **Density changes by zone** | All verticals | Neighborhood economic development signal; investment indicator | Banks, developers, telcos, government |

---

## 4. Six-Month Resource Allocation Calendar

Pilot starts April 2026. Rainy season begins June.

| Month | Primary Focus (60% of time) | Secondary Focus (25% of time) | Background (15% of time) | Rationale |
|---|---|---|---|---|
| **Month 1 (Apr)** | `transport_road` baseline (all segments) | `mobile_money` agent mapping | -- | Roads baseline must complete before rains; MoMo collected in parallel on same routes |
| **Month 2 (May)** | `mobile_money` deep collection (activity, services, float) | `fuel_station` complete inventory | `billboard` opportunistic | Deepen MoMo data for telco pitch; fuel is fast (5--10 stations) |
| **Month 3 (Jun)** | `transport_road` ACTIVE MONITORING (rains begin) | `alcohol_outlet` POS mapping starts | `pharmacy` opportunistic | Rainy season = highest-value road delta data; start alcohol for SABC pitch |
| **Month 4 (Jul)** | `transport_road` + `alcohol_outlet` + `billboard` | `mobile_money` weekly updates | `pharmacy` mapping | Multi-vertical coverage strengthens platform pitch to enterprise buyers |
| **Month 5 (Aug)** | All verticals -- weekly update cycles | `pharmacy` mapping completes | `census_proxy` pilot zones | System mature enough for full coverage; pharmacy data for development org pitches |
| **Month 6 (Sep)** | All verticals -- weekly updates | `census_proxy` baseline collection | Annual report preparation | Census starts as longitudinal baseline builds; prepare first client-ready reports |

### Time Allocation Summary (6-Month Average)

| Vertical | % of Agent Time | Estimated Entities (Bonamoussadi) |
|---|:---:|:---:|
| `transport_road` | 25% | 50--80 road segments |
| `mobile_money` | 20% | 100--200 agents |
| `fuel_station` | 5% | 5--10 stations |
| `alcohol_outlet` | 20% | 80--150 outlets |
| `billboard` | 10% | 30--60 billboards |
| `pharmacy` | 10% | 30--55 pharmacies |
| `census_proxy` | 10% | 560--800 buildings |

---

## 5. Field Agent Daily Decision Guide

**When time is short, follow this priority order.** Stop when your shift ends; the highest-priority items are at the top.

### Priority 1: Time-Sensitive Deltas (do these FIRST)

- [ ] Report any **road blockages** you encounter during transit (`transport_road`, `isBlocked` = true, `blockageType`, `passableBy`)
- [ ] Report any **fuel stock-outs** you observe at stations (`fuel_station`, `hasFuelAvailable` = false)
- [ ] Report any **new MoMo agent** you see that is not in the app (`mobile_money`, CREATE_EVENT)
- [ ] Report any **closed MoMo agent** that shows as active in the app (`mobile_money`, ENRICH_EVENT with `isActive` = false)

### Priority 2: Baseline Collection (do these if you have 30+ min)

- [ ] Walk your assigned route and capture any **unrecorded road segments** (`transport_road`, CREATE_EVENT)
- [ ] Capture all **MoMo agents** along your route with operator and activity status
- [ ] Capture any **fuel stations** you pass (quick -- just name, brand, availability)

### Priority 3: Enrichment (do these if you have 60+ min)

- [ ] Revisit MoMo agents with incomplete data (check `gaps` list in app) -- add float, services, hours
- [ ] Map `alcohol_outlet` locations with brands and formal/informal classification
- [ ] Map `billboard` locations with advertiser and occupancy status

### Priority 4: Background Collection (do these when convenient)

- [ ] Note `pharmacy` locations with open/closed and formal/informal status
- [ ] Count buildings and note construction activity for `census_proxy` (can be done from the street)

### Quick Rules of Thumb

| Situation | Action |
|---|---|
| You see a road blocked by flooding | **Stop everything.** Report immediately -- this is the highest-value data point. |
| You pass a fuel station | Takes 2 min. Capture name, brand, fuel availability. Always worth it. |
| You see a new MoMo kiosk | Takes 3 min. Capture location, operator, active status. High value. |
| You have 15 minutes left in shift | Do NOT start a new area. Instead, enrich existing points near you (fill gaps). |
| It is raining heavily | Focus on `transport_road` -- this is when blockage data is most valuable. |
| You are in a commercial zone | Prioritize `alcohol_outlet` and `mobile_money` -- high density, efficient collection. |
| You are on a main road | Prioritize `billboard` and `fuel_station` -- visible from the road, fast capture. |

---

## Sources

This document synthesizes and operationalizes content from the following research deliverables:

- `research/10-FINAL-STRATEGY-synthesis.md` -- Section 6 (80/20 Focus): vertical prioritization, revenue/effort ratios, resource allocation calendar, must-have vs nice-to-have fields, highest-value delta types
- `research/02-system-design-collection-workflow.md` -- Vertical-specific field schemas (Section 1.4), collection targets and entity estimates (Appendix), enrichable field definitions per vertical config
- `research/06-fraud-specialist-anti-fraud.md` -- Fraud threat landscape informing which data points require the most careful collection (GPS integrity, photo evidence requirements)
