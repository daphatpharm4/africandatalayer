# ADL Execution Plan: 6-Week Bonamoussadi Pilot
## Service Delivery Manager / Project Leader Deliverable

**Teammate 9 -- Service Delivery Manager**
**Date:** March 2026

---

## Table of Contents

1. [6-Week Pilot Execution Plan](#1-6-week-pilot-execution-plan)
2. [Team Structure and Roles](#2-team-structure-and-roles)
3. [Budget](#3-budget)
4. [KPIs and Metrics](#4-kpis-and-metrics)
5. [Dependencies and Critical Path](#5-dependencies-and-critical-path)
6. [RAID Log](#6-raid-log)
7. [Governance Cadence](#7-governance-cadence)
8. [Go/No-Go Decision Framework](#8-gono-go-decision-framework)
9. [Milestones](#9-milestones)

---

## Synthesis of Prior Deliverables

This execution plan synthesizes the work of all 8 prior teammates:

- **Teammate 1 (Data Analyst):** Bonamoussadi has ~560 businesses, 7 verticals, estimated 375-615 POIs. Priority order: Roads and Mobile Money (P0), then Pharmacy/Fuel/Alcohol (P1), then Billboards/Census (P2). Rainy season starts June. Cameroon's data protection law compliance deadline is June 23, 2026.
- **Teammate 2 (System Design):** Event-sourced model (`point_events`), weekly snapshots, delta computation with z-score anomaly detection, per-vertical field schemas, confidence scoring (recency 25%, sourceCount 20%, photoEvidence 20%, gpsAccuracy 15%, reviewerApproval 10%, fieldCompleteness 10%).
- **Teammate 3 (Cloud Architect):** Current stack: React PWA on Vercel, Neon PostgreSQL, Vercel Blob for photos, IndexedDB offline queue. Infrastructure cost: $50-200/month. Sync protocol with idempotency keys and exponential backoff.
- **Teammate 4 (Cloud Engineer):** 12 API routes deployed, Vercel Cron for weekly snapshots, 8 test files. CI/CD via Vercel Git Integration on GitHub. Implementation roadmap with phased delivery.
- **Teammate 5 (Cybersecurity):** Threat model (GPS spoofing highest risk at 16/25), privacy framework for Law 2024/017, incident response plan, field agent security training requirements. Current gaps: no MFA, no granular RBAC, no field-level PII encryption.
- **Teammate 6 (Fraud Specialist):** Multi-layered GPS spoofing detection, duplicate detection via perceptual hashing, confidence scoring with fraud penalty, velocity analysis, collusion pattern detection. Priority: A1 (Fabrication) + A3 (GPS Spoofing) highest risk.
- **Teammate 7 (Marketing):** Top 3 use cases: road blockage alerts, mobile money agent mapping, alcohol distribution intelligence. First 10 target accounts identified. Pricing tiers: Starter CFA 200-500K/month, Professional CFA 1-3M/month, Enterprise CFA 5-15M/month. Revenue target: CFA 5-10M/month by month 6.
- **Teammate 8 (UI/UX):** Field agent persona (20-35 yrs, mid-range Android, 30-60 POIs/day), 3-tap capture design, step-based wizard, sunlight-readable palette, offline sync status bar. Admin reviewer needs batch operations and keyboard-driven workflows.

---

## 1. 6-Week Pilot Execution Plan

### Pilot Start Date: Week 1 Day 1 = Monday, April 14, 2026
### Pilot End Date: Week 6 Day 5 = Friday, May 22, 2026

---

### Week 1: Setup and Preparation (April 14-18)

| Day | Task | Owner | Deliverable | Success Criteria |
|---|---|---|---|---|
| **W1D1 (Mon)** | Finalize field team lead hire; confirm contract terms | Charles (CEO) | Signed contract with Field Team Lead | Team Lead confirmed and available by W1D3 |
| **W1D1** | Deploy RBAC migration: add `field_agent`, `team_lead`, `admin`, `data_consumer` roles to database | Charles (CEO) | Database migration applied to production | Roles queryable; existing users unaffected |
| **W1D1** | Purchase 4x Android phones (Samsung A15 or Tecno Spark 20) + 4x power banks + 4x SIM cards (MTN or Orange) | Charles (CEO) | Equipment procurement order placed | Delivery confirmed by W1D3 |
| **W1D2 (Tue)** | Deploy transport_road and census_proxy vertical schemas to production (Teammate 2 specs) | Charles (CEO) | New verticals visible in PWA | All 7 verticals selectable in capture form |
| **W1D2** | Deploy GPS integrity module (client-side mock location detection, sensor data collection) per Teammate 6 spec | Charles (CEO) | `gpsIntegrity.ts` deployed, collecting data on submissions | GPS integrity data appearing in submission payloads |
| **W1D2** | Deploy velocity check and photo hash deduplication endpoints per Teammate 6 spec | Charles (CEO) | Fraud detection pipeline operational | Test submissions correctly flagged/passed |
| **W1D3 (Wed)** | Field Team Lead orientation (remote video call): ADL mission, system walkthrough, pilot objectives, reporting structure | Charles (CEO) + Field Team Lead | Team Lead understands system and objectives | Team Lead can navigate PWA, submit test POI, access admin queue |
| **W1D3** | Recruit 3 field agents via Field Team Lead's local network; criteria: smartphone-literate, knows Bonamoussadi, available full-time for 6 weeks | Field Team Lead | 3 agent candidates identified | Candidates confirmed and available from W1D5 |
| **W1D3** | Define Bonamoussadi zone grid: divide pilot area into 4 collection zones (A: north Bonamoussadi, B: central/Carrefour, C: south/Makepe, D: commercial corridor) | Charles (CEO) + Field Team Lead | Zone map with GPS boundaries | 4 zones defined with bounding boxes matching Teammate 2 geofence (4.0755-4.0999 N, 9.7185-9.7602 E) |
| **W1D4 (Thu)** | Field agent onboarding: 3-hour training session in Bonamoussadi covering app usage, photo standards, data quality expectations, fraud rules, safety protocols | Field Team Lead | 3 agents trained and equipped with phones/power banks | Each agent completes 5 practice submissions that pass fraud checks |
| **W1D4** | Create agent accounts in system with `field_agent` role; assign each agent to a primary zone | Charles (CEO) | 3 agent accounts + 1 team lead account active | All accounts can log in, submit, and sync |
| **W1D4** | Deploy consent collection flow per Teammate 5 privacy framework (click-through consent for agents; data collection notice for public-facing capture) | Charles (CEO) | Consent flow live in PWA | Agents must accept terms before first submission |
| **W1D5 (Fri)** | Supervised test day: all 3 agents + Team Lead do a half-day supervised field test in Zone B (Carrefour Bonamoussadi) | Field Team Lead + All Agents | 20-30 test submissions per agent | >80% of submissions pass quality checks; sync works; photos acceptable |
| **W1D5** | Review test submissions; identify training gaps; adjust field protocols | Charles (CEO) + Field Team Lead | Training gap analysis document | Issues documented and remediation planned for W2D1 |
| **W1D5** | Set up Supabase/Neon database monitoring alerts (disk usage, connection count, query performance) | Charles (CEO) | Monitoring dashboard live | Alerts configured for >80% disk, >50 connections, queries >5s |

**Week 1 Deliverables:**
- M1: Infrastructure Ready (all technical deployments complete)
- Team of 4 (1 Team Lead + 3 agents) hired, trained, equipped
- Zone grid defined
- 60-90 test submissions in the system
- All fraud detection and quality scoring operational

**Week 1 Success Criteria:**
- All 7 verticals deployable and functional in PWA
- GPS integrity, velocity checks, photo hash dedup all operational
- Each agent can independently capture, sync, and verify submissions
- Zero data loss during test day

---

### Week 2: Baseline Capture (April 21-25) -- First Full Survey

| Day | Task | Owner | Deliverable | Success Criteria |
|---|---|---|---|---|
| **W2D1 (Mon)** | Remediation training for issues found in W1D5 test day (30 min morning briefing) | Field Team Lead | Agents briefed on corrections | Team Lead confirms all agents understand adjustments |
| **W2D1** | Begin systematic baseline capture: Agent 1 = Zone A, Agent 2 = Zone B, Agent 3 = Zone C. Team Lead floats across zones and covers Zone D. | All Agents + Team Lead | Day 1 submissions | 30+ submissions per agent per day |
| **W2D1** | Priority verticals for baseline: Roads (all road segments) + Mobile Money (all visible agents) + Fuel (all stations) | All Agents | P0 + easy P1 verticals captured first | Roads: target 50 segments. MoMo: target 100 agents. Fuel: target all 5-10 stations. |
| **W2D2 (Tue)** | Continue baseline: add Pharmacy (formal only first) + Billboards to capture list | All Agents | Expanding vertical coverage | Pharmacies: target all 10-15 formal. Billboards: target 30+. |
| **W2D3 (Wed)** | Continue baseline: add Alcohol outlets (formal bars and visible informal) | All Agents | Alcohol vertical populated | Target 50+ alcohol POIs |
| **W2D3** | Charles reviews first 200 submissions in admin queue; provides quality feedback to Team Lead | Charles (CEO) | Quality review notes | Review turnaround <24h; feedback communicated to agents by W2D4 morning |
| **W2D4 (Thu)** | Continue baseline: Census proxy capture begins (building counts, construction activity) | All Agents | Census proxy data collection started | Target 50+ buildings/commercial properties |
| **W2D4** | Mid-week quality checkpoint: Team Lead reviews agent productivity, photo quality, GPS accuracy distributions | Field Team Lead | Mid-week quality report | Identify bottom-performing agent for additional coaching |
| **W2D5 (Fri)** | Baseline capture push: fill remaining gaps across all zones and verticals | All Agents | Baseline substantially complete | Target: 400+ unique POIs across 7 verticals |
| **W2D5** | End-of-week admin review: Charles + Team Lead review all submissions, approve/reject, compute first quality metrics | Charles (CEO) + Field Team Lead | Baseline quality scorecard | >70% approval rate; <5% fraud-flagged |
| **W2D5** | Trigger first weekly snapshot via Vercel Cron (or manually if cron not yet running) | Charles (CEO) | Snapshot S1 frozen in `snapshots` table | Snapshot contains all approved baseline POIs |

**Week 2 Deliverables:**
- M2: Baseline Complete -- first full survey of Bonamoussadi across 7 verticals
- Snapshot S1 frozen
- Quality scorecard for baseline

**Week 2 Daily Targets per Agent:**

| Vertical | Target POIs (Week 2 Total) | Per Agent/Day Approx. |
|---|---|---|
| Transport Roads | 50-80 segments | 5-6 per agent per day |
| Mobile Money | 100-200 agents | 8-15 per agent per day |
| Fuel | 5-10 stations | 1-2 per agent (one-time) |
| Pharmacy | 10-15 formal + 20-40 informal | 3-4 per agent per day |
| Alcohol | 80-150 outlets | 6-12 per agent per day |
| Billboards | 30-60 locations | 3-5 per agent per day |
| Census Proxy | 50-100 buildings | 4-8 per agent per day |

**Week 2 Success Criteria:**
- 400+ unique POIs captured (minimum)
- All 4 zones covered
- All 7 verticals represented
- GPS accuracy <50m for >90% of submissions
- Photo quality acceptable for >85% of submissions
- Sync success rate >95%
- Snapshot S1 frozen successfully

---

### Week 3: First Delta Cycle (April 28 - May 2)

| Day | Task | Owner | Deliverable | Success Criteria |
|---|---|---|---|---|
| **W3D1 (Mon)** | Agents revisit Zone assignments with focus on ENRICH_EVENTs for baseline POIs (fill missing fields) | All Agents | Enrichment submissions | 50+ enrichment events per agent over the week |
| **W3D1** | Agents also capture NEW POIs missed during baseline (gaps identified during W2 review) | All Agents | Gap-fill submissions | 20+ new POIs across all agents |
| **W3D2 (Tue)** | Targeted re-survey of high-priority verticals: Roads (condition changes?), Mobile Money (any new agents? closures?) | All Agents | Delta-relevant observations | Agents trained to flag CHANGES vs. confirming SAME |
| **W3D3 (Wed)** | Charles processes delta computation: S2 snapshot vs. S1 baseline. Review delta output for correctness. | Charles (CEO) | Delta D1 computed (S2 - S1) | Delta report shows new/changed/removed POIs; z-score anomaly detection functioning |
| **W3D3** | Prepare first data sample: "Bonamoussadi Week 1-2 Snapshot" -- one-page summary per vertical with map, POI count, key stats | Charles (CEO) | Data sample document (PDF + interactive dashboard link) | Professional-quality output suitable for showing to prospects |
| **W3D4 (Thu)** | Team Lead conducts spot-check audit: physically visit 10 random POIs from baseline to verify data accuracy | Field Team Lead | Audit report (10 POIs verified) | >80% match field reality (location, name, status all correct) |
| **W3D5 (Fri)** | Weekly review meeting (all team): W2-W3 performance, quality metrics, agent feedback, process adjustments | Charles (CEO) + Field Team Lead + All Agents | Weekly review notes + action items | Meeting completed; issues documented; adjustments communicated |
| **W3D5** | Freeze Snapshot S2 | Charles (CEO) | S2 in database | Delta D1 (S2-S1) published |

**Week 3 Deliverables:**
- Snapshot S2 frozen
- Delta D1 (S2 - S1) computed and reviewed
- First data sample document ready for client conversations
- 10-POI audit completed with accuracy assessment
- M3: First Delta Published

**Week 3 Success Criteria:**
- Delta D1 shows meaningful changes (even if small -- proves the system works)
- Audit accuracy >80%
- Enrichment rate: >30% of baseline POIs enriched with at least one additional field
- Agent daily submission rate sustained at 25+ per agent

---

### Week 4: Second Delta Cycle + Process Optimization (May 5-9)

| Day | Task | Owner | Deliverable | Success Criteria |
|---|---|---|---|---|
| **W4D1 (Mon)** | Focus collection on Roads (if any weather events) and Mobile Money (high-churn vertical) | All Agents | Road condition updates; MoMo agent status updates | Agents demonstrating ability to detect and report changes |
| **W4D1** | Deploy any technical fixes identified during W3 (sync issues, UI bugs, fraud false positives) | Charles (CEO) | Bug fixes deployed | Known issues from W3 resolved |
| **W4D2 (Tue)** | Expand Alcohol collection: target evening/night establishments (Team Lead + 1 agent do a 5-9 PM shift) | Field Team Lead + 1 Agent | Night-economy POIs captured | 15+ night-only alcohol outlets added |
| **W4D3 (Wed)** | Prepare commercial outreach materials: 2-page pitch deck per vertical with real Bonamoussadi data | Charles (CEO) | 3 pitch decks: Roads, Mobile Money, Alcohol | Decks contain real data, real maps, real delta examples |
| **W4D3** | Second spot-check audit: Team Lead verifies 10 different random POIs | Field Team Lead | Second audit report | >85% accuracy (improvement over W3 audit) |
| **W4D4 (Thu)** | Agents continue systematic coverage; focus on under-represented zones/verticals from W2-W3 gap analysis | All Agents | Gap-fill submissions | All zones at >80% of target POI count |
| **W4D5 (Fri)** | Freeze Snapshot S3; compute Delta D2 (S3 - S2) | Charles (CEO) | S3 + D2 | Delta D2 computed and reviewed |
| **W4D5** | Weekly review meeting | Charles (CEO) + Full Team | Review notes | All KPIs tracked; agent productivity trends visible |

**Week 4 Deliverables:**
- Snapshot S3 frozen
- Delta D2 (S3 - S2) computed
- 3 pitch decks ready for client outreach
- Second audit completed
- Night-economy capture tested

**Week 4 Success Criteria:**
- Total POI count >600 (cumulative)
- Delta D2 shows system consistently detecting changes
- Audit accuracy >85%
- Agent retention: all 3 agents still active
- Pitch decks presentable quality

---

### Week 5: Client Outreach with Initial Data Products (May 12-16)

| Day | Task | Owner | Deliverable | Success Criteria |
|---|---|---|---|---|
| **W5D1 (Mon)** | Begin outreach to Tier 1 targets: Yango Cameroon (roads), SABC (alcohol), Acmar Media (billboards) | Charles (CEO) | 3 outreach messages sent (email + WhatsApp) | Messages sent with personalized data samples attached |
| **W5D1** | Agents continue regular collection; focus on maintaining data freshness for verticals being pitched | All Agents | Continued submissions | 25+ submissions per agent per day maintained |
| **W5D2 (Tue)** | Outreach to Tier 1 continued: MTN MoMo (mobile money), Orange Money (mobile money) | Charles (CEO) | 2 additional outreach messages | Personalized mobile money data samples included |
| **W5D2** | Prepare "Bonamoussadi Data Sample" one-pagers: free sample report per vertical for cold outreach | Charles (CEO) | 7 one-page data samples (one per vertical) | Each sample shows: POI count, map, 2-3 key insights, sample delta |
| **W5D3 (Wed)** | Follow up on W5D1-D2 outreach via WhatsApp; schedule meetings for W5D4-D5 or W6 | Charles (CEO) | Follow-up messages sent | At least 1 meeting scheduled |
| **W5D3** | Cold outreach to Tier 2: TotalEnergies (fuel), Gozem (roads), AGL (roads+fuel) | Charles (CEO) | 3 outreach messages | Messages with ROI-focused pitch |
| **W5D4 (Thu)** | First client meeting (if scheduled); demo live dashboard with real Bonamoussadi data | Charles (CEO) | Meeting completed; prospect feedback captured | Prospect expresses interest in pilot or paid subscription |
| **W5D4** | Third spot-check audit: Team Lead verifies 15 POIs (expanded scope) | Field Team Lead | Third audit report | >90% accuracy |
| **W5D5 (Fri)** | Freeze Snapshot S4; compute Delta D3 (S4 - S3) | Charles (CEO) | S4 + D3 | Delta D3 includes 3 weeks of longitudinal data |
| **W5D5** | Weekly review: focus on outreach results, pipeline status, data quality trends | Charles (CEO) + Full Team | Review notes + pipeline tracker | Pipeline has at least 3 warm leads |

**Week 5 Deliverables:**
- M4: First Client Meeting with Real Data
- 8-10 outreach messages sent to target accounts
- At least 1 client meeting conducted
- 7 vertical-specific data sample one-pagers
- Snapshot S4 + Delta D3
- Third audit completed

**Week 5 Success Criteria:**
- At least 5 outreach messages sent
- At least 1 meeting scheduled or completed
- At least 3 prospects in pipeline (any stage)
- Total POI count >700
- Audit accuracy >90%
- Agent productivity stable (no decline trend)

---

### Week 6: Assessment and Go/No-Go Decision (May 19-22)

| Day | Task | Owner | Deliverable | Success Criteria |
|---|---|---|---|---|
| **W6D1 (Mon)** | Final data collection push: agents fill remaining gaps and do a complete re-survey of P0 verticals (Roads, MoMo) | All Agents | Final submissions | Coverage >90% of estimated POIs for P0 verticals |
| **W6D1** | Follow up on all outstanding outreach; push for meetings this week | Charles (CEO) | Outreach follow-ups | All prospects contacted at least twice |
| **W6D2 (Tue)** | Freeze final Snapshot S5; compute Delta D4 (S5 - S4) and cumulative delta (S5 - S1) | Charles (CEO) | S5 + D4 + cumulative delta report | 5 snapshots + 4 deltas = complete pilot dataset |
| **W6D2** | Comprehensive data quality audit: Team Lead + Charles review sample of 50 POIs across all verticals | Charles (CEO) + Field Team Lead | Final audit report (50 POIs) | >85% accuracy across all verticals |
| **W6D3 (Wed)** | Compile pilot metrics dashboard: all KPIs from Section 4 aggregated over 6 weeks | Charles (CEO) | Pilot metrics report | All KPIs computed and documented |
| **W6D3** | Agent debrief sessions: 30 min individual interviews with each agent on experience, challenges, suggestions | Field Team Lead | Agent feedback summary | Feedback collected from all 3 agents |
| **W6D4 (Thu)** | Go/No-Go assessment: Charles evaluates pilot against framework in Section 8 | Charles (CEO) | Go/No-Go recommendation document | Clear recommendation with supporting data |
| **W6D4** | If GO: draft Phase 2 plan (expand to full Bonamoussadi + begin adjacent neighborhoods); begin agent retention conversations | Charles (CEO) + Field Team Lead | Phase 2 draft plan + agent retention status | Plan outlines next 3 months |
| **W6D4** | If NO-GO: document lessons learned; identify pivots; determine whether to restart, pivot scope, or pause | Charles (CEO) | Lessons learned document | Honest assessment with actionable next steps |
| **W6D5 (Fri)** | Final client outreach: share pilot results with all prospects in pipeline; schedule Phase 2 demo meetings | Charles (CEO) | Updated pipeline status | Pipeline documented with next steps per prospect |
| **W6D5** | Pilot closeout meeting: full team review of 6-week results | Charles (CEO) + Full Team | Pilot closeout report | Report completed and shared |

**Week 6 Deliverables:**
- M5: Go/No-Go Decision
- Final Snapshot S5 + Delta D4 + cumulative delta
- 50-POI comprehensive audit
- Pilot metrics report
- Agent feedback summary
- Go/No-Go recommendation
- Phase 2 plan (if GO)

**Week 6 Success Criteria:**
- All KPIs computed and evaluated against thresholds
- Go/No-Go decision made with data-backed justification
- Client pipeline status clear
- Team informed of next steps

---

## 2. Team Structure and Roles

### 2.1 Organization Chart

```
Charles Mahouve (CEO / Founder)
  Based: Lyon, France
  Available: Evenings CET (mornings Douala time overlap 8-10 AM WAT)
  │
  ├── Field Team Lead (Douala-based, full-time for pilot)
  │   ├── Field Agent 1 (Zone A + D rotation)
  │   ├── Field Agent 2 (Zone B primary)
  │   └── Field Agent 3 (Zone C primary)
  │
  └── [Future: Data Consumer / Client Support]
```

### 2.2 Role Descriptions

#### Charles Mahouve -- CEO / Founder / Technical Lead

| Attribute | Detail |
|---|---|
| **Location** | Lyon, France (CET, UTC+1) |
| **Availability** | Evening CET = morning WAT overlap; async rest of day |
| **Responsibilities** | Technical platform (all code, deployments, infrastructure), admin review queue, data quality oversight, client outreach, commercial strategy, budget management, Go/No-Go decision |
| **Time Commitment** | ~30 hours/week during pilot (evenings + weekends) |
| **Key Deliverables** | Platform deployments, admin reviews, pitch decks, client meetings, pilot metrics, Go/No-Go report |

#### Field Team Lead (to be hired)

| Attribute | Detail |
|---|---|
| **Location** | Douala, Cameroon (must live in or near Bonamoussadi) |
| **Hiring Criteria** | University-educated (GIS, data, IT, or business preferred); fluent French + functional English; smartphone-literate; local knowledge of Bonamoussadi; leadership experience (managed 2+ people); available full-time for 6 weeks; trustworthy (references required) |
| **Compensation** | CFA 200,000/month (see Budget section) |
| **Responsibilities** | Agent recruitment and training, daily field supervision, quality spot-checks, zone assignment management, daily standup facilitation, agent performance tracking, issue escalation to Charles, local logistics (SIM cards, transport) |
| **Key Deliverables** | Trained agent team, daily standup notes, weekly audit reports, agent feedback summaries |

#### Field Agents (3 agents)

| Attribute | Detail |
|---|---|
| **Location** | Douala, Cameroon (Bonamoussadi or adjacent) |
| **Hiring Criteria** | Age 20-35; secondary school minimum; owns or can use a smartphone; knows Bonamoussadi geography; physically able to walk 8-15 km/day; available full-time for 6 weeks; no criminal record; references from community |
| **Compensation** | CFA 100,000/month base + CFA 20,000 transport allowance + performance bonus up to CFA 30,000 (see Budget) |
| **Daily Expectations** | 30-50 POI submissions/day; 8 AM - 5 PM field hours; daily sync before leaving field; photo for every submission; GPS accuracy <50m |
| **Key Deliverables** | POI submissions meeting quality standards |

### 2.3 RACI Matrix

| Activity | Charles (CEO) | Field Team Lead | Field Agents |
|---|---|---|---|
| Platform development/deployment | **R, A** | I | -- |
| Agent recruitment | C | **R, A** | -- |
| Agent training | C | **R, A** | I |
| Daily field supervision | I | **R, A** | -- |
| POI data capture | I | C | **R, A** |
| Daily standup facilitation | I | **R, A** | C |
| Admin review queue | **R, A** | C | I |
| Data quality spot-check audits | C | **R, A** | I |
| Weekly snapshot/delta computation | **R, A** | I | -- |
| Client outreach | **R, A** | C | -- |
| Pitch deck preparation | **R, A** | C | -- |
| Budget management | **R, A** | I | -- |
| Go/No-Go decision | **R, A** | C | I |
| Fraud investigation | **R, A** | C | I |
| Equipment procurement | **R, A** | C | -- |
| Zone assignment | C | **R, A** | I |
| Incident escalation | A | **R** | C |

**Legend:** R = Responsible, A = Accountable, C = Consulted, I = Informed

---

## 3. Budget

### 3.1 Detailed 6-Week Pilot Budget

All amounts in CFA (XAF). Exchange rate reference: 1 USD ~ 615 CFA.

#### Personnel Costs

| Line Item | Unit Cost | Quantity | Duration | Total (CFA) | Notes |
|---|---|---|---|---|---|
| Field Team Lead salary | 200,000/month | 1 | 1.5 months | **300,000** | Includes W1 setup through W6 |
| Field Agent base salary | 100,000/month | 3 | 1.5 months | **450,000** | 3 agents x 1.5 months |
| Field Agent transport allowance | 20,000/month | 3 | 1.5 months | **90,000** | Moto-taxi costs to/from field zones |
| Field Agent performance bonus | up to 30,000/month | 3 | 1.5 months | **135,000** | Maximum; paid based on quality + volume KPIs |
| **Personnel Subtotal** | | | | **975,000** | ~$1,585 USD |

#### Equipment Costs

| Line Item | Unit Cost | Quantity | Total (CFA) | Notes |
|---|---|---|---|---|
| Android smartphones (Samsung A15 or Tecno Spark 20) | 75,000 | 4 | **300,000** | 3 agents + 1 Team Lead; reusable beyond pilot |
| Power banks (10,000 mAh) | 10,000 | 4 | **40,000** | Essential for all-day GPS + camera use |
| SIM cards with data plans (MTN/Orange, 5GB/month) | 5,000/month | 4 | **30,000** | 4 SIMs x 1.5 months |
| Phone cases / screen protectors | 3,000 | 4 | **12,000** | Protect field equipment from rain/drops |
| Branded ID badges / T-shirts | 3,000 | 5 | **15,000** | Professional appearance; community trust |
| Notebook + pen per agent | 500 | 5 | **2,500** | Backup for offline notes |
| **Equipment Subtotal** | | | **399,500** | ~$650 USD |

#### Infrastructure Costs

| Line Item | Monthly Cost | Duration | Total (CFA) | Notes |
|---|---|---|---|---|
| Vercel Pro plan | CFA 12,300 ($20) | 1.5 months | **18,450** | Current hosting |
| Neon PostgreSQL (Pro) | CFA 12,300 ($20) | 1.5 months | **18,450** | Database hosting |
| Vercel Blob storage | CFA 0 (included in Pro) | -- | **0** | Photo storage within Pro limits |
| Domain renewal (if needed) | CFA 6,150 | 1 | **6,150** | africandatalayer.com |
| Google Gemini API (search) | CFA 6,150 ($10 est.) | 1.5 months | **9,225** | AI-assisted search features |
| **Infrastructure Subtotal** | | | **52,275** | ~$85 USD |

#### Operations Costs

| Line Item | Cost | Total (CFA) | Notes |
|---|---|---|---|
| Training venue rental (half-day, W1D4) | 15,000 | **15,000** | Meeting room in Bonamoussadi |
| Printed training materials | 5,000 | **5,000** | Field guides, vertical reference sheets |
| Team Lead phone credit (calls to agents) | 5,000/month x 1.5 | **7,500** | Coordination calls |
| Weekly team meeting refreshments | 3,000/week x 5 | **15,000** | Tea/snacks for weekly reviews |
| Charles travel to Douala (if needed, 1 trip) | 350,000 | **350,000** | Lyon-Douala round trip; optional but budgeted |
| **Operations Subtotal** | | | **392,500** | ~$638 USD |

#### Contingency

| Line Item | Basis | Total (CFA) | Notes |
|---|---|---|---|
| 15% contingency on all costs | 15% x (975K + 399.5K + 52.3K + 392.5K) | **272,893** | Covers agent replacement, equipment failure, unexpected costs |

### 3.2 Budget Summary

| Category | Amount (CFA) | Amount (USD) | % of Total |
|---|---|---|---|
| Personnel | 975,000 | $1,585 | 46.5% |
| Equipment | 399,500 | $650 | 19.1% |
| Infrastructure | 52,275 | $85 | 2.5% |
| Operations | 392,500 | $638 | 18.7% |
| Contingency | 272,893 | $444 | 13.0% |
| **TOTAL** | **2,092,168** | **~$3,402** | **100%** |

### 3.3 Per-Week Breakdown

| Week | Personnel | Equipment | Infra | Ops | Total (CFA) |
|---|---|---|---|---|---|
| Week 1 | 162,500 | 399,500 | 8,713 | 377,500 | **948,213** |
| Week 2 | 162,500 | 0 | 8,713 | 3,000 | **174,213** |
| Week 3 | 162,500 | 0 | 8,713 | 3,000 | **174,213** |
| Week 4 | 162,500 | 0 | 8,713 | 3,000 | **174,213** |
| Week 5 | 162,500 | 0 | 8,713 | 3,000 | **174,213** |
| Week 6 | 162,500 | 0 | 8,713 | 3,000 | **174,213** |
| Contingency | -- | -- | -- | -- | **272,893** |
| **Total** | **975,000** | **399,500** | **52,275** | **392,500** | **2,092,168** |

**Note:** Week 1 is front-loaded with equipment purchases and Charles's potential travel. Weeks 2-6 are steady-state at ~CFA 174K/week (~$283/week).

---

## 4. KPIs and Metrics

### 4.1 Data Collection KPIs

| KPI | Definition | Target (End of Pilot) | Measured |
|---|---|---|---|
| **Total POIs Captured** | Unique point_events with CREATE_EVENT | >700 | Weekly |
| **Coverage %** | POIs captured / estimated POIs per vertical (from Teammate 1 estimates) | >80% for P0 verticals, >60% for P1, >40% for P2 | Weekly |
| **Submission Quality Score** | % of submissions with: GPS <50m accuracy + photo present + all required fields complete | >85% | Daily |
| **Enrichment Rate** | % of baseline POIs with at least 1 ENRICH_EVENT | >40% | Weekly |
| **Vertical Coverage Balance** | Each vertical has at least 60% of its estimated POI count | 5 of 7 verticals at 60%+ | Weekly |
| **Zone Coverage Balance** | Each zone has at least 70% of its estimated POI count | All 4 zones at 70%+ | Weekly |

### 4.2 Operational KPIs

| KPI | Definition | Target | Measured |
|---|---|---|---|
| **Agent Productivity** | Submissions per agent per day | 30-50 | Daily |
| **Sync Success Rate** | Successful syncs / total sync attempts | >95% | Daily |
| **Admin Review Turnaround** | Time from submission to admin approve/reject | <48 hours | Daily |
| **Review Backlog** | Submissions awaiting review | <100 at any point | Daily |
| **Agent Attendance** | Days each agent is active / scheduled days | >90% | Weekly |
| **System Uptime** | Platform availability during field hours (7 AM - 6 PM WAT) | >99% | Daily |
| **Snapshot Freeze Success** | Weekly snapshots computed without error | 5/5 | Weekly |

### 4.3 Commercial KPIs

| KPI | Definition | Target | Measured |
|---|---|---|---|
| **Outreach Messages Sent** | Emails/WhatsApp to target accounts | >10 | Weekly (W5-W6) |
| **Meetings Booked** | Confirmed meetings with prospects | >2 | Weekly (W5-W6) |
| **Meetings Completed** | Meetings held with data demo | >1 | End of pilot |
| **Pipeline Value** | Sum of estimated annual value of prospects in pipeline | >CFA 10M | End of pilot |
| **Pilot Interest Letters** | Written expressions of interest from prospects | >1 | End of pilot |
| **Data Samples Delivered** | Personalized data samples sent to prospects | >5 | End of pilot |

### 4.4 Quality KPIs

| KPI | Definition | Target | Measured |
|---|---|---|---|
| **Fraud Flag Rate** | Submissions flagged by fraud detection / total submissions | <10% | Weekly |
| **Fraud Confirmed Rate** | Confirmed fraud / flagged submissions | <20% of flagged | Weekly |
| **False Positive Rate** | Non-fraud submissions incorrectly flagged / total flagged | <50% | Weekly |
| **Audit Accuracy** | Spot-check verified POIs matching field reality / total audited | >85% | Weekly (W3-W6) |
| **Photo Quality Pass Rate** | Submissions with usable photo (in focus, correct subject, readable) | >90% | Weekly |
| **GPS Accuracy Distribution** | % of submissions with GPS accuracy <30m | >80% | Weekly |
| **Duplicate Detection Rate** | Duplicate submissions caught by dedup / total duplicates | >90% | Weekly |

### 4.5 Weekly Dashboard Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  ADL PILOT DASHBOARD -- WEEK [N] of 6                              │
│  Period: [Date Range]          Last Updated: [Timestamp]           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  COLLECTION SUMMARY                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐│
│  │ Total POIs   │ │ New This Week│ │ Enrichments  │ │ Coverage % ││
│  │     ###      │ │     ###      │ │     ###      │ │    ##%     ││
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘│
│                                                                     │
│  VERTICAL BREAKDOWN          │  ZONE BREAKDOWN                     │
│  ┌───────────────────────┐   │  ┌───────────────────────┐          │
│  │ Roads:       ## / ##  │   │  │ Zone A:     ## POIs   │          │
│  │ MoMo:        ## / ##  │   │  │ Zone B:     ## POIs   │          │
│  │ Fuel:        ## / ##  │   │  │ Zone C:     ## POIs   │          │
│  │ Pharmacy:    ## / ##  │   │  │ Zone D:     ## POIs   │          │
│  │ Alcohol:     ## / ##  │   │  └───────────────────────┘          │
│  │ Billboards:  ## / ##  │   │                                     │
│  │ Census:      ## / ##  │   │  AGENT PRODUCTIVITY                 │
│  └───────────────────────┘   │  ┌───────────────────────┐          │
│                               │  │ Agent 1:  ##/day avg  │          │
│  QUALITY METRICS              │  │ Agent 2:  ##/day avg  │          │
│  ┌───────────────────────┐   │  │ Agent 3:  ##/day avg  │          │
│  │ Quality Score:   ##%  │   │  │ Team Lead: ##/day avg │          │
│  │ Fraud Flags:     ##%  │   │  └───────────────────────┘          │
│  │ Audit Accuracy:  ##%  │   │                                     │
│  │ Sync Success:    ##%  │   │  COMMERCIAL PIPELINE                │
│  │ GPS <30m:        ##%  │   │  ┌───────────────────────┐          │
│  │ Review Backlog:  ###  │   │  │ Outreach:     ##      │          │
│  └───────────────────────┘   │  │ Meetings:     ##      │          │
│                               │  │ Pipeline: CFA ##M    │          │
│  DELTA SUMMARY (vs prev wk)  │  │ Interest:     ##      │          │
│  ┌───────────────────────┐   │  └───────────────────────┘          │
│  │ New POIs:        +##  │   │                                     │
│  │ Changed:         +##  │   │  ALERTS                             │
│  │ Removed:          -## │   │  ┌───────────────────────┐          │
│  │ Anomalies:        ##  │   │  │ [!] Issue description │          │
│  └───────────────────────┘   │  │ [!] Issue description │          │
│                               │  └───────────────────────┘          │
├─────────────────────────────────────────────────────────────────────┤
│  TREND CHARTS (sparklines over pilot weeks)                        │
│  POIs/week:    [___/--/```]    Quality:  [___/--/```]              │
│  Agents/day:   [___/--/```]    Sync:     [___/--/```]              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Dependencies and Critical Path

### 5.1 Dependency Map

```
DEPENDENCY GRAPH
================

[D1] Platform Deployments (RBAC, verticals, fraud detection)
  │
  ├──> [D2] Equipment Procurement (phones, SIMs, power banks)
  │     │
  │     └──> [D4] Agent Training (requires phones + working platform)
  │           │
  │           └──> [D6] Test Day (requires trained agents + working platform)
  │                 │
  │                 └──> [D7] Baseline Capture Start (W2D1)
  │                       │
  │                       ├──> [D8] Snapshot S1 (requires baseline data)
  │                       │     │
  │                       │     └──> [D9] Delta D1 (requires S1 + S2)
  │                       │           │
  │                       │           └──> [D10] Data Samples (requires delta data)
  │                       │                 │
  │                       │                 └──> [D11] Client Outreach (requires samples)
  │                       │                       │
  │                       │                       └──> [D12] Client Meetings
  │                       │
  │                       └──> [D13] First Audit (requires baseline POIs to verify)
  │
  └──> [D3] Team Lead Hire (requires job posting + interviews)
        │
        └──> [D5] Agent Recruitment (requires Team Lead)
              │
              └──> [D4] Agent Training (requires recruited agents)

PARALLEL TRACKS:
  D1 (tech) ║ D3 (hiring) -- can run simultaneously W1D1-D3
  D2 (procurement) ║ D3 (hiring) -- can run simultaneously
  D7 (baseline) ║ admin review -- continuous parallel operation
```

### 5.2 Critical Path

The critical path is the longest sequence of dependent activities:

```
CRITICAL PATH (determines minimum pilot duration):

D3 (Team Lead Hire) ──> D5 (Agent Recruit) ──> D4 (Training) ──> D6 (Test Day)
──> D7 (Baseline Start) ──> D8 (S1 Snapshot) ──> D9 (Delta D1) ──> D10 (Samples)
──> D11 (Outreach) ──> D12 (Meetings) ──> Go/No-Go

Duration: W1D1 ──────────────────────────────────────────────────────> W6D4
          April 14                                                     May 22

Critical path items that cannot slip without delaying the pilot:
  - Team Lead hire (W1D1-D3): 3 days. If delayed, everything shifts.
  - Agent training (W1D4): 1 day. If delayed, baseline starts late.
  - Baseline capture (W2): 5 days. If incomplete, deltas are meaningless.
  - First snapshot (W2D5): Must happen to enable delta computation.
  - Client outreach (W5): Must happen with enough data to be credible.
```

### 5.3 Parallel Workstreams

```
WORKSTREAM 1: TECHNICAL (Charles)
W1: Deploy verticals + fraud detection + RBAC
W2: Admin review queue processing
W3: Delta computation + data sample preparation
W4: Bug fixes + pitch deck preparation
W5: Client outreach + meetings
W6: Metrics compilation + Go/No-Go analysis

WORKSTREAM 2: FIELD OPERATIONS (Team Lead + Agents)
W1: Hiring + training + test day
W2: Baseline capture (all zones, all verticals)
W3: Enrichment + gap-fill + first audit
W4: Continued collection + night capture test + second audit
W5: Steady-state collection + third audit
W6: Final push + comprehensive audit + agent debriefs

WORKSTREAM 3: COMMERCIAL (Charles, starts W3)
W3: Prepare data samples
W4: Prepare pitch decks
W5: Outreach + meetings
W6: Pipeline assessment + follow-up
```

### 5.4 Gantt Chart

```
ACTIVITY                        W1          W2          W3          W4          W5          W6
                                D1 D2 D3 D4 D5 D1 D2 D3 D4 D5 D1 D2 D3 D4 D5 D1 D2 D3 D4 D5 D1 D2 D3 D4 D5 D1 D2 D3 D4
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
TECHNICAL
  Deploy RBAC + verticals       ████████
  Deploy fraud detection           ████
  Deploy GPS integrity             ████
  DB monitoring setup                       ██
  Bug fixes                                                            ████
  Snapshot/delta computation                    ██          ██          ██          ██          ██

HIRING & TRAINING
  Team Lead hire                ██████
  Agent recruitment                ██████
  Agent training                         ████
  Test day                                   ██

FIELD OPERATIONS
  Baseline capture                          ██████████████████████████
  Enrichment collection                                    ██████████████████████████████████████████████████
  Gap-fill collection                                      ████████████████████████████████
  Night capture test                                                   ████
  Audit #1 (10 POIs)                                          ████
  Audit #2 (10 POIs)                                                      ████
  Audit #3 (15 POIs)                                                                 ████
  Audit #4 (50 POIs)                                                                            ████
  Agent debriefs                                                                                   ████

COMMERCIAL
  Data sample preparation                                  ████████
  Pitch deck creation                                                  ████████
  Tier 1 outreach                                                                ████████
  Tier 2 outreach                                                                   ████████
  Client meetings                                                                      ████████████████
  Pipeline assessment                                                                               ████

GOVERNANCE
  Daily standups               .................................................................(daily)
  Weekly reviews                         ██          ██          ██          ██          ██
  Milestone reviews                      M1    M2         M3                   M4              M5

DECISION
  Go/No-Go assessment                                                                           ████████
```

---

## 6. RAID Log

### 6.1 Risks

| ID | Risk | Probability | Impact | Score | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|---|
| R01 | **Cannot hire qualified Team Lead by W1D3** | Medium | High | 12 | Pre-screen candidates before pilot start; have backup candidate identified; Charles can remotely manage W1 if needed | Charles | Open |
| R02 | **Field agents produce low-quality data** | Medium | High | 12 | Structured training W1D4; test day W1D5 with quality gate; daily Team Lead supervision; progressive disclosure UI (Teammate 8) | Field Team Lead | Open |
| R03 | **GPS spoofing by agents** | High | Critical | 20 | Multi-layered GPS detection (Teammate 6); EXIF cross-validation; velocity checks; spot-check audits; XP withheld until review | Charles | Open |
| R04 | **Agent attrition during pilot** | Medium | Medium | 8 | Competitive pay (CFA 120-150K/month total); performance bonuses; gamification (XP, leaderboard); community building | Field Team Lead | Open |
| R05 | **Connectivity issues during field capture** | High | Medium | 10 | Offline-first architecture (IndexedDB queue); sync status bar always visible; agents trained to sync on WiFi; no data loss by design | Charles | Mitigated |
| R06 | **Rainy season early onset disrupts fieldwork** | Low | Medium | 4 | Pilot starts April (dry season); rainy season typically June; if early rain, pivot to road condition data (highest value during rain) | Field Team Lead | Open |
| R07 | **Phone theft or damage in field** | Medium | Low | 4 | Budget includes phone cases; agents carry equipment home; 15% contingency covers replacement; agents sign equipment agreement | Field Team Lead | Open |
| R08 | **Zero client meetings by end of W6** | Medium | High | 12 | Start outreach W5D1 (not later); use free data samples as hook; leverage Yannick Lefang's network; target 10+ outreach messages | Charles | Open |
| R09 | **Admin review bottleneck (Charles alone)** | High | Medium | 10 | Batch approval for low-risk submissions; auto-approve submissions from high-trust agents (trust score >80); prioritize fraud-flagged only | Charles | Open |
| R10 | **Data protection compliance risk** | Low | Critical | 10 | Consent flow deployed W1D4 (Teammate 5); no PII collection beyond business names; photos of storefronts (public spaces); register as data controller before June 2026 deadline | Charles | Open |
| R11 | **Platform downtime during field hours** | Low | High | 6 | Offline-first design; Vercel 99.9% SLA; Neon monitoring alerts; agents can work offline indefinitely | Charles | Mitigated |
| R12 | **Fraud detection false positives frustrate agents** | Medium | Medium | 8 | Low-end device exceptions for GPS accuracy; gradual tuning of thresholds based on W2 data; transparent feedback to agents on quality | Charles | Open |
| R13 | **Insufficient POI density to demonstrate value** | Low | High | 6 | Teammate 1 estimates 375-615 POIs in Bonamoussadi; even 400 POIs across 7 verticals is commercially meaningful | Charles | Open |
| R14 | **Budget overrun** | Low | Medium | 4 | 15% contingency budgeted; weekly expense tracking; no variable costs beyond personnel and data plans | Charles | Open |
| R15 | **Charles unavailable due to personal emergency** | Low | Critical | 10 | Document all platform access credentials; Team Lead trained to manage field ops independently for 1 week; snapshot cron is automated | Charles | Open |
| R16 | **Competitor launches similar product in Douala** | Very Low | High | 3 | ADL's head start with ground-truth data is the moat; 6-week pilot creates dataset no competitor has; focus on execution speed | Charles | Open |
| R17 | **Community resistance to data collectors in neighborhood** | Low | Medium | 4 | Branded ID badges; agents explain ADL mission; no personal data collected; photos of public storefronts only; Team Lead handles escalations | Field Team Lead | Open |

### 6.2 Actions

| ID | Action | Owner | Deadline | Status |
|---|---|---|---|---|
| A01 | Post Field Team Lead job ad in Douala networks (WhatsApp groups, LinkedIn, university boards) | Charles | W1D1 (April 14) | Not Started |
| A02 | Purchase 4 Android phones + power banks + SIM cards | Charles | W1D1 (April 14) | Not Started |
| A03 | Deploy RBAC migration to production database | Charles | W1D1 (April 14) | Not Started |
| A04 | Deploy transport_road + census_proxy vertical schemas | Charles | W1D2 (April 15) | Not Started |
| A05 | Deploy GPS integrity module (client-side) | Charles | W1D2 (April 15) | Not Started |
| A06 | Deploy velocity check + photo hash dedup (server-side) | Charles | W1D2 (April 15) | Not Started |
| A07 | Deploy consent collection flow | Charles | W1D4 (April 17) | Not Started |
| A08 | Define Bonamoussadi 4-zone grid with GPS boundaries | Charles + Team Lead | W1D3 (April 16) | Not Started |
| A09 | Create field agent training manual (2 pages, French, with screenshots) | Charles | W1D3 (April 16) | Not Started |
| A10 | Set up database monitoring alerts (Neon dashboard) | Charles | W1D5 (April 18) | Not Started |
| A11 | Create weekly dashboard template (spreadsheet or Notion) | Charles | W2D1 (April 21) | Not Started |
| A12 | Prepare "Bonamoussadi Data Sample" template for client outreach | Charles | W4D3 (May 7) | Not Started |
| A13 | Register ADL as vendor with World Bank procurement system | Charles | W4D5 (May 9) | Not Started |
| A14 | Draft client outreach email/WhatsApp templates per vertical | Charles | W4D5 (May 9) | Not Started |
| A15 | Begin data controller registration under Law 2024/017 | Charles | W6D5 (May 22) | Not Started |

### 6.3 Issues

| ID | Issue | Severity | Description | Resolution Needed By | Owner | Status |
|---|---|---|---|---|---|---|
| I01 | **No RBAC beyond `isAdmin` boolean** | High | Current system has only admin/non-admin distinction. Field agents, team lead, and data consumers need distinct roles. | W1D1 | Charles | Open |
| I02 | **transport_road and census_proxy verticals not in production** | High | System currently has 6 verticals (pharmacy, fuel, mobile_money, alcohol, billboard, retail_kiosk). Need 7 for pilot. | W1D2 | Charles | Open |
| I03 | **No batch approval in admin queue** | Medium | Charles will be sole reviewer; reviewing 100+ submissions one-by-one is unsustainable. | W2D1 | Charles | Open |
| I04 | **No agent assignment/zone system** | Medium | Current system has no concept of assigning agents to zones. Team Lead manages this manually via WhatsApp for pilot. | W1D3 (manual workaround) | Field Team Lead | Open |
| I05 | **No French-language field training materials** | Medium | App supports FR/EN but no printed training guide exists for field agents. | W1D3 | Charles | Open |
| I06 | **No automated weekly dashboard** | Low | KPI tracking is manual for pilot. Acceptable for 6 weeks but not scalable. | W2D1 (manual template) | Charles | Open |

### 6.4 Decisions

| ID | Decision Needed | Options | Recommended | Deadline | Decision Maker | Status |
|---|---|---|---|---|---|---|
| DC01 | **Which phone model to buy for agents?** | (a) Samsung A15 (~CFA 75K, reliable) (b) Tecno Spark 20 (~CFA 60K, cheaper) (c) Agents use own phones + stipend | (a) Samsung A15 -- reliable GPS, good camera, reusable | W1D1 | Charles | Pending |
| DC02 | **Should Charles travel to Douala for W1?** | (a) Yes, in-person setup (b) No, remote via video calls | (b) Remote for W1; travel only if issues arise by W3. Saves CFA 350K. | W1D1 | Charles | Pending |
| DC03 | **Agent compensation structure** | (a) Fixed salary only (b) Base + performance bonus (c) Per-submission payment | (b) Base CFA 100K + transport CFA 20K + bonus up to CFA 30K. Motivates quality without incentivizing pure volume. | W1D1 | Charles | Pending |
| DC04 | **How to handle the admin review bottleneck?** | (a) Charles reviews all (b) Auto-approve low-risk, manual review flagged only (c) Train Team Lead as reviewer | (b) Auto-approve submissions with fraud score <20 and confidence >70; manual review the rest. Revisit in W3 based on volume. | W2D1 | Charles | Pending |
| DC05 | **Free pilot or paid from first client?** | (a) Offer free pilot to first 3 prospects (b) Charge Starter tier from day 1 (c) Free data sample, then paid | (c) Free one-page data sample as hook; charge for ongoing subscription. No free pilots longer than 1 week. | W5D1 | Charles | Pending |
| DC06 | **Should agents work evenings for alcohol vertical?** | (a) Yes, 5-9 PM shifts (b) No, daytime only for safety (c) Team Lead + 1 agent only, limited evening test | (c) Limited test in W4 with Team Lead + 1 agent only. Safety first. Evaluate before scaling. | W4D2 | Charles + Team Lead | Pending |
| DC07 | **Go/No-Go decision authority** | (a) Charles alone (b) Charles + advisor consultation (c) Board/investor approval needed | (a) Charles alone, with Team Lead input and advisor consultation (Yannick Lefang) for perspective. | W6D4 | Charles | Pending |

---

## 7. Governance Cadence

### 7.1 Daily Standups (Field Team)

| Attribute | Detail |
|---|---|
| **Frequency** | Daily, Monday-Friday |
| **Time** | 8:00 AM WAT (7:00 AM CET) |
| **Duration** | 15 minutes maximum |
| **Participants** | Field Team Lead + all Field Agents |
| **Format** | WhatsApp voice call or in-person (if agents start from same location) |
| **Agenda** | (1) Yesterday: how many submissions? Any issues? (2) Today: which zone/vertical? (3) Blockers: anything preventing work? |
| **Output** | Team Lead sends daily standup summary to Charles via WhatsApp by 8:30 AM WAT |

**Daily Standup Summary Template (WhatsApp message from Team Lead to Charles):**

```
ADL Daily - [Date]
Agents active: [#/3]
Yesterday total: [## submissions]
  - Agent 1: ## (Zone [X])
  - Agent 2: ## (Zone [X])
  - Agent 3: ## (Zone [X])
  - Team Lead: ## (Zone [X])
Quality issues: [none / describe]
Sync issues: [none / describe]
Today's plan: [zones/verticals]
Blockers: [none / describe]
```

### 7.2 Weekly Reviews (Full Team)

| Attribute | Detail |
|---|---|
| **Frequency** | Weekly, Friday afternoon |
| **Time** | 4:00 PM WAT (3:00 PM CET) |
| **Duration** | 45-60 minutes |
| **Participants** | Charles (CEO) + Field Team Lead + Field Agents (optional) |
| **Format** | Video call (Google Meet or WhatsApp video) |
| **Agenda** | (1) Week metrics review (dashboard from 4.5) (2) Quality deep-dive (audit results, fraud flags) (3) Agent feedback (4) Process improvements (5) Next week plan |
| **Output** | Charles publishes weekly report to shared folder within 24 hours |

**Weekly Review Agenda (detailed):**

```
1. METRICS (10 min)
   - POIs this week: ## (cumulative: ##)
   - Coverage % by vertical
   - Agent productivity trends
   - Quality score trend

2. QUALITY (10 min)
   - Fraud flags this week: ## (## confirmed)
   - Audit results (if audit week)
   - Specific quality issues to address

3. AGENT FEEDBACK (10 min)
   - What worked well?
   - What was difficult?
   - Equipment/tool issues?
   - Safety concerns?

4. PROCESS (10 min)
   - What should we change next week?
   - Any protocol adjustments?
   - Training needs?

5. NEXT WEEK PLAN (10 min)
   - Zone assignments
   - Vertical focus
   - Special activities (audits, night capture, etc.)
   - Outreach activities (Charles)
```

### 7.3 Milestone Reviews

| Milestone | When | Participants | Purpose |
|---|---|---|---|
| **M1: Infrastructure Ready** | W1D5 (April 18) | Charles + Team Lead | Verify all tech deployments work; confirm team is ready |
| **M2: Baseline Complete** | W2D5 (April 25) | Charles + Team Lead | Review baseline coverage; assess data quality; freeze S1 |
| **M3: First Delta Published** | W3D5 (May 2) | Charles + Team Lead | Validate delta computation; review first data sample |
| **M4: First Client Meeting** | W5D4 (May 15, target) | Charles | Assess client reception; gather prospect feedback |
| **M5: Go/No-Go Decision** | W6D4 (May 21) | Charles (+ advisor) | Evaluate pilot against Go/No-Go framework |

### 7.4 Escalation Procedures

```
ESCALATION LEVELS
=================

Level 1: FIELD (Team Lead resolves)
  - Agent questions about data capture
  - Minor equipment issues (power bank dead, SIM data used up)
  - Zone access issues (road blocked, area inaccessible)
  - Agent interpersonal issues
  Response time: Same day

Level 2: PLATFORM (Charles resolves)
  - Sync failures affecting multiple agents
  - App crashes or bugs
  - Fraud flag disputes (agent claims false positive)
  - Database issues
  Response time: <12 hours (next available CET evening)

Level 3: OPERATIONAL (Charles + Team Lead jointly)
  - Agent dismissal decision
  - Safety incident in the field
  - Community complaint about data collection
  - Equipment theft/loss
  Response time: <24 hours

Level 4: STRATEGIC (Charles decision)
  - Pilot scope change (add/remove verticals)
  - Budget reallocation
  - Client pricing decisions
  - Go/No-Go decision
  Response time: <48 hours

ESCALATION CHANNEL: WhatsApp (primary), Email (secondary for documentation)
EMERGENCY: Phone call to Charles regardless of time zone
```

### 7.5 Reporting Templates

**Weekly Report Template (Charles produces after weekly review):**

```
========================================
ADL BONAMOUSSADI PILOT - WEEK [N] REPORT
Period: [Date] to [Date]
========================================

EXECUTIVE SUMMARY
[2-3 sentences on week's highlights and concerns]

DATA COLLECTION
  Total POIs (cumulative):     ### (target: ###)
  New POIs this week:          ###
  Enrichments this week:       ###
  Coverage by vertical:
    Roads:       ##/## (##%)
    Mobile Money: ##/## (##%)
    Fuel:        ##/## (##%)
    Pharmacy:    ##/## (##%)
    Alcohol:     ##/## (##%)
    Billboards:  ##/## (##%)
    Census:      ##/## (##%)

QUALITY
  Submission quality score:    ##%
  Fraud flag rate:             ##%
  Audit accuracy (if done):    ##%
  GPS <30m rate:               ##%

OPERATIONS
  Agent productivity (avg/day): ##
  Sync success rate:            ##%
  Review backlog:               ###
  Agent attendance:             ##%

COMMERCIAL (W5-W6 only)
  Outreach sent:               ##
  Meetings scheduled:          ##
  Pipeline value:              CFA ##M

ISSUES & RISKS
  [List any new issues or escalated risks]

ACTIONS FOR NEXT WEEK
  [List planned activities]

BUDGET
  Spent this week:             CFA ###,###
  Cumulative spend:            CFA ###,###
  Remaining budget:            CFA ###,###
========================================
```

---

## 8. Go/No-Go Decision Framework

### 8.1 Decision Date: W6D4 (May 21, 2026)

The Go/No-Go decision determines whether ADL proceeds to Phase 2 (expanded collection, first paid customers) or pauses/pivots.

### 8.2 Minimum Success Criteria for "GO"

ALL of the following must be met to proceed:

| # | Criterion | Threshold | Rationale |
|---|---|---|---|
| 1 | **Total POIs captured** | >= 500 | Minimum dataset size to demonstrate value across verticals |
| 2 | **P0 vertical coverage** (Roads + MoMo) | >= 70% of estimated POIs | Core product verticals must be substantially complete |
| 3 | **Audit accuracy** | >= 80% | Data must be trustworthy; below 80% = unreliable product |
| 4 | **Deltas computed** | >= 3 weekly deltas (D1, D2, D3) | Must prove the system can track change over time |
| 5 | **Agent team functional** | >= 2 agents active at pilot end | Must have retained enough team to continue operations |
| 6 | **Client outreach initiated** | >= 5 prospects contacted | Must have started commercial validation |
| 7 | **Platform stability** | Zero data loss incidents | Data integrity is non-negotiable for a data company |

### 8.3 Decision Matrix

| Outcome | Criteria Met | Commercial Signal | Action |
|---|---|---|---|
| **STRONG GO** | All 7 criteria met + >=1 client meeting completed + prospect expresses purchase intent | At least 1 prospect willing to pay or sign LOI | Proceed to Phase 2: expand to full Bonamoussadi + adjacent neighborhoods; hire 2 more agents; target first paid contract within 30 days |
| **CONDITIONAL GO** | All 7 criteria met + outreach sent but no meeting yet OR meeting held but no clear purchase intent | Prospects engaged but not yet converting | Proceed to Phase 2 with reduced scope: maintain current team; focus on top 3 verticals only; intensify commercial outreach for 30 more days; set new Go/No-Go at Week 10 |
| **PIVOT** | 5-6 of 7 criteria met OR audit accuracy 70-80% OR agent retention issues | Commercial interest exists but data quality or operations need improvement | Pause field collection for 2 weeks; fix identified issues; retrain agents; restart with improved processes; re-evaluate at Week 10 |
| **STOP** | <5 criteria met OR audit accuracy <70% OR data loss incident OR zero commercial interest | No prospects engaged; data quality fundamentally poor | Stop pilot; document lessons learned; reassess product-market fit; consider different pilot geography or vertical focus |

### 8.4 What "Good" Looks Like vs. "Not Good Enough"

| Dimension | "Good" (Strong GO) | "Acceptable" (Conditional GO) | "Not Good Enough" (Pivot/Stop) |
|---|---|---|---|
| **Data Volume** | 700+ POIs, all verticals represented | 500-700 POIs, 5+ verticals | <500 POIs or 3+ verticals missing |
| **Data Quality** | >90% audit accuracy, <5% fraud rate | 80-90% accuracy, 5-10% fraud | <80% accuracy or >10% confirmed fraud |
| **Agent Performance** | 3/3 agents active, >35 submissions/day avg | 2/3 agents active, >25 submissions/day | <2 agents active or <20 submissions/day |
| **Delta System** | Deltas clearly show real-world changes; z-scores flag genuine anomalies | Deltas compute correctly but changes are minimal (may be a data issue vs. real stasis) | Deltas compute with errors or show no meaningful patterns |
| **Commercial** | 1+ meeting with real data shown; prospect says "I would pay for this" | Outreach sent; 1+ prospect replied positively but no meeting yet | Zero responses to outreach; or responses are "not interested" |
| **Technical** | Platform stable; sync >99%; no data loss; all fraud checks operational | Minor sync issues (<5% failure); 1-2 non-critical bugs | Sync failures >5%; data loss event; critical bugs |
| **Team** | Team Lead effective; agents motivated; clear communication | Team Lead adequate; some agent motivation issues; communication gaps | Team Lead underperforming; agents disengaged; communication broken |
| **Budget** | Spent within 90-100% of plan | Spent within 100-115% of plan (within contingency) | Spent >115% of plan (exceeded contingency) |

### 8.5 Go/No-Go Report Template

```
============================================
ADL BONAMOUSSADI PILOT - GO/NO-GO ASSESSMENT
Date: [May 21, 2026]
Author: Charles Mahouve, CEO
============================================

RECOMMENDATION: [STRONG GO / CONDITIONAL GO / PIVOT / STOP]

CRITERIA ASSESSMENT:
  1. Total POIs:           ### (threshold: 500) [PASS/FAIL]
  2. P0 coverage:          ##% (threshold: 70%) [PASS/FAIL]
  3. Audit accuracy:       ##% (threshold: 80%) [PASS/FAIL]
  4. Deltas computed:      #/3 (threshold: 3)   [PASS/FAIL]
  5. Agent team:           #/2 (threshold: 2)   [PASS/FAIL]
  6. Outreach:             #/5 (threshold: 5)   [PASS/FAIL]
  7. Platform stability:   [Pass/Fail]          [PASS/FAIL]

  Criteria met: #/7

COMMERCIAL PIPELINE:
  Prospects contacted:     ##
  Meetings completed:      ##
  Pipeline value:          CFA ##M
  Purchase intent signals: [describe]

FINANCIAL SUMMARY:
  Total spend:             CFA ###,###
  Budget utilization:      ##%
  Remaining contingency:   CFA ###,###

KEY STRENGTHS:
  1. [strength]
  2. [strength]
  3. [strength]

KEY WEAKNESSES:
  1. [weakness]
  2. [weakness]
  3. [weakness]

PHASE 2 PLAN (if GO):
  Duration:                [3 months]
  Budget:                  CFA ###,###
  Team expansion:          [details]
  Geographic expansion:    [details]
  Revenue target:          CFA ##M/month by [date]

LESSONS LEARNED:
  1. [lesson]
  2. [lesson]
  3. [lesson]

============================================
```

---

## 9. Milestones

### M1: Infrastructure Ready

| Attribute | Detail |
|---|---|
| **Target Date** | W1D5 (Friday, April 18, 2026) |
| **Owner** | Charles (CEO) |
| **Definition** | All technical systems deployed and functional for pilot start |
| **Acceptance Criteria** | (1) All 7 verticals selectable in PWA (2) RBAC roles deployed (3) GPS integrity module collecting data (4) Velocity + photo hash fraud checks operational (5) Consent flow live (6) Database monitoring active (7) All agent accounts created and tested (8) Test day completed with >80% submission pass rate |
| **Predecessor** | None (first milestone) |
| **Risk** | Medium -- depends on deployment speed. All code changes are in Charles's control. |

### M2: Baseline Complete

| Attribute | Detail |
|---|---|
| **Target Date** | W2D5 (Friday, April 25, 2026) |
| **Owner** | Field Team Lead |
| **Definition** | First full survey of Bonamoussadi across all 7 verticals; Snapshot S1 frozen |
| **Acceptance Criteria** | (1) >= 400 unique POIs in database (2) All 7 verticals represented (3) All 4 zones covered (4) GPS accuracy <50m for >90% of submissions (5) Photo present for >95% of submissions (6) Snapshot S1 successfully frozen (7) Approval rate >70% (8) No data loss events |
| **Predecessor** | M1 (Infrastructure Ready) |
| **Risk** | Medium -- depends on agent productivity and training quality |

### M3: First Delta Published

| Attribute | Detail |
|---|---|
| **Target Date** | W3D5 (Friday, May 2, 2026) |
| **Owner** | Charles (CEO) |
| **Definition** | Delta D1 (S2 - S1) computed and reviewed; first data sample document created |
| **Acceptance Criteria** | (1) Snapshot S2 frozen (2) Delta D1 computed without errors (3) Delta shows at least some changes (new POIs, enrichments, status changes) (4) Z-score anomaly detection functioning (5) Data sample document created with real Bonamoussadi data (6) First spot-check audit completed with >80% accuracy (7) Data sample suitable for showing to prospects |
| **Predecessor** | M2 (Baseline Complete) |
| **Risk** | Low -- if M2 is achieved, M3 is largely automated (delta computation is code) |

### M4: First Client Meeting with Real Data

| Attribute | Detail |
|---|---|
| **Target Date** | W5D4 (Thursday, May 15, 2026) -- target, may slip to W6 |
| **Owner** | Charles (CEO) |
| **Definition** | At least one meeting with a prospective client where real Bonamoussadi data is presented |
| **Acceptance Criteria** | (1) Meeting held with decision-maker at a target account (2) Real data (not mockups) presented: map, POI counts, delta examples (3) Prospect feedback captured in writing (4) Clear next step agreed (follow-up meeting, trial request, or explicit "no") (5) If no meeting by W5D4, at least 5 outreach messages sent with data samples |
| **Predecessor** | M3 (First Delta Published) -- need data to show |
| **Risk** | High -- depends on prospect responsiveness, which is outside ADL's control. Mitigation: high-volume outreach (10+ messages) to increase probability. |

### M5: Go/No-Go Decision

| Attribute | Detail |
|---|---|
| **Target Date** | W6D4 (Wednesday, May 21, 2026) |
| **Owner** | Charles (CEO) |
| **Definition** | Formal decision on whether to continue to Phase 2 |
| **Acceptance Criteria** | (1) All 7 minimum success criteria evaluated against thresholds (2) Go/No-Go report completed using template from Section 8.5 (3) Decision documented with supporting data (4) If GO: Phase 2 plan drafted (5) If NOT GO: lessons learned documented (6) Team informed of decision (7) Agent retention conversations completed (if GO) |
| **Predecessor** | All prior milestones (M1-M4 inform the decision) |
| **Risk** | Low -- this is a decision point, not an execution task. Risk is in the quality of data informing the decision. |

### Milestone Timeline Summary

```
Week 1                 Week 2                 Week 3                 Week 4                 Week 5                 Week 6
|---April 14-----------|---April 21-----------|---April 28-----------|---May 5--------------|---May 12-------------|---May 19------------|
                   [M1]                   [M2]                   [M3]                                        [M4]                  [M5]
              Infrastructure          Baseline              First Delta                              First Client           Go/No-Go
                  Ready               Complete              Published                                 Meeting               Decision
```

---

## Summary

This execution plan brings together the work of 8 prior teammates into a concrete, actionable 6-week pilot:

1. **Total budget: CFA 2,092,168 (~$3,402 USD)** -- lean enough to self-fund, comprehensive enough to generate real results.

2. **Team of 4**: 1 Field Team Lead (CFA 200K/month) + 3 Field Agents (CFA 120-150K/month each) managed remotely by Charles from Lyon.

3. **Target: 700+ POIs** across 7 verticals in Bonamoussadi, with 5 weekly snapshots and 4 delta computations demonstrating the ability to track change over time.

4. **Commercial validation**: 10+ outreach messages to target accounts (Yango, SABC, MTN, Orange, TotalEnergies, AGL, Acmar Media) with real data samples, targeting 1+ client meeting by Week 5.

5. **Clear Go/No-Go framework**: 7 minimum criteria, 4 decision outcomes (Strong Go, Conditional Go, Pivot, Stop), all measurable and data-driven.

6. **Critical path**: Team Lead hire (W1D1-D3) is the single biggest risk to timeline. All technical work is in Charles's control and can be done in parallel.

The pilot is designed to answer one question: **Can ADL collect reliable, ground-truth data in Bonamoussadi at a cost and quality level that creates a product worth paying for?** By Week 6, the data will provide the answer.

---

## Sources

This document synthesizes findings from:
- 01-data-analyst-local-context.md (Teammate 1)
- 02-system-design-collection-workflow.md (Teammate 2)
- 03-cloud-architect-technical-architecture.md (Teammate 3)
- 04-cloud-engineer-implementation.md (Teammate 4)
- 05-cybersecurity-security-privacy.md (Teammate 5)
- 06-fraud-specialist-anti-fraud.md (Teammate 6)
- 07-marketing-commercial-strategy.md (Teammate 7)
- 08-ui-ux-design-research.md (Teammate 8)
