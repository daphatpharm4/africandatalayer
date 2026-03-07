# African Data Layer (ADL) -- Final Data Acquisition Strategy
## Bonamoussadi, Douala, Cameroon

**Document:** 10-FINAL-STRATEGY-synthesis.md
**Date:** March 2026
**Purpose:** Executive-ready synthesis of all 9 teammate deliverables into a unified, actionable strategy

---

## Table of Contents

1. [Vertical-by-Vertical Matrix](#1-vertical-by-vertical-matrix)
2. [Recommended Collection Mix Per Vertical](#2-recommended-collection-mix-per-vertical)
3. [6-Week Pilot Plan for Bonamoussadi](#3-6-week-pilot-plan-for-bonamoussadi)
4. [Priority Contact List](#4-priority-contact-list)
5. [Risk Register and Mitigation Plan](#5-risk-register-and-mitigation-plan)
6. [80/20 Focus](#6-8020-focus)
7. [Validation SOP](#7-validation-sop)

**Detailed Reference Documents:**
- `01-data-analyst-local-context.md` -- Market context, vertical analysis, competitor landscape
- `02-system-design-collection-workflow.md` -- Data model, delta computation, schemas
- `03-cloud-architect-technical-architecture.md` -- Architecture, offline-first design, API
- `04-cloud-engineer-implementation.md` -- Deployment, observability, runbooks
- `05-cybersecurity-security-privacy.md` -- Threat model, privacy framework, compliance
- `06-fraud-specialist-anti-fraud.md` -- GPS spoofing detection, duplicate detection, scoring
- `07-marketing-commercial-strategy.md` -- Buyer personas, pricing, go-to-market
- `08-ui-ux-design-research.md` -- Field capture UX, design system, agent personas
- `09-project-leader-execution-plan.md` -- 6-week plan, budget, KPIs, Go/No-Go

---

## 1. Vertical-by-Vertical Matrix

### 1.1 Billboards

| Dimension | Detail |
|---|---|
| **Data Needed** | GPS location, format/size, operator/owner, advertiser brand, content category, occupancy status (booked/vacant), condition, photo evidence, installation date |
| **Actors (Producer to Consumer)** | **Regulators:** Ministry of Communication (licensing), Douala City Council (permits). **Operators:** Alliance Media, JC Decaux Cameroun, McCann Douala, Acmar Media, local operators. **Advertisers:** MTN, Orange, SABC/Brasseries du Cameroun, banks, FMCG. **Agencies:** Media buying/planning agencies (Sortlist-listed, Bamboo Agency). **Informal:** Sign painters, poster distributors, small business owners. |
| **Products/Services** | Monthly billboard market report (PDF/dashboard), real-time alert feed for content changes, one-time competitive audit, brand share-of-voice analytics |
| **Likely Problems** | Boundary ambiguity between formal billboards and large commercial signage; ownership attribution (many lack visible operator markings); seasonal damage during rainy season (June-Oct); periodic municipal crackdowns remove unauthorized boards in batches |
| **Data Gaps** | No centralized geolocated billboard inventory for Douala exists; informal signage is completely unmapped; occupancy rates (booked vs. vacant) are not public; no historical lifecycle data |
| **Delta Method** | Monthly field re-survey of all billboard locations. Track: new installations (commercial investment signal), vacancy rate changes (advertising market health), informal-to-formal ratio shifts (regulatory enforcement), content category shifts (industry spending trends) |

### 1.2 Alcohol

| Dimension | Detail |
|---|---|
| **Data Needed** | GPS location, business name, formal/informal classification, brands available, operating hours, price points, license status, photo evidence |
| **Actors (Producer to Consumer)** | **Producers:** SABC/Brasseries du Cameroun (dominant, 75%+ market), UCB, informal distillers. **Importers:** Formal (wines, spirits), informal cross-border (Nigeria). **Distributors:** SABC network, independent wholesalers, informal. **Retailers:** Licensed bars, restaurants, off-licences, street vendors, informal spots. **Regulators:** Ministry of Commerce (licensing), Ministry of Public Health (quality). **Consumers:** Urban middle class (branded beer), lower income (artisanal brews, sachets). |
| **Products/Services** | Quarterly distribution intelligence report, monthly alert digest (new openings/closures), annual market structure report, enterprise API for distribution management integration |
| **Likely Problems** | High informal turnover (unlicensed spots open/close rapidly); dual-purpose establishments (shops selling alcohol alongside other goods); under-reporting by operators; counterfeit/smuggled products indistinguishable at POS; night-only operations make daytime capture incomplete |
| **Data Gaps** | No geolocated POS database in Douala; informal sector volume estimated but unmeasured; product-level distribution data proprietary to SABC; quality/safety data at POS non-existent; operating hours undocumented |
| **Delta Method** | Weekly agent re-surveys of commercial corridors. Track: new establishment openings/closures (economic vitality), informal-to-formal ratio (regulatory signal), brand distribution shifts (market competition), price point changes (inflation indicator), density changes by micro-zone (commercial development) |

### 1.3 Census (Demographic Proxy)

| Dimension | Detail |
|---|---|
| **Data Needed** | Building count, building height (stories), construction status (new/in-progress/complete), ground-floor commercial occupancy, residential/commercial classification, building condition, photo evidence |
| **Actors (Producer to Consumer)** | **Official:** BUCREP (census authority, last census 2005), INS (statistical surveys), Ministry of Economy/Planning. **Local:** Douala V Municipality, community chiefs (chefs de quartier). **International:** UNFPA, UNDP, World Bank. **Private:** Real estate developers (SIC, Diamond Realty), banks (Afriland, Ecobank), telecoms (network planning). |
| **Products/Services** | Quarterly neighborhood profile update, annual neighborhood census report, custom demographic analysis per project |
| **Likely Problems** | 21-year-old baseline (2005 census) makes all projections unreliable; rapid urbanization since 2005 (1.9M to 4.35M); informal residents and transient populations systematically missed; no address system in most of Douala; political sensitivity of census data |
| **Data Gaps** | No neighborhood-level population data less than 20 years old; zero building-level occupancy data; no demographic composition at neighborhood level; migration patterns untracked; no household income data at micro-zone level |
| **Delta Method** | Monthly building footprint surveys using field agents + satellite imagery comparison. Track: building construction/demolition (population proxy), occupancy rates, commercial establishment density (economic activity proxy), building height changes (densification indicator) |

### 1.4 Fuel

| Dimension | Detail |
|---|---|
| **Data Needed** | GPS location, operator/brand, services offered (convenience store, car wash, mobile money, food), stock-out status, price compliance, informal vendor presence nearby, queue indicators, photo evidence |
| **Actors (Producer to Consumer)** | **Upstream:** SONARA (national refinery, Limbe). **Storage/Distribution:** SCDP (13 depots, monopoly). **Regulation:** CSPH (price stabilization). **Marketers:** TotalEnergies (26% share), Tradex (state-owned), MRS (18%), OLA Energy (8%), Neptune Oil, ~28 smaller companies. **Informal:** Black market fuel sellers (jerry cans). **Consumers:** Private vehicles, commercial transport, moto-taxis. |
| **Products/Services** | Weekly fuel market pulse, monthly competitive report, real-time stock-out alert API, integration feed for fleet management systems |
| **Likely Problems** | Informal fuel sellers near formal stations create classification confusion; temporary closures without notification; multi-purpose stations complicate categorization; government subsidies mask true market dynamics |
| **Data Gaps** | No real-time fuel availability data at station level; queue lengths/wait times untracked; informal sales volume unknown; station-level service inventory not centralized; fuel quality not monitored systematically |
| **Delta Method** | Weekly station visits (5-10 stations are manageable). Track: stock-out events (supply chain health), new station construction (infrastructure investment), informal vendor density near stations (supply constraint indicator), service diversification (market maturation), price compliance |

### 1.5 Mobile Money

| Dimension | Detail |
|---|---|
| **Data Needed** | GPS location, operator (MTN MoMo / Orange Money / both / CAMTEL Blue Money), activity status (open/closed/inactive), services offered (cash-in, cash-out, bill pay, merchant), float availability indicator, agent branding, photo evidence |
| **Actors (Producer to Consumer)** | **Operators:** MTN Cameroon (MoMo, ~30% share), Orange Cameroon (Orange Money, ~70% share, CFA 800B monthly transactions), CAMTEL (entering 2026). **Regulators:** COBAC (banking commission), BEAC (central bank), ANIF (financial intelligence). **Super-agents:** Master agents managing sub-agent networks. **Individual agents:** Kiosk operators, street-side agents. **Fintechs:** Wave (launched Aug 2025), others. **Development:** CGAP, World Bank, Gates Foundation. |
| **Products/Services** | Weekly agent network dashboard (interactive map), monthly agent churn report, quarterly financial inclusion report, enterprise API for operator back-office integration |
| **Likely Problems** | Extreme agent turnover (open/close weekly); multi-operator agents complicate attribution; branded but inactive agents; float availability invisible without asking; KYC compliance weak (ID coverage <60%); agent-level fraud documented |
| **Data Gaps** | No public geolocated database of active agents; activity status unknown without field verification; float/liquidity untracked publicly; transaction density proprietary; commission structures and earnings opaque |
| **Delta Method** | Weekly field re-survey of all agent locations. Track: agent density changes by micro-zone (financial access indicator), agent churn rate (market health), multi-service vs. single-service agents, new merchant acceptance points (digital payment adoption) |

### 1.6 Pharmacy

| Dimension | Detail |
|---|---|
| **Data Needed** | GPS location, name, formal/informal classification, operating hours, on-duty rotation (pharmacie de garde), product categories available, proximity to health facilities, license status, photo evidence |
| **Actors (Producer to Consumer)** | **Regulators:** DPML (licensing), LANACOME (quality control), IGSPL (inspection), Pharmacists Council. **Supply:** CENAME (national essential medicines procurement). **Distributors:** Licensed pharmaceutical wholesalers. **Formal Retail:** Licensed community pharmacies. **Informal:** Street vendors, market sellers, unregistered medicine shops. **Prescribers:** Doctors, clinics, hospitals. **International:** Sanofi, Novartis, Roche, WHO, UNICEF, USAID. |
| **Products/Services** | Monthly pharmacy access report, quarterly public health intelligence report, pharmacie de garde API for consumer apps, distribution intelligence for pharma companies |
| **Likely Problems** | Informal drug vendors are mobile and hard to classify; counterfeit medicines cannot be identified visually; temporary pharmacy closures without notice; night/duty rotation poorly communicated; discrepancy between licensed and actually operating |
| **Data Gaps** | No public geolocated directory of licensed pharmacies in Douala; informal vendor locations unmapped; real-time drug availability not tracked at retail; operating hours and on-duty schedules not digitized; retail drug pricing not monitored |
| **Delta Method** | Monthly formal pharmacy visits, weekly informal vendor surveys near markets. Track: informal vendor density changes (enforcement/public health signal), new pharmacy openings, stock-out frequency for essential medicines, pharmacy-to-population ratio |

### 1.7 Transport Roads

| Dimension | Detail |
|---|---|
| **Data Needed** | Road segment GPS coordinates, surface type (paved/unpaved/gravel/laterite), condition rating, blockage status (clear/partial/blocked), cause of blockage (flooding/construction/accident), vehicle passability (sedan/SUV/truck/moto), estimated clearance time, bypass route, photo evidence |
| **Actors (Producer to Consumer)** | **Infrastructure:** Ministry of Public Works (national), Douala City Council (municipal). **Contractors:** Road construction companies (often Chinese-funded). **Transport:** Taxi drivers, moto-taxi operators, bus companies, freight/logistics companies. **Traffic police.** **Emergency services.** **Ride-hailing:** Yango, Gozem. **Development:** World Bank ($543M BRT project, construction 2026). |
| **Products/Services** | Real-time road blockage alert API, weekly road condition dashboard, rainy season flood risk map, construction zone tracking, enterprise routing integration for logistics/ride-hailing |
| **Likely Problems** | Conditions change within hours during rainy season (June-Oct); GPS accuracy reduced in urban canyons; "blocked" is subjective (spectrum from impassable to difficult); seasonal bias in dry-season data; construction zones may lack signage |
| **Data Gaps** | No real-time road condition system for Douala; historical flooding patterns not digitized by street; traffic density data unavailable; blocked roads communicated only via social media/word of mouth; road surface condition not systematically mapped; construction project locations not centrally tracked |
| **Delta Method** | Daily to real-time field reporting during rainy season; weekly during dry season. Track: blockage events (highest real-time value), condition deterioration/improvement over time, new paving or rehabilitation, flooding recurrence by location, construction project progress |

---

## 2. Recommended Collection Mix Per Vertical

The percentages below represent the recommended source of initial data for the Bonamoussadi pilot, calibrated to local realities.

| Source | Billboards | Alcohol | Census | Fuel | Mobile Money | Pharmacy | Transport Roads |
|---|---|---|---|---|---|---|---|
| **Field Ops** (paid agents) | 70% | 80% | 50% | 60% | 75% | 75% | 60% |
| **Satellite Imagery** | 5% | 0% | 25% | 5% | 0% | 0% | 15% |
| **Partner Data** (telcos, fuel cos, operators) | 5% | 5% | 5% | 15% | 10% | 5% | 5% |
| **Public Data** (govt registers, OSM) | 10% | 5% | 15% | 15% | 5% | 15% | 15% |
| **Competitor Tracking** | 10% | 10% | 5% | 5% | 10% | 5% | 5% |

**Rationale:**

- **Field ops dominate every vertical** because Bonamoussadi's informal economy (30-50% of GDP) is invisible to satellites, government registers, and partner databases. Ground truth is ADL's core value proposition.
- **Satellite imagery** is most useful for Census (building footprint change detection) and Roads (surface-level condition visible from above). It is useless for identifying whether a kiosk sells mobile money or alcohol.
- **Partner data** is highest for Fuel (branded operators like TotalEnergies and Tradex maintain station lists) and Mobile Money (MTN/Orange have agent directories, though proprietary).
- **Public data** contributes most to Fuel (CSPH price data), Pharmacy (Pharmacists Council registry), Roads (OSM road geometry, Ministry of Public Works classifications), and Census (BUCREP 2005 baseline, however outdated).
- **Competitor tracking** (monitoring what Google Maps, OSM volunteers, and Alliance Media publish) provides baseline cross-references, especially for Billboards and Mobile Money.

---

## 3. 6-Week Pilot Plan for Bonamoussadi

### 3.1 Budget Summary

| Category | Amount (CFA) | Amount (USD) | % of Total |
|---|---|---|---|
| Personnel | 975,000 | $1,585 | 46.5% |
| Equipment | 399,500 | $650 | 19.1% |
| Infrastructure | 52,275 | $85 | 2.5% |
| Operations | 392,500 | $638 | 18.7% |
| Contingency (15%) | 272,893 | $444 | 13.0% |
| **TOTAL** | **2,092,168** | **~$3,402** | **100%** |

**Personnel breakdown:** 1 Field Team Lead (CFA 200,000/month) + 3 Field Agents (CFA 100,000/month base + CFA 20,000 transport + up to CFA 30,000 performance bonus each).

**Equipment:** 4 Samsung A15 phones (CFA 75,000 each), 4 power banks, 4 SIM cards with data plans, cases, branded ID badges.

**Infrastructure:** Vercel Pro ($20/mo), Neon PostgreSQL ($20/mo), Google Gemini API ($10/mo est.), domain renewal.

### 3.2 Team Roles and Headcount

| Role | Count | Location | Compensation (CFA/month) | Key Responsibilities |
|---|---|---|---|---|
| **CEO / Technical Lead** (Charles Mahouve) | 1 | Lyon, France (remote) | -- | Platform development, admin review, client outreach, Go/No-Go decision |
| **Field Team Lead** | 1 | Douala, Bonamoussadi | 200,000 | Agent recruitment/training, daily supervision, spot-check audits, zone management |
| **Field Agents** | 3 | Douala, Bonamoussadi | 120,000-150,000 (base + transport + bonus) | 30-50 POI submissions/day, 8AM-5PM field hours, photo + GPS for every submission |
| **Total Headcount** | **5** | | | |

### 3.3 KPIs with Specific Targets

| Category | KPI | Target (End of Pilot) |
|---|---|---|
| **Data Collection** | Total POIs captured | >700 |
| | P0 coverage (Roads + MoMo) | >80% of estimated POIs |
| | P1/P2 coverage | >60% / >40% |
| | Submission quality score | >85% |
| | Enrichment rate | >40% of baseline POIs |
| **Operations** | Agent productivity | 30-50 submissions/agent/day |
| | Sync success rate | >95% |
| | Admin review turnaround | <48 hours |
| | Agent attendance | >90% |
| | System uptime (7AM-6PM WAT) | >99% |
| **Commercial** | Outreach messages sent | >10 |
| | Client meetings completed | >1 |
| | Pipeline value | >CFA 10M |
| **Quality** | Fraud flag rate | <10% |
| | Audit accuracy (spot-check) | >85% |
| | GPS accuracy <30m | >80% of submissions |
| | Photo quality pass rate | >90% |

### 3.4 Week-by-Week Milestones

| Week | Dates | Focus | Key Milestone | Deliverables |
|---|---|---|---|---|
| **Week 1** | Apr 14-18 | Setup & Preparation | **M1: Infrastructure Ready** | RBAC deployed, 7 verticals live, fraud detection operational, team hired + trained, test day completed (60-90 test submissions) |
| **Week 2** | Apr 21-25 | Baseline Capture | **M2: Baseline Complete** | 400+ POIs across 7 verticals and 4 zones; Snapshot S1 frozen; >70% approval rate |
| **Week 3** | Apr 28 - May 2 | First Delta Cycle | **M3: First Delta Published** | Snapshot S2 + Delta D1 computed; first data sample document; 10-POI spot-check audit (>80% accuracy); enrichment of 30%+ baseline |
| **Week 4** | May 5-9 | Second Delta + Optimization | Snapshot S3 + Delta D2 | 600+ POIs cumulative; 3 pitch decks ready; night-economy capture tested; second audit (>85%); bug fixes deployed |
| **Week 5** | May 12-16 | Client Outreach | **M4: First Client Meeting** | 8-10 outreach messages to Yango, SABC, MTN, Orange, TotalEnergies, AGL, Acmar, Gozem; 1+ meeting with real data; 7 vertical data samples; S4 + D3 |
| **Week 6** | May 19-22 | Assessment | **M5: Go/No-Go Decision** | Final S5 + D4 + cumulative delta (S5-S1); 50-POI comprehensive audit; pilot metrics report; agent debriefs; Phase 2 plan (if GO) |

### 3.5 Go/No-Go Criteria

**ALL 7 criteria must be met to proceed (STRONG GO or CONDITIONAL GO):**

| # | Criterion | Minimum Threshold |
|---|---|---|
| 1 | Total POIs captured | >= 500 |
| 2 | P0 vertical coverage (Roads + MoMo) | >= 70% of estimated POIs |
| 3 | Audit accuracy | >= 80% |
| 4 | Weekly deltas computed | >= 3 (D1, D2, D3) |
| 5 | Agent team functional | >= 2 agents active at pilot end |
| 6 | Client outreach initiated | >= 5 prospects contacted |
| 7 | Platform stability | Zero data loss incidents |

**Decision Matrix:**

| Outcome | Condition | Action |
|---|---|---|
| **STRONG GO** | All 7 met + 1+ client meeting + purchase intent | Expand to full Bonamoussadi + adjacent neighborhoods; hire 2 more agents; target first paid contract in 30 days |
| **CONDITIONAL GO** | All 7 met + outreach sent but no meeting or no purchase intent yet | Maintain team; focus top 3 verticals; intensify outreach 30 more days; new Go/No-Go at Week 10 |
| **PIVOT** | 5-6 of 7 met OR audit accuracy 70-80% | Pause 2 weeks; fix issues; retrain; restart; re-evaluate at Week 10 |
| **STOP** | <5 met OR accuracy <70% OR data loss OR zero commercial interest | Stop pilot; document lessons; reassess PMF |

---

## 4. Priority Contact List

### 4.1 Transport Roads

| Company | Why They'd Buy ADL Data | Est. Annual Budget (CFA) | Contact Approach |
|---|---|---|---|
| **Yango Cameroon** | Real-time routing; ETA accuracy; driver safety during floods | 15-25M | Warm intro via Douala tech community; WhatsApp to Country Manager |
| **Africa Global Logistics (AGL)** | Truck routing; avoid blockages; reduce fuel waste | 10-20M | Cold email to Douala Operations Director; ROI pitch |
| **Gozem Cameroon** | Moto-taxi routing; delivery ETA; food delivery reliability | 5-10M | API integration pitch to tech team |
| **GEODIS Cameroon** | Freight corridor monitoring; customs route planning | 5-10M | LinkedIn outreach to Branch Manager |
| **World Bank (BRT Project)** | BRT construction monitoring ($543M project); traffic impact data | 20-50M/project | Formal vendor registration; respond to RFPs |
| **Douala City Council (CUD)** | Emergency response; flood zone mapping; urban planning | 5-15M | Government relations; present at council meetings |
| **Ministry of Public Works** | Road maintenance prioritization; infrastructure monitoring | 10-20M | Government procurement process |

### 4.2 Mobile Money

| Company | Why They'd Buy ADL Data | Est. Annual Budget (CFA) | Contact Approach |
|---|---|---|---|
| **MTN Cameroon (MoMo)** | Agent network optimization; competitive intel vs. Orange; CFA 70.2B revenue | 20-35M | Target Head of Mobile Financial Services; enterprise sales |
| **Orange Cameroon (Orange Money)** | Agent expansion intel; churn tracking; market leadership defense; CFA 65B revenue | 20-35M | Target Director of Orange Money; enterprise sales |
| **CAMTEL (Blue Money)** | Market entry planning; agent location strategy (entering 2026) | 10-20M | Government connections; essential market entry data positioning |
| **Wave Cameroon** | Competitive landscape; agent density; market sizing (launched Aug 2025) | 5-15M | Direct CEO/CTO outreach; startup-to-startup |
| **COBAC** | Agent compliance monitoring; licensing verification | 5-10M | Regulatory engagement; compliance tool pitch |
| **Bill & Melinda Gates Foundation** | Agent access mapping for financial inclusion programs | 15-30M/project | Formal grant/procurement; through CGAP network |

### 4.3 Alcohol

| Company | Why They'd Buy ADL Data | Est. Annual Budget (CFA) | Contact Approach |
|---|---|---|---|
| **SABC / Brasseries du Cameroun** | Distribution coverage verification (75%+ market share); informal market sizing; Douala HQ | 15-25M | Warm intro via local networks; target Head of Trade Marketing |
| **Union Camerounaise de Brasseries (UCB)** | White-space identification; distribution expansion | 8-15M | Cold outreach to Sales Director; "find where SABC is weak" |
| **Diageo** | Informal spirits tracking; counterfeit monitoring | 5-10M | Regional office; London/Nairobi connection |
| **Castel Group** (parent of SABC) | Pan-African portfolio tracking; Cameroon deep-dive | 10-20M | Paris HQ; data for African operations review |
| **WHO Cameroon** | Informal alcohol mapping for public health interventions | 5-15M/project | UN procurement; health data partnership |

### 4.4 Fuel

| Company | Why They'd Buy ADL Data | Est. Annual Budget (CFA) | Contact Approach |
|---|---|---|---|
| **TotalEnergies Cameroon** | Competitive tracking (26% share); expansion planning; service benchmarking | 8-15M | Enterprise outreach; Director of Network Development |
| **Tradex SA** | Market intelligence for expansion (state-owned, 112 regional stations) | 5-10M | Government connections; Douala HQ direct |
| **MRS** | Competitive positioning (18% share); stock-out monitoring at competitors | 5-8M | Direct B2B outreach |
| **CSPH** | Price compliance monitoring across stations | 5-10M | Government procurement; compliance tool pitch |

### 4.5 Pharmacy

| Company | Why They'd Buy ADL Data | Est. Annual Budget (CFA) | Contact Approach |
|---|---|---|---|
| **Sanofi Cameroon** | Distribution mapping; counterfeit product tracking | 5-10M | Regional Africa team; distribution integrity pitch |
| **CENAME** | Distribution coverage verification; stock-out identification | 3-8M | Ministry of Health liaison |
| **WHO Cameroon** | Counterfeit medicine mapping; pharmacy access metrics | 10-20M/project | UN procurement; health data partnership |
| **USAID Global Health Supply Chain** | Last-mile distribution data; pharmacy access | 10-15M/project | USAID procurement; through implementing partners |

### 4.6 Billboards

| Company | Why They'd Buy ADL Data | Est. Annual Budget (CFA) | Contact Approach |
|---|---|---|---|
| **Acmar Media Group** | Competitive intelligence; market monitoring (Douala HQ) | 3-5M | Direct sales; free competitive audit offer |
| **JC Decaux Cameroun** | Market share tracking; unauthorized competitor identification | 3-5M | Paris/regional office + local contact |
| **Alliance Media Cameroon** | Occupancy tracking; competitive intelligence | 3-5M | Direct outreach via Cameroon office |
| **MTN Cameroon (marketing)** | Campaign verification; competitive share-of-voice | 3-5M | Marketing department |

### 4.7 Census (Demographic Proxy)

| Company | Why They'd Buy ADL Data | Est. Annual Budget (CFA) | Contact Approach |
|---|---|---|---|
| **World Bank (Sustainable Cities)** | Baseline urban data for $200M project; impact monitoring | 20-50M/project | Formal procurement; consultant networks |
| **SIC (Societe Immobiliere du Cameroun)** | Demand forecasting; site selection (5,676 planned homes) | 5-10M | Government connections; direct pitch |
| **UNDP Cameroon** | SDG monitoring; poverty mapping | 5-15M/project | UN procurement |
| **Afriland First Bank** | Branch planning; mortgage market sizing by neighborhood | 3-5M | Bank strategy/digital team |

### 4.8 Top 10 Priority Accounts (Cross-Vertical)

These are the first 10 accounts to approach, ordered by estimated value and time-to-close:

| Priority | Company | Vertical(s) | Est. Annual Value (CFA) | First Action |
|---|---|---|---|---|
| 1 | Yango Cameroon | Roads | 15-25M | Warm intro; free rainy season pilot offer |
| 2 | AGL | Roads + Fuel | 10-20M | Cold email; ROI pitch on truck rerouting |
| 3 | SABC / Brasseries du Cameroun | Alcohol | 15-25M | Warm intro; "map every bar in Bonamoussadi in 30 days" |
| 4 | MTN Cameroon (MoMo) | Mobile Money | 20-35M | Target Head of MFS; competitive intelligence pilot |
| 5 | Orange Cameroon | Mobile Money | 20-35M | Approach separately; agent churn analytics |
| 6 | TotalEnergies Cameroon | Fuel | 8-15M | Director of Network Development; station benchmarking |
| 7 | Gozem Cameroon | Roads | 5-10M | API integration pitch to tech team |
| 8 | Acmar Media Group | Billboards | 3-5M | Direct; free competitive audit of Bonamoussadi |
| 9 | World Bank (Douala Projects) | Roads + Census | 20-50M/project | Formal procurement; RFP response |
| 10 | Tradex SA | Fuel | 5-10M | Government connections; market intelligence pitch |

---

## 5. Risk Register and Mitigation Plan

### Top 20 Risks

| # | Risk | Category | Probability | Impact | Risk Score | Mitigation Strategy | Owner |
|---|---|---|---|---|---|---|---|
| **1** | GPS spoofing by agents (fabricated submissions from home) | Fraud | High | Critical | 20 | Multi-layered detection: client-side mock location API, EXIF GPS cross-validation (1km threshold), IP geolocation (50km), velocity analysis (>200km/h = block, >80km/h = flag), sensor data (accelerometer), batch statistical anomaly detection, perceptual photo hashing | Charles |
| **2** | Fabricated/ghost entity submissions (phantom POIs) | Fraud | High | Critical | 20 | Photo evidence required for all submissions; perceptual hash deduplication; entity proximity thresholds per vertical (e.g., 10m reject for mobile money); spot-check audits (10-50 POIs/week); XP escrowed until admin review | Charles |
| **3** | Cannot hire qualified Team Lead by W1D3 | Operational | Medium | High | 12 | Pre-screen candidates before pilot start; have backup candidate; Charles can remotely manage W1 if needed | Charles |
| **4** | Field agents produce low-quality data | Operational | Medium | High | 12 | Structured 3-hour training (W1D4); supervised test day with quality gate; progressive disclosure UI (3-tap capture); daily Team Lead coaching; performance bonuses tied to quality not just volume | Team Lead |
| **5** | Zero client meetings by end of W6 | Commercial | Medium | High | 12 | Start outreach W5D1; free data samples as hook; 10+ outreach messages; leverage advisor network; target Yango (fastest close) and SABC (highest value) | Charles |
| **6** | Admin review bottleneck (Charles alone as reviewer) | Operational | High | Medium | 10 | Auto-approve submissions with fraud score <20 and confidence >70; batch approval for low-risk items; prioritize fraud-flagged only for manual review; train Team Lead as secondary reviewer | Charles |
| **7** | Connectivity issues during field capture | Technical | High | Medium | 10 | Offline-first architecture (IndexedDB queue); exponential backoff sync; no data loss by design; agents trained to sync on WiFi at end of day; sync status bar always visible in app | Charles |
| **8** | Data protection compliance risk (Law 2024/017, deadline June 23, 2026) | Regulatory | Low | Critical | 10 | Consent collection flow deployed W1D4; no PII beyond business names; photos of public storefronts only; register as data controller before June deadline; international data transfer safeguards | Charles |
| **9** | Charles unavailable due to emergency | Operational | Low | Critical | 10 | Document all platform credentials; Team Lead trained to manage field ops independently for 1 week; weekly snapshot cron is automated; emergency escalation via phone | Charles |
| **10** | Recycled/stock photos used for multiple submissions | Fraud | High | High | 12 | SHA-256 exact hash matching; perceptual hash (aHash) with Hamming distance threshold (<=5 = near-identical); EXIF fingerprint matching (same device + time + GPS = flag); screenshot detection | Charles |
| **11** | Agent collusion to inflate XP | Fraud | Medium | High | 10 | Graph analysis of user-to-user and user-to-point relationships; detect circular enrichment patterns; monitor cross-agent duplicate submissions within proximity thresholds | Charles |
| **12** | Agent attrition during pilot | Operational | Medium | Medium | 8 | Competitive pay (CFA 120-150K/month total); performance bonuses (up to CFA 30K); gamification (XP, leaderboard); community building; branded identity | Team Lead |
| **13** | Fraud detection false positives frustrate agents | Technical | Medium | Medium | 8 | Low-end device exceptions for GPS accuracy thresholds (2km EXIF vs 1km); gradual threshold tuning based on W2 data; transparent quality feedback to agents; trust tiers (new/established/veteran) with escalating autonomy | Charles |
| **14** | Alt account farming by agents | Fraud | Medium | High | 10 | Device fingerprint binding (deviceId stored); same IP + device across multiple accounts = flag; phone verification requirement; limit one account per SIM | Charles |
| **15** | Unauthorized bulk data export by authenticated users | Security | Medium | High | 10 | Rate limiting on API endpoints; per-user export throttling; audit logging of all data access; role-based access control (field agents cannot export) | Charles |
| **16** | Insider data manipulation (direct DB access) | Security | Low | Critical | 10 | Event-sourced append-only model; dedicated fraud audit log table; admin action logging; principle of least privilege for database access | Charles |
| **17** | Phone theft or damage in field | Operational | Medium | Low | 4 | Phone cases + screen protectors budgeted; equipment agreement signed by agents; 15% contingency covers replacement; agents carry equipment home | Team Lead |
| **18** | Community resistance to data collectors | Operational | Low | Medium | 4 | Branded ID badges and T-shirts; agents explain ADL mission; no personal data collected; photos of public storefronts only; Team Lead handles escalations; community chief engagement | Team Lead |
| **19** | Budget overrun | Commercial | Low | Medium | 4 | 15% contingency budgeted; weekly expense tracking; no variable costs beyond personnel/data plans; front-loaded spend (W1 = CFA 948K, W2-6 = CFA 174K/week steady state) | Charles |
| **20** | Rainy season early onset disrupts W5-W6 fieldwork | Operational | Low | Medium | 4 | Pilot starts April (dry season); typical rain onset June; if early rain, pivot to road condition data collection (highest value during rain); equip agents with umbrellas/raincoats | Team Lead |

---

## 6. 80/20 Focus

### 6.1 Which Verticals to Prioritize

The top 20% of collection effort that produces 80% of commercial value:

| Rank | Vertical | % of Collection Effort | % of Estimated Revenue | Revenue/Effort Ratio | Action |
|---|---|---|---|---|---|
| **1** | **Transport Roads** | 10% | 25% | **2.5x** | Allocate resources first; baseline before rainy season |
| **2** | **Mobile Money** | 15% | 30% | **2.0x** | Highest absolute revenue; collect simultaneously with Roads |
| **3** | **Fuel** | 5% | 10% | **2.0x** | Quick wins (only 5-10 stations); natural cross-sell with Roads |
| 4 | Alcohol | 25% | 20% | 0.8x | Strong buyer interest but high collection difficulty |
| 5 | Billboards | 10% | 8% | 0.8x | Fixed, visible, daytime -- easy but smaller market |
| 6 | Pharmacy | 15% | 5% | 0.3x | High project-based value from WHO/USAID, slower sales cycle |
| 7 | Census | 20% | 2% | 0.1x | Strategic long-term asset; collect passively during other surveys |

**Conclusion:** Focus 30% of field agent time on Roads + Mobile Money + Fuel to capture 65% of estimated revenue. These are the 80/20 sweet spot.

**Resource Allocation for First 6 Months:**
- 40% of field agent time: Roads + Mobile Money (P0, highest ROI)
- 25% of field agent time: Alcohol + Fuel (P1, strong buyer interest)
- 20% of field agent time: Billboards + Pharmacy (P1-P2, valuable but slower cycle)
- 15% of field agent time: Census proxy (P2, strategic long-term)

### 6.2 Which Data Fields Matter Most (Must-Have vs. Nice-to-Have)

**Across all verticals, these data fields generate disproportionate buyer interest:**

| Vertical | Must-Have Fields (buyers pay for these) | Nice-to-Have (add later) |
|---|---|---|
| **Roads** | Blockage status, vehicle passability, estimated clearance time, bypass route | Road surface type, traffic density |
| **Mobile Money** | Agent location (GPS), operator (MTN/Orange/both), activity status (open/closed) | Float availability, services offered, commission rates |
| **Fuel** | Station location, operator/brand, availability status (stock-out indicator) | Services offered, queue length, informal vendor count |
| **Alcohol** | POS location, brands available, formal/informal classification | Operating hours, price points, license status |
| **Billboards** | Location, advertiser/brand, occupancy status (booked/vacant) | Format/size, condition, installation date |
| **Pharmacy** | Location, formal/informal classification, operating status | On-duty rotation, product categories, stock-out data |
| **Census** | Building count, construction activity (new/in-progress/complete) | Building height, occupancy, residential/commercial split |

### 6.3 Highest-Value Delta Types

| Rank | Delta Type | Verticals Affected | Why Highest Value | Primary Buyer |
|---|---|---|---|---|
| **1** | **Blockage/disruption events** | Roads, Fuel (stock-outs) | Immediate operational impact; time-sensitive; saves real money per incident (CFA 50-200K per truck reroute avoided) | Logistics, ride-hailing |
| **2** | **New entity openings** | MoMo, Alcohol, Pharmacy | Distribution expansion opportunity; competitive intelligence; first-mover advantage | Telcos, breweries, pharma |
| **3** | **Entity closures** | MoMo, Alcohol | Network health signal; competitor opportunity; market contraction indicator | Telcos, breweries |
| **4** | **Brand/operator switches** | MoMo, Billboards | Competitive market share shift signal | Telcos, ad agencies |
| **5** | **Formal/informal ratio shifts** | Alcohol, Pharmacy | Regulatory environment signal; market maturation | Regulators, public health, development |
| **6** | **Density changes by zone** | All verticals | Neighborhood economic development signal; investment indicator | Banks, developers, telcos, government |

### 6.4 Where to Allocate Limited Resources

**Priority collection schedule for months 1-6:**

| Month | Primary Focus | Secondary Focus | Rationale |
|---|---|---|---|
| **Month 1 (Apr)** | Roads baseline (all segments) | Mobile Money agent mapping | Roads baseline must be done before rainy season; MoMo collected simultaneously |
| **Month 2 (May)** | MoMo deep collection (activity, services) | Fuel stations (complete inventory) | Deepen MoMo data for telco pitch; fuel is quick (5-10 stations) |
| **Month 3 (Jun)** | Roads ACTIVE MONITORING (rains begin) | Alcohol POS mapping begins | Rainy season = highest-value road data; start alcohol for SABC pitch |
| **Month 4 (Jul)** | Roads + Alcohol + Billboards | Continue MoMo updates | Multi-vertical strengthens platform pitch |
| **Month 5 (Aug)** | All verticals weekly updates | Pharmacy mapping begins | System mature enough for full coverage |
| **Month 6 (Sep)** | All verticals + census proxy begins | Prepare first annual reports | Census starts as longitudinal baseline builds |

---

## 7. Validation SOP

### 7.1 End-to-End Data Flow

```
CAPTURE --> VERIFY --> SCORE CONFIDENCE --> PUBLISH DELTA

Step 1: CAPTURE (Field Agent, via PWA)
  |
  |  Agent selects vertical, takes photo, GPS auto-captured,
  |  fills required fields (progressive disclosure)
  |  GPS integrity report collected (mock location, sensors, accuracy)
  |  Submission queued in IndexedDB (offline-first)
  |
  v
Step 2: SYNC (Client --> Server)
  |
  |  IndexedDB queue flushes with idempotency keys
  |  Exponential backoff on failure
  |  Photo uploaded to Vercel Blob
  |  Event written to point_events (CREATE_EVENT or ENRICH_EVENT)
  |
  v
Step 3: VERIFY (Server-Side, Automated)
  |
  |  3a. GPS Validation Pipeline
  |  3b. Photo Validation Pipeline
  |  3c. Entity Deduplication
  |  3d. Fraud Risk Scoring
  |
  v
Step 4: SCORE CONFIDENCE
  |
  |  Composite confidence score computed
  |  Auto-routing: approve / soft review / hard review / reject
  |
  v
Step 5: ADMIN REVIEW (for flagged submissions)
  |
  |  Admin reviews photo, GPS, metadata, fraud flags
  |  Approve, reject, or request re-submission
  |
  v
Step 6: PUBLISH DELTA (Weekly)
  |
  |  Weekly snapshot frozen (Vercel Cron)
  |  Delta computed: S(n) - S(n-1)
  |  Z-score anomaly detection on delta stats
  |  Published to API / dashboard / reports
```

### 7.2 Confidence Scoring Formula

ADL uses two complementary scores:

#### A. Data Quality Confidence Score (0-100)

Measures how reliable a data point is. Computed per POI and updated with each event.

```
DATA QUALITY CONFIDENCE SCORE
==============================

Factor                Weight    Scoring
--------------------------------------------------
Recency               25%      100 if <7 days old, decays linearly to 0 at 90 days
Source Count           20%      min(100, sourceCount * 25) -- more sources = higher confidence
Photo Evidence         20%      100 if photo with EXIF GPS; 60 if photo without EXIF; 0 if no photo
GPS Accuracy           15%      100 if <10m; 80 if <30m; 50 if <50m; 20 if <100m; 0 if >100m
Reviewer Approval      10%      100 if admin approved; 50 if pending; 0 if rejected
Field Completeness     10%      (filled fields / total fields) * 100

FINAL SCORE = weighted sum of all factors, clamped to 0-100

Publication threshold: >= 40 (below 40, data is withheld from client-facing products)
High-confidence threshold: >= 70 (used for premium data products)
```

#### B. Fraud Risk Score (0-100)

Measures how likely a submission is fraudulent. Computed at submission time.

```
FRAUD RISK SCORE
=================

Category              Weight    Signals
--------------------------------------------------
GPS Integrity          25%      Inverted GPS confidence (100 - GPS_CONFIDENCE_SCORE)
                                Mock location detection, EXIF mismatch, IP mismatch,
                                velocity analysis, sensor data

Photo Integrity        25%      SHA-256 exact duplicate check (reject if different POI)
                                Perceptual hash (aHash, Hamming distance <=5 = near-identical)
                                EXIF fingerprint match (same device+time+GPS)
                                Photo freshness (100 if <30 min, decays; <10 if >7 days)
                                Screenshot detection, metadata editing detection

Temporal Consistency   15%      Submission velocity (>200 km/h = block, >80 km/h = flag)
                                Time-of-day plausibility
                                Offline batch anomaly analysis

Agent History          20%      Account age, prior fraud flags, prior rejections,
                                trust tier (new/established/veteran),
                                consecutive clean submissions

Behavioral Patterns    15%      Self-enrichment patterns, device sharing,
                                category distribution anomalies, IP reputation (VPN/datacenter)

COMPOSITE FRAUD RISK = weighted sum, clamped to 0-100
```

#### C. Auto-Routing Rules

| Fraud Risk Score | Data Quality Score | Action | XP |
|---|---|---|---|
| 0-20 | >= 70 | **Auto-approve** | Award immediately |
| 0-20 | 40-69 | **Soft review** (admin reviews within 48h) | Escrow until review |
| 21-50 | Any | **Soft review** | Escrow until review |
| 51-70 | Any | **Hard review** (admin must investigate) | Deny until cleared |
| 71-100 | Any | **Auto-reject** | Deny |

### 7.3 Fraud Detection Checkpoints

Each submission passes through these checkpoints in order:

```
CHECKPOINT 1: CLIENT-SIDE (before submission)
  [ ] Mock location API check (Android isMocked flag)
  [ ] GPS accuracy sanity (reject if accuracy = 0 or <1m on consumer device)
  [ ] Sensor data collection (2 sec accelerometer sample)
  [ ] Network type recording
  [ ] GPS timestamp vs device clock check (flag if >30s drift)

CHECKPOINT 2: SERVER-SIDE (at submission time)
  [ ] EXIF GPS vs submission GPS (threshold: 1km standard, 2km low-end device)
  [ ] IP geolocation vs submission GPS (threshold: 50km)
  [ ] Velocity check (time + distance since last submission by same user)
      - >200 km/h or >5km in <2 min = BLOCK
      - >80 km/h = FLAG
  [ ] Photo SHA-256 exact hash check against all prior submissions
  [ ] Perceptual hash check (Hamming distance <=5 on aHash = flag)
  [ ] EXIF fingerprint dedup (same device + time + GPS = flag)
  [ ] Photo freshness check (>7 days old = reject; >24h = flag)
  [ ] Screenshot detection (no EXIF + specific resolution patterns)
  [ ] Entity proximity dedup (per-vertical thresholds, e.g., 10m for mobile money)
  [ ] Geofence check (within Bonamoussadi: 4.0755-4.0999 N, 9.7185-9.7602 E)

CHECKPOINT 3: BATCH ANALYSIS (daily cron)
  [ ] Agent movement pattern analysis (cluster count, radius, precision distribution)
  [ ] Cross-agent duplicate detection (different agents submitting same entity)
  [ ] Collusion pattern detection (circular enrichment graphs)
  [ ] Coordinate precision anomaly (>80% of submissions with <=4 decimal places = flag)
  [ ] Alt account detection (same deviceId or IP across multiple userIds)
```

### 7.4 Review Workflow

```
ADMIN REVIEW QUEUE WORKFLOW
=============================

1. TRIAGE (daily, 9:00 AM WAT)
   - Sort queue by fraud risk score (highest first)
   - Auto-rejected items: log and archive (no action needed)
   - Auto-approved items: log and publish (no action needed)
   - Hard review items: investigate immediately
   - Soft review items: batch review after hard reviews

2. INVESTIGATION (per flagged submission)
   - View side-by-side: photo | map (GPS pin) | submission data | fraud flags
   - Check EXIF metadata panel (capture time, device, GPS)
   - Compare with nearby existing POIs (dedup check)
   - Review agent history (recent submissions, trust score, prior flags)
   - If GPS flag: verify photo content matches the neighborhood
   - If photo flag: compare flagged photo with matched photo(s)

3. DECISION
   - APPROVE: submission enters published dataset; XP released to agent
   - REJECT: submission archived; XP denied; agent notified with reason
   - REQUEST RE-SUBMISSION: agent asked to revisit and re-capture
   - MERGE: duplicate submission merged with existing POI (enrichment)

4. AGENT FEEDBACK
   - Rejection reason communicated to agent via app notification
   - Repeated rejections trigger trust score reduction
   - 3+ confirmed fraud incidents = agent suspension pending investigation
```

### 7.5 Spot-Check Audit Protocol

Physical field verification of data accuracy:

```
SPOT-CHECK AUDIT SOP
=====================

Frequency: Weekly (W3-W6), expanding scope each week
  - Week 3: 10 random POIs
  - Week 4: 10 different random POIs
  - Week 5: 15 random POIs
  - Week 6: 50 POIs (comprehensive, all verticals)

Executor: Field Team Lead (independent of agents who submitted)

For each audited POI:
  1. Navigate to the GPS coordinates recorded in the submission
  2. Verify EXISTENCE: Does the entity physically exist at this location? (Y/N)
  3. Verify NAME: Does the name match what was submitted? (Y/N/Close)
  4. Verify CATEGORY: Is the vertical classification correct? (Y/N)
  5. Verify STATUS: Is the operating status correct (open/closed)? (Y/N)
  6. Verify PHOTO: Does the submission photo match what you see? (Y/N)
  7. Take independent verification photo
  8. Note any discrepancies

Scoring:
  - MATCH: All 5 criteria verified (existence, name, category, status, photo)
  - PARTIAL: 3-4 criteria match (acceptable, may need enrichment)
  - MISMATCH: <3 criteria match (data quality failure)

Audit accuracy = (MATCH + PARTIAL) / Total Audited * 100

Threshold: >= 80% (W3), >= 85% (W4-W5), >= 85% (W6 comprehensive)

If audit accuracy drops below 70%: PAUSE collection; retrain agents; investigate cause
```

### 7.6 Publication Criteria

A data point is published (made available to clients via API/dashboard) when:

```
PUBLICATION CRITERIA
=====================

ALL of the following must be true:

  [x] Data Quality Confidence Score >= 40
  [x] Fraud Risk Score < 71 (not auto-rejected)
  [x] Admin review status is "approved" or "auto-approved"
  [x] Photo evidence is present
  [x] GPS coordinates are within the designated collection zone
  [x] At least one required field per vertical is populated

For PREMIUM/HIGH-CONFIDENCE publication:

  [x] All of the above, PLUS:
  [x] Data Quality Confidence Score >= 70
  [x] Fraud Risk Score < 21
  [x] Photo has EXIF GPS matching submission GPS (within 1km)
  [x] At least one spot-check audit has verified this POI (or same-vertical POIs in same zone)
  [x] At least one enrichment event exists (data confirmed by multiple sources)

DELTA PUBLICATION:

  Weekly snapshot frozen every Friday at 23:59 WAT (Vercel Cron)
  Delta computed: new POIs, changed fields, removed/closed entities
  Z-score anomaly detection flags statistical outliers for manual review
  Delta published to API endpoint: /api/deltas?snapshot=S{n}
  Client notification sent for subscribed verticals/zones
```

---

## Summary

This strategy is built on three pillars, as synthesized from all 9 teammate deliverables:

**1. Ground truth that nobody else has.** No competitor maps the informal economy at street level with verified, GPS-located, photo-evidenced data points. In Cameroon, where 30-50% of GDP is informal and the last census is 21 years old, this gap is enormous. ADL fills it.

**2. Consistent deltas that demonstrate change.** Weekly snapshots with computed deltas turn static maps into dynamic intelligence. The delta is the product -- not the map. Road blockages during rainy season, mobile money agent churn, new alcohol outlets opening -- these changes are what buyers pay for.

**3. Immediately clear value for transactional buyers.** Every data product answers: "If I buy this, what money do I save or make this week?" For logistics companies: avoid a CFA 200K truck reroute. For telcos: identify 15 agent gaps before competitors fill them. For breweries: find 23 bars where they are not selling.

**The 6-week pilot (April 14 - May 22, 2026) will answer one question:** Can ADL collect reliable, ground-truth data in Bonamoussadi at a cost (~$3,400 total) and quality level (>85% audit accuracy) that creates a product worth paying for?

**Revenue trajectory if successful:**
- Month 6: CFA 5-10M/month (2-3 paying customers at Professional tier)
- Month 12: CFA 20-40M/month (1-2 enterprise + 5-8 professional tier)
- Path to CFA 100M+/month: City-wide Douala coverage, enterprise telco and development org contracts

---

*This document synthesizes the complete work of 9 specialized teammates. For deep dives into any topic, refer to the individual deliverables (01 through 09) in the /research directory.*
