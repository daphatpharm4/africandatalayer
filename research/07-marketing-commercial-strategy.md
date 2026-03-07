# ADL Marketing & Commercial Strategy: Who Pays, Why, and How
## Bonamoussadi, Douala, Cameroon

**Teammate 7 -- Marketing Genius Deliverable**
**Date:** March 2026

---

## Table of Contents

1. [Target Customer Matrix](#1-target-customer-matrix)
2. [Use Case Prioritization](#2-use-case-prioritization)
3. [Delta-to-Value Conversion](#3-delta-to-value-conversion)
4. [Go-to-Market Strategy](#4-go-to-market-strategy)
5. [Competitive Positioning](#5-competitive-positioning)
6. [Priority Contact List](#6-priority-contact-list)
7. [80/20 Analysis](#7-8020-analysis)

---

## Relationship to Prior Deliverables

This document builds on the work of Teammates 1-6:

- **Teammate 1 (Local Context):** The vertical analysis, priority matrix (Roads and Mobile Money at P0), market sizing ($4.9B alcohol market, $160M pharma market, 890 fuel stations, 100-200 mobile money agents in Bonamoussadi alone), competitor landscape, and regulatory environment form the commercial foundation. Key insight: the informal sector is ADL's biggest opportunity -- no competitor maps it systematically.
- **Teammate 2 (System Design):** The delta computation engine (weekly snapshots, z-score anomaly detection, confidence scoring) is the product backbone. Without consistent deltas, there is nothing to sell. The system captures exactly the data changes that buyers care about.
- **Teammate 3 (Cloud Architect):** The API design (`/api/snapshots`, `/api/deltas`, `/api/points`) defines the technical delivery mechanism for data products. The cost structure ($50-200/month infrastructure) sets the floor for pricing.
- **Teammate 4 (Implementation):** The deployment pipeline and observability stack ensure reliable data delivery -- essential for enterprise customers who need SLA guarantees.
- **Teammate 5 (Cybersecurity):** Compliance with Cameroon's Law No. 2024/017 (deadline June 2026) is a selling point. ADL can position as "compliant from day one" while competitors scramble.
- **Teammate 6 (Anti-Fraud):** The confidence scoring and fraud detection system is the trust engine. Every data product must communicate its confidence level to justify premium pricing. Clients pay for verified ground truth, not unvalidated scrapes.

**Core commercial thesis (from advisor Yannick Lefang):**
- "You need consistent deltas to be able to sell, and that consistency matters."
- "Africans are very transactional" -- the value proposition must be immediately clear, with tangible ROI demonstrated in the first conversation.

---

## 1. Target Customer Matrix

### 1.1 Billboards

| Dimension | Detail |
|---|---|
| **Primary Buyers** | Advertising agencies (media buying/planning), billboard operators seeking competitive intelligence |
| **Secondary Buyers** | FMCG brand marketing teams, telecoms marketing departments, municipal regulatory bodies |
| **Data Product Needed** | Geolocated billboard inventory with occupancy status, advertiser identification, content category, format/size, condition, and monthly change reports |
| **Price Sensitivity** | Medium. Advertising agencies are accustomed to paying for media monitoring tools. Budget holders exist. |
| **Willingness to Pay** | Medium-High for competitive intelligence. An agency managing CFA 500M+ in outdoor spend will pay CFA 2-5M/year for complete market visibility. |
| **Sales Cycle** | 2-4 weeks for agencies (tactical purchase), 6-8 weeks for brand marketers (budget approval needed) |
| **Decision Maker** | Media Planning Director, Head of Out-of-Home at agency; Brand Manager or Marketing Director at advertiser |

**Specific Companies:**

| Company | Type | Why They'd Buy |
|---|---|---|
| **Acmar Media Group** (Douala HQ) | Billboard operator, media planning & buying | Competitive intelligence on rival operators; verify own inventory vs. actual field state |
| **JC Decaux Cameroun** | International billboard operator | Market share tracking; identify unauthorized competitors; expansion planning |
| **Alliance Media Cameroon** | Billboard operator (airport + urban) | Verify occupancy; track competitor placements around their sites |
| **McCann Douala** | Global advertising agency | Client reporting on OOH campaign share-of-voice |
| **Bamboo Agency** (Douala) | Local digital/marketing agency | Pitch OOH recommendations to clients using real market data |
| **MTN Cameroon** (marketing dept.) | Telecom, major OOH advertiser | Track own billboard presence vs. Orange; verify agency placements |
| **Orange Cameroon** (marketing dept.) | Telecom, major OOH advertiser | Same competitive intelligence needs as MTN |
| **SABC / Brasseries du Cameroun** (marketing dept.) | Brewery, dominant OOH spender | Monitor brand visibility across Douala; verify agency campaign delivery |

---

### 1.2 Alcohol

| Dimension | Detail |
|---|---|
| **Primary Buyers** | Breweries and spirits producers (distribution intelligence), FMCG distribution teams |
| **Secondary Buyers** | Public health organizations (WHO, Ministry of Public Health), regulatory bodies, market research firms |
| **Data Product Needed** | Geolocated point-of-sale map (formal + informal), brand availability by location, price tracking, new outlet openings/closings, informal-to-formal ratio |
| **Price Sensitivity** | Low for breweries (data spend is tiny vs. distribution budget). High for public health orgs (donor-funded, procurement cycles). |
| **Willingness to Pay** | High. SABC alone has >CFA 300B annual revenue. Distribution intelligence worth CFA 5-15M/year per region. |
| **Sales Cycle** | 4-8 weeks for breweries (commercial decision), 3-6 months for NGOs (procurement) |
| **Decision Maker** | Head of Trade Marketing, Distribution Director at brewery; Country Director at NGO |

**Specific Companies:**

| Company | Type | Why They'd Buy |
|---|---|---|
| **SABC / Brasseries du Cameroun** | Dominant brewery (75%+ market share) | Distribution coverage verification; identify white-space outlets; competitive brand tracking vs. UCB |
| **Union Camerounaise de Brasseries (UCB)** | Second brewery | Identify outlets where SABC is weak; distribution expansion planning |
| **Diageo** (Johnny Walker, Guinness) | Spirits importer | Track informal spirits distribution; counterfeit monitoring |
| **Heineken N.V.** | Beer company with African operations | Market entry intelligence for Cameroon; competitive landscape |
| **Castel Group** | Parent of SABC | Pan-African portfolio tracking; Cameroon market intelligence |
| **Pernod Ricard** | Spirits company | Informal spirits market sizing; distribution opportunity analysis |
| **WHO Cameroon** | Public health | Informal alcohol mapping for public health interventions; counterfeit monitoring |
| **Ministry of Public Health** | Government regulator | Enforcement targeting; informal vendor density mapping |

---

### 1.3 Census (Demographic Proxy)

| Dimension | Detail |
|---|---|
| **Primary Buyers** | Real estate developers, urban planning consultants, international development organizations |
| **Secondary Buyers** | Banks (branch planning), telecoms (network planning), FMCG companies (demand forecasting), insurance companies |
| **Data Product Needed** | Building count and occupancy, commercial density, population proxy indicators, construction activity tracking, neighborhood demographic profiles |
| **Price Sensitivity** | Medium for developers (high-value decisions). Low for development orgs (grant-funded). Variable for banks. |
| **Willingness to Pay** | Medium. No direct revenue link makes this a harder sell. Position as "decision support" worth CFA 3-8M/year per subscriber. |
| **Sales Cycle** | 6-12 weeks for developers, 3-6 months for international orgs |
| **Decision Maker** | Director of Development at real estate firm; Urban Planning Specialist at development org; Head of Strategy at bank |

**Specific Companies:**

| Company | Type | Why They'd Buy |
|---|---|---|
| **SIC (Societe Immobiliere du Cameroun)** | State-owned housing developer (234 ha in Douala) | Site selection intelligence; demand forecasting for 5,676 planned homes |
| **Diamond Realty** | Private real estate developer | Neighborhood growth tracking; investment prioritization |
| **ACCREG Ltd.** | Real estate/construction firm | Market demand validation for new projects in Douala |
| **Afriland First Bank** | Largest bank in Cameroon | Branch location optimization; mortgage market sizing by neighborhood |
| **Ecobank Cameroon** | Pan-African bank | ATM/branch network planning using population density proxies |
| **World Bank (Sustainable Cities Project)** | $200M urban infrastructure project in Douala | Baseline data for project monitoring; impact measurement |
| **UN-Habitat Cameroon** | Urban development agency | Urbanization tracking; informal settlement monitoring |
| **UNDP Cameroon** | Development agency | SDG monitoring; poverty mapping |

---

### 1.4 Fuel

| Dimension | Detail |
|---|---|
| **Primary Buyers** | Fuel distribution companies (network planning), logistics/transport companies (route optimization) |
| **Secondary Buyers** | Ride-hailing platforms, government regulators (CSPH), insurance companies |
| **Data Product Needed** | Station locations with operator branding, services offered, stock-out tracking, queue indicators, informal vendor presence, price compliance monitoring |
| **Price Sensitivity** | Low for fuel companies (high-margin business). Medium for logistics companies. |
| **Willingness to Pay** | Medium-High. Fuel companies will pay CFA 3-8M/year for competitive intelligence across Douala. Logistics companies will pay CFA 1-3M/year for real-time availability data. |
| **Sales Cycle** | 4-6 weeks for fuel companies, 2-4 weeks for logistics companies |
| **Decision Maker** | Director of Network Development at fuel company; Operations Manager at logistics company |

**Specific Companies:**

| Company | Type | Why They'd Buy |
|---|---|---|
| **TotalEnergies Cameroon** | Market leader (26% share) | Competitive tracking vs. Tradex/MRS; expansion site selection; service offering benchmarking |
| **Tradex SA** | State-owned (112 stations regionally) | Market intelligence as they expand; validate station performance vs. competitors |
| **OLA Energy (ex-OiLibya)** | International operator (8% share) | Growth planning; identify underserved areas for new stations |
| **MRS (Matrix Refinery & Supply)** | Second-largest marketer (18%) | Competitive positioning; stock-out monitoring at competitor stations |
| **Neptune Oil** | Smaller distributor | Market opportunity identification; competitive intelligence |
| **Africa Global Logistics (AGL)** | Major logistics operator (3,700 employees) | Fuel availability along transport corridors; route planning |
| **Yango Cameroon** | Ride-hailing platform | Fuel availability data for driver support; station mapping for in-app features |
| **CSPH (Price Stabilization Fund)** | Government regulator | Price compliance monitoring across stations |

---

### 1.5 Mobile Money

| Dimension | Detail |
|---|---|
| **Primary Buyers** | Mobile money operators (MTN, Orange, CAMTEL), fintech companies, banking regulators |
| **Secondary Buyers** | Banks, microfinance institutions, insurance companies, development organizations (financial inclusion) |
| **Data Product Needed** | Agent location map with operator, activity status, multi-operator indicators, service types (cash-in, cash-out, bill pay), agent density by zone, new agent openings/closures, float availability indicators |
| **Price Sensitivity** | Low for operators (massive revenue at stake). Medium for fintechs (well-funded but cost-conscious). |
| **Willingness to Pay** | Very High. MTN MoMo generated CFA 70.2B revenue in 2024. Orange Money generated CFA 65B. Agent network optimization worth CFA 10-30M/year to each operator. |
| **Sales Cycle** | 6-12 weeks for telcos (enterprise procurement), 2-4 weeks for fintechs |
| **Decision Maker** | Head of Mobile Money / Director of Mobile Financial Services at telco; CEO/COO at fintech; Country Director at development org |

**Specific Companies:**

| Company | Type | Why They'd Buy |
|---|---|---|
| **MTN Cameroon (MoMo)** | ~30% mobile money share, CFA 70.2B revenue | Agent network optimization; identify coverage gaps; competitive intelligence vs. Orange |
| **Orange Cameroon (Orange Money)** | ~70% share, CFA 65B revenue | Same needs; track MTN agent expansion; identify underserved zones |
| **CAMTEL (Blue Money)** | State-owned, entering market 2026 | Market entry planning; identify optimal agent locations; understand competitive landscape |
| **Wave** | Fintech, launched in Cameroon Aug 2025 | Competitive landscape; agent density analysis; market sizing |
| **Commercial Bank Cameroun** | Wave's banking partner | Agent banking expansion planning; digital financial inclusion mapping |
| **COBAC** | Banking regulator (CEMAC) | Agent compliance monitoring; licensing verification |
| **BEAC** | Central bank | Financial inclusion tracking; mobile money ecosystem monitoring |
| **CGAP / World Bank** | Financial inclusion research | Agent network data for financial access studies |
| **Bill & Melinda Gates Foundation** | Financial inclusion funder | Agent access mapping for program design and measurement |

---

### 1.6 Pharmacy

| Dimension | Detail |
|---|---|
| **Primary Buyers** | Pharmaceutical distributors, public health organizations, drug quality monitoring agencies |
| **Secondary Buyers** | Pharmaceutical manufacturers (Sanofi, Novartis, Roche), insurance companies, government health departments |
| **Data Product Needed** | Pharmacy locations (formal + informal), operating hours, on-duty rotation (pharmacie de garde), product category availability, informal vendor density, proximity to health facilities |
| **Price Sensitivity** | Medium for pharma distributors. Low for international public health orgs (grant-funded). |
| **Willingness to Pay** | Medium-High. Pharma companies will pay CFA 3-10M/year for distribution intelligence. Public health orgs will pay CFA 5-20M per project for informal drug market mapping. |
| **Sales Cycle** | 4-8 weeks for pharma distributors, 3-6 months for public health/NGO procurement |
| **Decision Maker** | Distribution Director at pharma company; Program Manager at public health org; DPML Director at government |

**Specific Companies:**

| Company | Type | Why They'd Buy |
|---|---|---|
| **CENAME** | National essential medicines supply | Distribution coverage verification; stock-out risk identification |
| **Sanofi Cameroon** | Multinational pharma (largest in Africa) | Distribution channel mapping; identify informal competitors selling counterfeit Sanofi products |
| **Novartis** | Multinational pharma | Access-to-medicine program targeting; pharmacy coverage gaps |
| **Roche** | Multinational pharma | Distribution network intelligence; market access planning |
| **DPML** | Drug regulatory authority | Enforcement targeting; informal drug market mapping |
| **LANACOME** | Drug quality control lab | Prioritize quality testing based on informal vendor density |
| **WHO Cameroon** | Public health | Counterfeit medicine mapping; access-to-medicine indicators |
| **UNICEF Supply Division** | Drug quality assurance | Quality assurance monitoring in distribution chain |
| **USAID Global Health Supply Chain** | Health supply chain program | Last-mile distribution data; pharmacy access mapping |
| **GIZ Cameroon** | German development agency | Health data for program design; pharmacy access monitoring |

---

### 1.7 Transport Roads

| Dimension | Detail |
|---|---|
| **Primary Buyers** | Logistics/transport companies, ride-hailing platforms, delivery companies |
| **Secondary Buyers** | Insurance companies, government agencies (Ministry of Public Works), construction companies, real estate developers |
| **Data Product Needed** | Road condition ratings, blockage alerts (flooding, construction, accidents), surface type, passability by vehicle type, traffic congestion indicators, construction progress tracking |
| **Price Sensitivity** | Low for logistics companies (road intelligence saves real money in fuel and time). Very low for ride-hailing platforms (core operational need). |
| **Willingness to Pay** | Very High. A single avoided truck reroute during rainy season saves CFA 50-200K. Logistics companies will pay CFA 5-15M/year. Ride-hailing platforms will pay CFA 10-30M/year for city-wide coverage. |
| **Sales Cycle** | 2-4 weeks for logistics companies (urgent operational need), 4-8 weeks for ride-hailing (product integration) |
| **Decision Maker** | Operations Director at logistics company; Country Manager at ride-hailing platform; Head of Routing/Maps at delivery company |

**Specific Companies:**

| Company | Type | Why They'd Buy |
|---|---|---|
| **Yango Cameroon** | Ride-hailing (Douala, Yaounde, Bafoussam) | Real-time road condition data for routing; avoid sending drivers into flooded roads; improve ETA accuracy |
| **Gozem Cameroon** | Ride-hailing + delivery | Same routing needs; delivery reliability in rainy season |
| **Africa Global Logistics (AGL)** | Logistics (3,700 employees in Cameroon) | Route optimization; cargo safety; avoid road blockages |
| **GEODIS Cameroon** | International logistics | Road condition intelligence for freight routing; customs corridor planning |
| **DSV Cameroon** | International logistics | Same freight routing needs |
| **Randy Logistics** | Local freight forwarder | Cost savings from avoided delays on blocked roads |
| **World Bank (Douala Urban Mobility Project)** | $543M BRT project, construction starting 2026 | Construction zone tracking; traffic impact monitoring; project accountability |
| **Ridev** (local NGO) | Community development for BRT project | Community impact data; road access monitoring during construction |
| **Ministry of Public Works** | Road infrastructure authority | Road condition monitoring; maintenance prioritization |
| **Douala City Council (CUD)** | Municipal government | Emergency response routing; flood zone mapping; urban planning |

---

## 2. Use Case Prioritization

### Scoring Methodology

Each use case is scored on 5 dimensions (1-5 scale each, 5 is best):

| Criterion | Weight | 5 = Best | 1 = Worst |
|---|---|---|---|
| Revenue Potential | 25% | >CFA 20M/year | <CFA 2M/year |
| Time to First Sale | 25% | <4 weeks | >6 months |
| Data Collection Difficulty | 20% | Easy (fixed, visible, daytime) | Hard (mobile, informal, night-only) |
| Competitive Moat | 15% | No alternative exists | Multiple alternatives |
| Recurring Revenue Potential | 15% | Weekly subscription need | One-time purchase |

### Top 15 Use Cases -- Stack Ranked

| Rank | Use Case | Vertical | Primary Buyer | Rev Potential | Time to Sale | Collection Diff. | Comp. Moat | Recurring Rev | Weighted Score |
|---|---|---|---|---|---|---|---|---|---|
| **1** | Road blockage alerts (rainy season) | Transport | Logistics cos, ride-hailing | 5 | 5 | 4 | 5 | 5 | **4.80** |
| **2** | Mobile money agent location map | Mobile Money | MTN, Orange, Wave | 5 | 4 | 4 | 5 | 5 | **4.60** |
| **3** | Alcohol POS distribution intelligence | Alcohol | SABC, UCB, Diageo | 5 | 4 | 3 | 5 | 5 | **4.40** |
| **4** | Fuel station competitive intelligence | Fuel | TotalEnergies, Tradex | 4 | 5 | 5 | 4 | 4 | **4.40** |
| **5** | Billboard occupancy & competitive monitoring | Billboards | Acmar Media, JC Decaux | 4 | 5 | 5 | 4 | 4 | **4.40** |
| **6** | Mobile money agent churn tracking | Mobile Money | MTN, Orange | 5 | 3 | 4 | 5 | 5 | **4.40** |
| **7** | Informal drug vendor mapping | Pharmacy | WHO, DPML, Sanofi | 4 | 3 | 3 | 5 | 4 | **3.80** |
| **8** | Road condition deterioration tracking | Transport | Ministry Public Works, CUD | 4 | 4 | 4 | 4 | 3 | **3.80** |
| **9** | Brand share-of-voice (OOH advertising) | Billboards | MTN, Orange, SABC marketing | 4 | 4 | 5 | 4 | 3 | **3.95** |
| **10** | Alcohol outlet opening/closure tracking | Alcohol | SABC trade marketing | 4 | 3 | 3 | 5 | 4 | **3.75** |
| **11** | Pharmacy-on-duty (pharmacie de garde) | Pharmacy | Consumers via API partners | 3 | 4 | 3 | 5 | 5 | **3.80** |
| **12** | Construction activity tracking (census proxy) | Census | SIC, Diamond Realty, banks | 3 | 3 | 4 | 4 | 4 | **3.50** |
| **13** | Fuel stock-out reporting | Fuel | Logistics, ride-hailing | 4 | 3 | 3 | 5 | 4 | **3.75** |
| **14** | Neighborhood population density proxy | Census | World Bank, UNDP, banks | 3 | 2 | 3 | 5 | 3 | **3.15** |
| **15** | Informal-to-formal ratio tracking (all verticals) | Cross-cutting | Government, development orgs | 3 | 2 | 3 | 5 | 4 | **3.30** |

### Key Takeaway

**The top 3 use cases to pursue first:**
1. **Road blockage alerts** -- Fastest path to revenue, highest urgency (rainy season starts June), clear ROI for logistics companies
2. **Mobile money agent mapping** -- Highest-value buyers (telcos with billions in revenue), massive data gap, strong recurring need
3. **Alcohol distribution intelligence** -- Largest addressable market ($4.9B), dominant buyer (SABC), informal sector mapping is unique

---

## 3. Delta-to-Value Conversion

Yannick Lefang's key insight: "You need consistent deltas to be able to sell." This section translates field observations into commercial value for each vertical.

---

### 3.1 Billboards

| Element | Detail |
|---|---|
| **Highest-Value Delta** | Billboard content change -- "Billboard X at Carrefour Bonamoussadi switched from MTN 5G campaign to Orange Money promo this week" |
| **Who Cares** | Advertising agencies (competitive intelligence), brand marketing teams (verify campaign execution), billboard operators (occupancy tracking) |
| **Why They Care** | Media agencies spend CFA 500M+ on OOH campaigns. Knowing what competitors are doing in real-time lets them react within the campaign cycle. Brand managers need proof their agency actually placed the ads they paid for. |
| **Packaging** | **Monthly Billboard Market Report:** PDF/dashboard showing all billboard changes, new installations, removals, occupancy rates, advertiser category breakdown. **Real-time Alert Feed:** Push notifications when a specific competitor's billboard changes. |
| **Pricing Model** | Subscription: CFA 200K/month (Starter: Bonamoussadi only) to CFA 1.5M/month (Enterprise: all Douala). Per-report: CFA 500K for a one-time competitive audit. |
| **Delta Example** | "In February 2026, 4 of 12 billboards along Boulevard de la Republique switched from telecoms ads to banking ads. Afriland First Bank launched a new campaign occupying 3 previously vacant boards. Vacancy rate dropped from 25% to 8%." |

---

### 3.2 Alcohol

| Element | Detail |
|---|---|
| **Highest-Value Delta** | New point-of-sale openings/closures + brand availability shifts -- "15 new informal bars opened in Zone B of Bonamoussadi this quarter; 80% carry only SABC brands, 20% carry UCB" |
| **Who Cares** | SABC trade marketing (distribution coverage), UCB (white-space identification), Diageo/Pernod Ricard (spirits distribution), WHO (public health) |
| **Why They Care** | SABC needs to ensure its distribution network covers new outlets before UCB does. New outlet openings represent immediate sales opportunities. Closures signal economic distress in a micro-zone. Informal vendor density is a public health indicator. |
| **Packaging** | **Quarterly Distribution Intelligence Report:** Map + data table of all POS changes, brand distribution heatmap, informal-to-formal ratio by zone. **Monthly Alert Digest:** New outlet openings with GPS, brand availability, estimated volume category. **Annual Market Structure Report:** Full market mapping with year-over-year trend analysis. |
| **Pricing Model** | Subscription: CFA 500K/month (single zone) to CFA 3M/month (all Douala). One-time market study: CFA 5-10M. Enterprise API for integration into SABC's distribution management system: CFA 15-25M/year. |
| **Delta Example** | "Q1 2026: 23 new alcohol POS opened in Bonamoussadi (+18% from Q4 2025). 8 closed. Net growth of 15. UCB's Beaufort brand appeared in 12 outlets where it was previously absent, suggesting a new distribution push. Informal sachet spirits vendors increased 30% near the university area." |

---

### 3.3 Census (Demographic Proxy)

| Element | Detail |
|---|---|
| **Highest-Value Delta** | Building construction activity + commercial density change -- "12 new multi-story buildings under construction in Makepe sub-zone; 8 new businesses opened on the ground floor of recently completed buildings" |
| **Who Cares** | Real estate developers (demand validation), banks (branch/ATM planning), telecoms (network capacity planning), urban planners |
| **Why They Care** | SIC is planning 5,676 homes -- they need to know where demand is hottest. Banks need to position branches where population is growing. Cameroon's last census was 2005; any neighborhood-level data is 20+ years more current than official statistics. |
| **Packaging** | **Quarterly Neighborhood Profile Update:** Building count, occupancy indicators, commercial density, construction activity, demographic proxies. **Annual Neighborhood Census Report:** Comprehensive profile comparable to a mini-census. |
| **Pricing Model** | Subscription: CFA 300K/month per neighborhood. Annual report: CFA 3-5M. Custom analysis: CFA 2-5M per project. |
| **Delta Example** | "Bonamoussadi Zone A: 8 new buildings completed in Q1 2026 (vs. 3 in Q1 2025). Commercial ground-floor occupancy is 92%. Average building height increased from 2.1 to 2.4 stories, suggesting densification. Estimated population growth proxy: +12% year-over-year." |

---

### 3.4 Fuel

| Element | Detail |
|---|---|
| **Highest-Value Delta** | Stock-out events + new station openings + service diversification -- "Tradex Bonamoussadi experienced a 3-day stock-out this week; TotalEnergies station 2km away added a car wash and mobile money point" |
| **Who Cares** | Competing fuel companies (competitive intelligence), logistics companies (route planning), ride-hailing platforms (driver guidance), CSPH (regulatory monitoring) |
| **Why They Care** | Stock-outs at a competitor's station mean surge demand at yours -- time to increase float/supply. Service diversification signals market maturation. Informal fuel vendor density near stations signals supply constraints. Logistics companies lose CFA 50-200K per truck reroute due to stock-outs. |
| **Packaging** | **Weekly Fuel Market Pulse:** Station status updates, stock-out alerts, new service additions. **Monthly Competitive Report:** Full station inventory with services, condition, branding changes. **Real-time API feed:** Stock-out alerts for integration into fleet management systems. |
| **Pricing Model** | Subscription: CFA 200K/month (Bonamoussadi) to CFA 2M/month (all Douala). API access: CFA 5-10M/year for integration into logistics platforms. Per-alert: CFA 5-10K per stock-out alert (pay-per-use for smaller operators). |
| **Delta Example** | "Week of March 1-7, 2026: 2 of 7 stations in Bonamoussadi experienced stock-outs (Tradex, Neptune Oil). Duration: 1 day and 3 days respectively. MRS station at Carrefour Makepe added Orange Money agent inside station. Informal fuel vendor count increased from 3 to 6 near Tradex during stock-out." |

---

### 3.5 Mobile Money

| Element | Detail |
|---|---|
| **Highest-Value Delta** | Agent openings/closures + multi-operator shifts + density changes -- "MTN lost 8 agents in Zone A this month while Orange gained 5; 3 agents switched from MTN-only to dual-operator" |
| **Who Cares** | MTN MoMo (agent retention, network gaps), Orange Money (expansion planning), CAMTEL Blue Money (market entry), Wave (competitive landscape), COBAC/BEAC (regulatory oversight), financial inclusion orgs |
| **Why They Care** | Agent churn directly impacts transaction revenue. MTN MoMo generated CFA 70.2B in 2024; losing agents means losing revenue. Orange needs to know where MTN is weak to deploy resources. CAMTEL needs full market intelligence to plan its Blue Money launch. Wave needs to understand the competitive landscape after its August 2025 Cameroon entry. |
| **Packaging** | **Weekly Agent Network Dashboard:** Interactive map with agent status, operator, activity indicators, new/closed. **Monthly Agent Churn Report:** Detailed analysis of agent turnover, switching behavior, density trends. **Quarterly Financial Inclusion Report:** Agent access metrics aligned with CGAP/World Bank financial inclusion indicators. |
| **Pricing Model** | Enterprise subscription: CFA 2-5M/month per operator for real-time dashboard. API access: CFA 15-30M/year for integration into operator back-office systems. Financial inclusion report: CFA 5-10M per study (funded by development orgs). |
| **Delta Example** | "February 2026: Bonamoussadi agent count changed from 187 to 195 (+4.3%). MTN: 68 to 63 (-7.4%). Orange: 102 to 112 (+9.8%). Dual-operator: 17 to 20 (+17.6%). Highest churn zone: Makepe market area. Orange gaining agent share for 4th consecutive month. Wave launched 3 agents, all near university." |

---

### 3.6 Pharmacy

| Element | Detail |
|---|---|
| **Highest-Value Delta** | Informal vendor density changes + pharmacy openings/closures + stock-out patterns -- "Informal drug vendors near Marche de Bonamoussadi increased from 8 to 14 this month; formal Pharmacie Makepe reported 3-day stock-out of antimalarials" |
| **Who Cares** | DPML (enforcement targeting), WHO/UNICEF (public health), pharmaceutical companies (distribution gaps = informal market opportunity), insurance companies (healthcare access metrics) |
| **Why They Care** | 26.9% of medicines in Cameroon are substandard/falsified. CFA 8.6B in counterfeits seized 2020-2024. Every informal vendor represents both a public health risk and a market indicator: where formal supply fails, informal fills the gap. Pharma companies can direct legitimate distribution to areas with high informal density. |
| **Packaging** | **Monthly Pharmacy Access Report:** Formal pharmacy map + informal vendor density + stock-out indicators. **Quarterly Public Health Intelligence Report:** Designed for WHO/UNICEF procurement with financial inclusion and SDG indicators. **Pharmacie de Garde API:** Real-time on-duty pharmacy lookup for consumer apps and health platforms. |
| **Pricing Model** | Subscription: CFA 300K/month (single neighborhood) to CFA 2M/month (all Douala). Public health project: CFA 10-25M per study (donor-funded). Pharmacie de Garde API: CFA 100-200K/month for consumer app integration. |
| **Delta Example** | "March 2026: Informal drug vendor count in Bonamoussadi increased 75% (from 8 to 14) following CENAME supply chain disruption. Antimalarial stock-outs reported at 3 of 12 formal pharmacies. Informal vendors concentrated within 200m of Marche de Bonamoussadi. Two new propharmacies identified near Clinique Picardie." |

---

### 3.7 Transport Roads

| Element | Detail |
|---|---|
| **Highest-Value Delta** | Road blockage events + condition deterioration + construction progress -- "Rue de Makepe flooded and impassable for sedans after overnight rain; estimated clearance: 6 hours. Bypass via Boulevard de la Liberte adds 2.3km." |
| **Who Cares** | Logistics companies (route optimization), ride-hailing platforms (driver routing), delivery companies (ETA accuracy), municipal government (emergency response), insurance companies (flood risk mapping), World Bank (BRT project monitoring) |
| **Why They Care** | During rainy season (June-October), road blockages in Douala can cost logistics companies CFA 50-200K per truck per incident in delays, fuel waste, and cargo damage. Ride-hailing platforms lose revenue when drivers waste time on blocked roads. The World Bank's $543M Douala BRT project (construction starting 2026) needs real-time construction impact data. |
| **Packaging** | **Real-time Road Alert API:** Push notifications for blockages with GPS, severity, vehicle passability, estimated clearance time, bypass route. **Weekly Road Condition Dashboard:** All monitored road segments with condition ratings, change indicators, construction zones. **Rainy Season Flood Risk Map:** Historical flooding patterns by street/intersection for insurance and planning. |
| **Pricing Model** | Real-time API: CFA 3-5M/month per logistics company. Dashboard subscription: CFA 500K-1.5M/month. Flood risk report: CFA 2-5M one-time. Enterprise integration (ride-hailing): CFA 15-30M/year for city-wide coverage. |
| **Delta Example** | "June 15, 2026, 14:30: Flooding reported at 3 intersections in Bonamoussadi. Rue Makepe-Bonamoussadi junction: impassable for all vehicles (depth: ~40cm). Carrefour Bonamoussadi: passable for SUVs only. Route de Makepe: reduced to single lane. Estimated clearance: 4-8 hours post-rain. Alternative routes: Boulevard de la Republique (adding 1.8km, ~15 min)." |

---

## 4. Go-to-Market Strategy

### 4.1 Lead Vertical: Transport Roads

**Why roads first:**

1. **Timing alignment:** Rainy season starts June 2026. If ADL demonstrates road blockage tracking during April-May (dry season baseline), it can deliver immediate value when rains hit in June. The value proposition proves itself automatically.
2. **Fastest time to sale:** Logistics companies and ride-hailing platforms have an urgent, daily operational need. No budget approval committee needed -- the Operations Manager can sign off.
3. **Easiest data collection:** Roads are fixed, observable, public infrastructure. No privacy concerns. No informal/formal ambiguity. Field agents can assess conditions during regular daily routes.
4. **Highest competitive moat:** No real-time road condition system exists for Douala. Google Maps does not track flooding. Waze has minimal coverage. ADL would be the only source.
5. **Natural expansion:** Once logistics companies trust ADL's road data, cross-selling fuel station data (along the same routes) and mobile money agent locations is a natural extension.

### 4.2 First 10 Target Accounts to Approach

| Priority | Company | Vertical | Why First | Estimated Annual Value | Approach |
|---|---|---|---|---|---|
| 1 | **Yango Cameroon** | Transport Roads | Ride-hailing needs real-time road data; recently expanded to Bafoussam; has tech team to integrate API | CFA 15-25M/year | Warm intro via local tech ecosystem; offer free pilot for Bonamoussadi during rainy season |
| 2 | **Africa Global Logistics (AGL)** | Transport Roads + Fuel | 3,700 employees, major Douala port operator; road + fuel data saves operational costs | CFA 10-20M/year | Cold outreach to Douala Operations Director; lead with cost-savings ROI on truck rerouting |
| 3 | **SABC / Brasseries du Cameroun** | Alcohol | Dominant brewery; needs distribution intelligence; has budget; Douala HQ | CFA 15-25M/year | Warm intro through local business networks; lead with "map every bar in Bonamoussadi in 30 days" |
| 4 | **MTN Cameroon (MoMo division)** | Mobile Money | CFA 70.2B revenue; agent network optimization is critical; losing market share to Orange | CFA 20-35M/year | Target Head of Mobile Financial Services; offer competitive intelligence pilot |
| 5 | **Orange Cameroon (Orange Money)** | Mobile Money | CFA 65B revenue; wants to maintain market lead; needs agent expansion intelligence | CFA 20-35M/year | Approach separately from MTN; emphasize agent churn analytics |
| 6 | **TotalEnergies Cameroon** | Fuel | Market leader; needs competitive tracking; has enterprise data procurement process | CFA 8-15M/year | Cold outreach to Director of Network Development; lead with competitive station benchmarking |
| 7 | **Gozem Cameroon** | Transport Roads | Ride-hailing + delivery; needs routing data; also interested in fuel availability for moto-taxis | CFA 5-10M/year | Tech-forward company; approach via product/tech team; offer API integration pilot |
| 8 | **Acmar Media Group** | Billboards | Douala HQ; media buying agency; immediate use for billboard competitive intelligence | CFA 3-5M/year | Direct sales; offer free competitive audit of Bonamoussadi billboards as proof of concept |
| 9 | **World Bank (Douala Projects)** | Transport + Census | $200M Sustainable Cities + $543M BRT project; needs baseline and monitoring data | CFA 20-50M/project | Formal procurement; respond to RFPs; network through development community |
| 10 | **Tradex SA** | Fuel | State-owned, expanding regionally; needs competitive intelligence; Douala HQ | CFA 5-10M/year | Government connections; lead with market intelligence for regional expansion planning |

### 4.3 Outreach Strategy

**Tier 1 -- Warm Introductions (Weeks 1-4):**
- Leverage Yannick Lefang's network for introductions to Douala business community
- Attend Douala Chamber of Commerce events
- Connect through GICAM (Groupement Inter-Patronal du Cameroun -- Cameroon employers' association)
- Target: Yango, SABC, Acmar Media, local logistics companies

**Tier 2 -- Cold Outreach with Proof (Weeks 3-8):**
- Prepare a "Bonamoussadi Data Sample" -- a free, one-page snapshot of one vertical for the target company's neighborhood
- Email template: "We mapped every [billboard/bar/mobile money agent] in Bonamoussadi. Here's what we found about your competitors. Want the full picture?"
- Follow up with LinkedIn message + WhatsApp (Cameroon business communication prefers WhatsApp)
- Target: TotalEnergies, MTN, Orange, fuel/logistics companies

**Tier 3 -- Industry Events and Conferences (Months 2-6):**
- PROMOTE (Forum for the Promotion of SMEs in Cameroon)
- Douala Digital Week / tech meetups
- Mobile Money conferences (GSMA events)
- Pharmaceutical conferences (DPML events)
- Target: Development organizations, international companies, government agencies

**Tier 4 -- Development/NGO Procurement (Months 3-12):**
- Register as a vendor with World Bank, UNDP, WHO procurement systems
- Respond to relevant RFPs for data collection and monitoring
- Build relationships with development consultants who specify data providers
- Target: World Bank projects, UNDP, WHO, GIZ, USAID

### 4.4 Proof of Concept Offering

**"Bonamoussadi in 30 Days" -- Free Pilot Program:**

- **What:** Complete mapping of one vertical in Bonamoussadi (prospect's choice), delivered as a one-time report with:
  - Full geolocated inventory of all POIs in the vertical
  - Photo evidence for each POI
  - Competitive analysis (for relevant verticals)
  - One month of delta tracking (what changed in 30 days)
  - Confidence scores for each data point
- **Cost to ADL:** Field agent labor (~CFA 150-300K) + infrastructure (~CFA 20K)
- **Conversion mechanism:** End the pilot with a meeting showing the prospect what changed in 30 days. The delta report is the sales pitch: "This is what changed while you weren't watching. Want to keep watching?"
- **Conversion target:** 40-50% of pilots convert to paid subscription within 60 days
- **Cap:** Maximum 5 concurrent free pilots in first 3 months

### 4.5 Pricing Tiers

| Tier | Name | Monthly Price (CFA) | Monthly Price (USD ~) | What's Included | Target Customer |
|---|---|---|---|---|---|
| **Starter** | Quartier Watch | 200,000 - 500,000 | $325 - $810 | 1 vertical, 1 neighborhood, monthly PDF report, basic dashboard access | Local businesses, small agencies |
| **Professional** | Douala Pulse | 1,000,000 - 3,000,000 | $1,625 - $4,875 | 2-3 verticals, up to 3 neighborhoods, weekly reports, dashboard + export, email alerts for key changes | Mid-size companies, regional offices |
| **Enterprise** | Full Spectrum | 5,000,000 - 15,000,000 | $8,125 - $24,375 | All verticals, city-wide coverage, real-time API access, custom dashboards, dedicated account manager, SLA guarantee, raw data export | Telecoms, breweries, logistics companies, development orgs |
| **Project** | Custom Study | 5,000,000 - 50,000,000 | $8,125 - $81,250 | One-time comprehensive study, custom scope, full methodology documentation, presentation to stakeholders | World Bank, UNDP, WHO, government |

**Annual commitment discount:** 20% discount for annual prepayment (reduces churn, improves cash flow predictability).

**Important:** These prices are calibrated for the Cameroon market. "Africans are very transactional" -- every price point must be justified by demonstrated value. Start with the lower end and raise prices as demand is validated.

### 4.6 Partnership Strategy

| Partner Type | Target Partners | What ADL Gets | What Partner Gets |
|---|---|---|---|
| **Distribution** | Yango, Gozem (ride-hailing apps) | Access to their driver network as supplementary data collectors; in-app distribution of road data | Better routing data; potential revenue share on data products |
| **Channel** | Acmar Media, local consultancies | Sales channel to their advertising clients | Data-enhanced service offering for their clients |
| **Data** | OpenStreetMap Cameroon community | Volunteer mapping contributions for baselines | Verified ground-truth data to improve OSM quality |
| **Credibility** | World Bank, UNDP, GIZ | Institutional validation; access to project budgets | Reliable local data for project monitoring |
| **Technology** | Wave, fintech companies | API integration revenue; technical validation | Agent network data for financial inclusion metrics |
| **Academic** | University of Douala | Research interns as data quality auditors; publications for credibility | Access to unique dataset for urban studies research |

---

## 5. Competitive Positioning

### 5.1 vs. Kasi Insight

| Dimension | Kasi Insight | ADL | ADL Advantage |
|---|---|---|---|
| **Method** | Macro surveys (12,000+ monthly interviews across 20+ countries) | Ground-truth field collection with photo evidence, GPS, and confidence scoring | Kasi asks people what they think; ADL shows what actually exists on the ground |
| **Granularity** | Country-level and city-level consumer insights | Neighborhood-level and street-level POI data | ADL can tell you "there are 14 informal drug vendors within 200m of Marche de Bonamoussadi" -- Kasi cannot |
| **Update Frequency** | Monthly/quarterly surveys | Weekly snapshots with delta computation | ADL detects changes within days; Kasi within months |
| **Coverage** | 20+ African economies | Initially Douala only (expanding) | Kasi is broad but shallow; ADL is narrow but deep |
| **Informal Sector** | Surveys may reach informal actors but captures opinions, not locations | Maps the physical presence and location of every informal business | ADL is the only source for geolocated informal sector data |
| **Pricing** | Enterprise pricing (estimated $20K-100K/year) | Accessible tiers starting at CFA 200K/month (~$325) | ADL is more accessible for local and regional companies |

**Positioning statement vs. Kasi:** "Kasi Insight tells you what African consumers think. ADL shows you what exists on the ground. We're complementary, not competitive -- but if you need to know where to distribute your product, you need a map, not a survey."

### 5.2 vs. Nielsen / Kantar

| Dimension | Nielsen / Kantar | ADL | ADL Advantage |
|---|---|---|---|
| **Method** | Panel-based retail audits, household surveys, media measurement | Continuous field collection with verified ground truth | Nielsen/Kantar visit a panel sample; ADL aims for census-level coverage |
| **Cost** | $50K-500K+ per study; enterprise subscriptions $100K+/year | Starting at CFA 200K/month (~$325/month) | 10-100x cheaper for comparable geographic coverage |
| **Frequency** | Monthly or quarterly retail audits | Weekly snapshots | 4-12x more frequent |
| **Informal Sector** | Largely excluded from panels (hard to recruit, high churn) | Core focus -- maps both formal and informal | ADL captures the 30-50% of economy that Nielsen/Kantar miss |
| **Cameroon Coverage** | Limited; Cameroon is a small market for global firms | Cameroon-first, ground-up | Nielsen/Kantar's Africa efforts focus on Nigeria, Kenya, South Africa; Cameroon is underserved |
| **Local Knowledge** | Remote/outsourced field teams | Local field agents with community knowledge | Better contextual understanding, better access to informal sector |

**Positioning statement vs. Nielsen/Kantar:** "Nielsen and Kantar give you a quarterly sample of the formal economy for $100K. ADL gives you a weekly census of the entire economy -- formal and informal -- for a fraction of the cost. And we're actually on the ground in Douala."

### 5.3 vs. Satellite Data Providers (Planet, Maxar, Digital Earth Africa)

| Dimension | Satellite Data | ADL | ADL Advantage |
|---|---|---|---|
| **Resolution** | Building footprints, land use classification | Business name, operator, brand, product availability, operating hours, condition | Satellites can see a building; ADL can tell you it's a pharmacy that's out of antimalarials |
| **Ground Truth** | None -- infers from imagery patterns | Primary ground-truth data with photo evidence | Satellite data requires ground truth for validation -- ADL IS the ground truth |
| **Informal Sector** | Cannot detect (no visible signature from space) | Explicitly maps informal businesses | A market stall selling counterfeit drugs looks like any other stall from space |
| **Change Detection** | Land use change (monthly/quarterly revisit) | Business-level change (weekly) | Satellite detects "new building" but not "building is now a bar serving UCB beer" |
| **Cost** | $5K-50K for custom imagery; $20K-100K for analytics | Starting at CFA 200K/month | Comparable or cheaper for neighborhood-level business intelligence |

**Positioning statement vs. satellites:** "Satellite data tells you what the world looks like from 600km up. ADL tells you what it looks like from the street. We're the ground truth that makes satellite data meaningful."

### 5.4 vs. Government Statistics (INS, BUCREP)

| Dimension | Government Statistics | ADL | ADL Advantage |
|---|---|---|---|
| **Currency** | Last census: 2005 (21 years old) | Weekly updates | ADL data is 21 years more current |
| **Granularity** | Regional/departmental aggregates | Street-level, GPS-located POIs | ADL provides data at 1000x higher resolution |
| **Informal Sector** | Estimated at 30-50% of GDP but not measured | Directly mapped and tracked | Government statistics acknowledge the gap; ADL fills it |
| **Accessibility** | Paper reports, limited digital access | API, dashboard, exportable data | ADL data is machine-readable and integrable |
| **Reliability** | Political sensitivity affects data | Independent, verified with confidence scoring | ADL has no political incentive to distort data |
| **Cost** | Free (but unusable for business decisions) | Paid subscription | Government data is free but worthless for operational decisions; ADL data has a clear price-to-value relationship |

**Positioning statement vs. government data:** "The government's census data is from 2005. Douala has more than doubled since then. Every business decision based on that data is a guess. ADL gives you this week's reality, verified with photo evidence and GPS coordinates."

### 5.5 ADL's Unique Value Proposition (One-Liner per Vertical)

| Vertical | One-Liner Value Proposition |
|---|---|
| **Billboards** | "Know what every billboard in Douala shows, who owns it, and when it changes -- before your competitor does." |
| **Alcohol** | "Map every bar, formal and informal, and know which brands they carry -- the distribution intelligence SABC can't get from their own system." |
| **Census** | "Neighborhood-level population and business data that's 21 years newer than the last government census." |
| **Fuel** | "Real-time fuel availability and station intelligence so your trucks never waste time at an empty pump." |
| **Mobile Money** | "A live map of every mobile money agent -- who's open, who's closed, and who switched operators -- updated weekly." |
| **Pharmacy** | "The only map of both formal pharmacies and informal drug vendors in Douala, with stock-out tracking and on-duty pharmacy schedules." |
| **Transport Roads** | "Real-time road blockage alerts during rainy season, so your drivers take the fastest safe route -- not the flooded one." |

---

## 6. Priority Contact List

### 6.1 Transport Roads Vertical

| Company | Type | Why They'd Buy | Est. Annual Budget | Contact Approach |
|---|---|---|---|---|
| **Yango Cameroon** | Ride-hailing | Real-time routing improvement; ETA accuracy; driver safety during floods | CFA 15-25M | Warm intro via Douala tech community; WhatsApp to Country Manager |
| **Africa Global Logistics (AGL)** | International logistics | Truck routing; avoid blockages; reduce fuel waste from detours | CFA 10-20M | Cold email to Douala Operations Director; ROI-focused pitch |
| **Gozem Cameroon** | Ride-hailing + delivery | Moto-taxi routing; delivery ETA accuracy; food delivery reliability | CFA 5-10M | Tech-forward approach; API integration pitch |
| **GEODIS Cameroon** | International logistics | Freight corridor monitoring; customs route planning | CFA 5-10M | Formal B2B outreach; request meeting through LinkedIn |
| **DSV Cameroon** | International logistics | Same freight routing needs | CFA 5-8M | Cold email to Branch Manager |
| **Randy Logistics** | Local freight forwarder | Cost savings on local deliveries; avoid delays | CFA 2-5M | Direct local outreach; phone call + WhatsApp |
| **World Bank (BRT Project)** | Development | BRT construction monitoring; traffic impact data; project accountability | CFA 20-50M/project | Formal vendor registration; respond to RFPs |
| **Ridev NGO** | Community development | Community impact assessment for BRT | CFA 3-5M/project | Direct approach; community partnership offer |
| **Douala City Council (CUD)** | Municipal government | Emergency response; flood zone mapping; urban planning | CFA 5-15M | Government relations; present at council meetings |
| **Ministry of Public Works** | National government | Road maintenance prioritization; infrastructure monitoring | CFA 10-20M | Government procurement process; ministry engagement |

### 6.2 Mobile Money Vertical

| Company | Type | Why They'd Buy | Est. Annual Budget | Contact Approach |
|---|---|---|---|---|
| **MTN Cameroon (MoMo)** | Mobile money operator | Agent network optimization; competitive intelligence vs. Orange | CFA 20-35M | Target Head of Mobile Financial Services; enterprise sales process |
| **Orange Cameroon** | Mobile money operator | Agent expansion intelligence; churn tracking; market leadership defense | CFA 20-35M | Target Director of Orange Money; enterprise sales process |
| **CAMTEL (Blue Money)** | Entering mobile money 2026 | Market entry planning; agent location strategy; competitive landscape | CFA 10-20M | Government connections; position as essential market entry data |
| **Wave Cameroon** | Fintech, launched Aug 2025 | Competitive intelligence; agent density analysis; market sizing | CFA 5-15M | Tech startup approach; direct CEO/CTO outreach |
| **Commercial Bank Cameroun** | Bank, Wave partner | Agent banking planning; financial access mapping | CFA 3-5M | Bank business development contact |
| **COBAC** | Banking regulator | Agent compliance monitoring; licensing verification | CFA 5-10M | Regulatory engagement; compliance tool pitch |
| **BEAC** | Central bank | Financial inclusion tracking; ecosystem monitoring | CFA 5-10M | Institutional engagement; data for policy |
| **CGAP / World Bank** | Financial inclusion research | Agent network data for access studies | CFA 10-20M/project | Development procurement; research partnership |
| **Bill & Melinda Gates Foundation** | Financial inclusion funder | Agent access mapping for program design | CFA 15-30M/project | Formal grant/procurement; through CGAP network |
| **Afriland First Bank** | Largest bank in Cameroon | Agent banking competition analysis; branch vs. agent strategy | CFA 3-8M | Bank innovation/digital team outreach |

### 6.3 Alcohol Vertical

| Company | Type | Why They'd Buy | Est. Annual Budget | Contact Approach |
|---|---|---|---|---|
| **SABC / Brasseries du Cameroun** | Dominant brewery (75%+ market) | Distribution coverage verification; competitive intelligence; informal market sizing | CFA 15-25M | Warm intro; target Head of Trade Marketing; Douala HQ |
| **Union Camerounaise de Brasseries (UCB)** | Second brewery | White-space identification; distribution expansion planning | CFA 8-15M | Cold outreach to Sales Director; "find where SABC is weak" pitch |
| **Diageo (Cameroon)** | Spirits company | Informal spirits tracking; counterfeit monitoring; distribution gaps | CFA 5-10M | Regional office approach; London/Nairobi connection may be needed |
| **Castel Group** | Parent of SABC | Pan-African portfolio tracking; Cameroon deep-dive | CFA 10-20M | Paris HQ connection; data for African operations review |
| **Pernod Ricard** | Spirits company | Market sizing; informal distribution mapping; counterfeit tracking | CFA 5-10M | Regional/global approach; data procurement team |
| **Heineken N.V.** | Beer company | Cameroon market entry intelligence; competitive analysis | CFA 5-10M | Amsterdam/regional office; market entry study pitch |
| **WHO Cameroon** | Public health | Informal alcohol mapping for interventions | CFA 5-15M/project | Formal UN procurement; health data partnership |
| **Ministry of Public Health** | Government | Enforcement targeting; informal vendor mapping | CFA 3-8M | Government engagement; public health pitch |

### 6.4 Fuel Vertical

| Company | Type | Why They'd Buy | Est. Annual Budget | Contact Approach |
|---|---|---|---|---|
| **TotalEnergies Cameroon** | Market leader (26% share) | Competitive tracking; expansion planning; service benchmarking | CFA 8-15M | Enterprise outreach; Director of Network Development |
| **Tradex SA** | State-owned, expanding | Market intelligence for regional expansion; competitive analysis | CFA 5-10M | Government connections; Douala HQ direct outreach |
| **OLA Energy (ex-OiLibya)** | International operator (8%) | Growth planning; underserved area identification | CFA 5-8M | Regional office outreach |
| **MRS** | Second-largest (18%) | Competitive positioning; stock-out monitoring | CFA 5-8M | Direct B2B outreach |
| **Neptune Oil** | Smaller distributor | Market opportunity identification | CFA 2-5M | Local outreach; phone + WhatsApp |
| **CSPH** | Government regulator | Price compliance monitoring | CFA 5-10M | Government procurement; compliance tool pitch |
| **SONARA** | National refinery | Distribution monitoring; supply chain intelligence | CFA 3-5M | State enterprise engagement |

### 6.5 Billboards Vertical

| Company | Type | Why They'd Buy | Est. Annual Budget | Contact Approach |
|---|---|---|---|---|
| **Acmar Media Group** | Billboard operator, media agency | Competitive intelligence; market monitoring; client reporting | CFA 3-5M | Direct sales; Douala HQ; free competitive audit offer |
| **JC Decaux Cameroun** | International billboard operator | Market share tracking; unauthorized competitor identification | CFA 3-5M | Paris/regional office + local contact |
| **Alliance Media Cameroon** | Billboard operator (airport + urban) | Occupancy tracking; competitive intelligence | CFA 3-5M | Direct outreach via their Cameroon office |
| **McCann Douala** | Global ad agency | OOH campaign verification; client reporting | CFA 2-3M | Agency pitch; campaign measurement tool |
| **MTN Cameroon (marketing)** | Major OOH advertiser | Campaign verification; competitive share-of-voice tracking | CFA 3-5M | Marketing department; media buying team |
| **Orange Cameroon (marketing)** | Major OOH advertiser | Same competitive intelligence needs | CFA 3-5M | Marketing department; media buying team |
| **SABC (marketing)** | Major OOH advertiser | Brand visibility monitoring; campaign verification | CFA 2-4M | Marketing department; through trade marketing relationship |

### 6.6 Pharmacy Vertical

| Company | Type | Why They'd Buy | Est. Annual Budget | Contact Approach |
|---|---|---|---|---|
| **Sanofi Cameroon** | Multinational pharma | Distribution mapping; counterfeit product tracking | CFA 5-10M | Regional Africa team; distribution integrity pitch |
| **Novartis** | Multinational pharma | Access-to-medicine program targeting | CFA 5-10M | Access-to-medicine team; CSR/impact department |
| **CENAME** | National drug supply agency | Distribution coverage verification; stock-out identification | CFA 3-8M | Government procurement; Ministry of Health liaison |
| **DPML** | Drug regulatory authority | Enforcement targeting; informal market intelligence | CFA 3-5M | Regulatory engagement; public health argument |
| **WHO Cameroon** | Public health | Counterfeit medicine mapping; pharmacy access metrics | CFA 10-20M/project | UN procurement; health data partnership |
| **USAID Global Health Supply Chain** | Health supply chain | Last-mile distribution data; pharmacy access | CFA 10-15M/project | USAID procurement; through implementing partners |
| **GIZ Cameroon** | Development agency | Health data for program design | CFA 5-10M/project | German development procurement; direct engagement |
| **SanlamAllianz Cameroun** | Insurance (18.7% market share) | Healthcare access metrics for insurance product design | CFA 3-5M | Insurance innovation team; health product development |

### 6.7 Census Vertical

| Company | Type | Why They'd Buy | Est. Annual Budget | Contact Approach |
|---|---|---|---|---|
| **World Bank (Sustainable Cities)** | $200M project | Baseline urban data; impact monitoring | CFA 20-50M/project | Formal procurement; World Bank consultant networks |
| **SIC** | State housing developer | Demand forecasting; site selection | CFA 5-10M | Government connections; direct pitch to Director |
| **Diamond Realty** | Private developer | Market intelligence; investment prioritization | CFA 2-5M | Local business network; direct outreach |
| **UNDP Cameroon** | Development agency | SDG monitoring; poverty mapping | CFA 5-15M/project | UN procurement |
| **UN-Habitat Cameroon** | Urban development | Urbanization tracking; planning support | CFA 5-10M/project | UN procurement; technical partnership |
| **Afriland First Bank** | Largest bank | Branch planning; mortgage market sizing | CFA 3-5M | Bank strategy/digital team |
| **MTN Cameroon (network planning)** | Telecom | Cell tower placement; network capacity planning | CFA 3-8M | Network planning department |
| **Orange Cameroon (network planning)** | Telecom | Same network planning needs | CFA 3-8M | Network planning department |

---

## 7. 80/20 Analysis

### 7.1 Which Verticals Generate Disproportionate Value

**The top 20% of effort that produces 80% of commercial value:**

| Rank | Vertical | % of Data Collection Effort | % of Estimated Revenue | Revenue/Effort Ratio | Verdict |
|---|---|---|---|---|---|
| 1 | **Mobile Money** | 15% (visible, daytime, fixed signage) | 30% (telcos have massive budgets) | **2.0x** | **Highest ROI** |
| 2 | **Transport Roads** | 10% (observable, public, during regular routes) | 25% (logistics, ride-hailing, development) | **2.5x** | **Highest ROI** |
| 3 | **Fuel** | 5% (few stations, easy to visit) | 10% (fuel companies + logistics cross-sell) | **2.0x** | **High ROI** |
| 4 | **Alcohol** | 25% (high informal density, night operations, difficult classification) | 20% (breweries have budget but collection is hard) | **0.8x** | **Medium ROI** |
| 5 | **Billboards** | 10% (fixed, visible, daytime) | 8% (smaller market, niche buyers) | **0.8x** | **Medium ROI** |
| 6 | **Pharmacy** | 15% (informal vendors mobile, formal pharmacies easy) | 5% (pharma companies + public health projects) | **0.3x** | **Low ROI short-term, high project value** |
| 7 | **Census** | 20% (requires systematic building-by-building coverage) | 2% (slow-burn, hard to monetize quickly) | **0.1x** | **Strategic long-term value** |

**Conclusion:** Focus 30% of collection resources on Mobile Money + Transport Roads to capture 55% of estimated revenue. Add Fuel (5% effort) for 65% total. These three verticals are the 80/20 sweet spot.

### 7.2 Which Data Fields Within Each Vertical Matter Most

**The specific data points that buyers actually pay for (vs. "nice to have"):**

#### Transport Roads -- Top Data Fields
| Data Field | Who Pays For It | Why It's High-Value | Priority |
|---|---|---|---|
| **Blockage status** (blocked/partial/clear) | Logistics, ride-hailing | Immediate operational impact | Must-have |
| **Vehicle passability** (sedan/SUV/truck/moto) | Logistics, ride-hailing | Determines which vehicles can use the route | Must-have |
| **Estimated clearance time** | Logistics | Route planning decision | Must-have |
| **Bypass route recommendation** | Ride-hailing, delivery | Direct routing value | High |
| Road surface type | Urban planners, developers | Planning value but not urgent | Nice-to-have |

#### Mobile Money -- Top Data Fields
| Data Field | Who Pays For It | Why It's High-Value | Priority |
|---|---|---|---|
| **Agent location (GPS)** | All mobile money buyers | Foundation of any analysis | Must-have |
| **Operator (MTN/Orange/both)** | Operators (competitive intel) | Competitive landscape | Must-have |
| **Activity status** (open/closed/inactive) | Operators | Network health monitoring | Must-have |
| **Services offered** (cash-in, cash-out, bill pay) | Operators, fintechs | Service coverage analysis | High |
| Float availability indicator | Operators | Liquidity management | High but hard to collect |

#### Alcohol -- Top Data Fields
| Data Field | Who Pays For It | Why It's High-Value | Priority |
|---|---|---|---|
| **POS location (GPS)** | Breweries, distributors | Distribution coverage map | Must-have |
| **Brands available** | Breweries (competitive intel) | Market share by location | Must-have |
| **Formal/informal classification** | Breweries, regulators, public health | Market structure analysis | Must-have |
| **Operating hours** | Breweries (distribution timing) | Distribution planning | High |
| Price points | Breweries, regulators | Market dynamics | Nice-to-have |

#### Fuel -- Top Data Fields
| Data Field | Who Pays For It | Why It's High-Value | Priority |
|---|---|---|---|
| **Station location (GPS)** | All fuel buyers | Foundation | Must-have |
| **Operator/brand** | Fuel companies | Competitive landscape | Must-have |
| **Availability status** (stock-out indicator) | Logistics, ride-hailing | Immediate operational value | Must-have |
| **Services offered** | Fuel companies | Competitive benchmarking | High |
| Informal vendor presence nearby | Regulators, fuel companies | Supply constraint indicator | Nice-to-have |

#### Billboards -- Top Data Fields
| Data Field | Who Pays For It | Why It's High-Value | Priority |
|---|---|---|---|
| **Location (GPS)** | Agencies, operators | Foundation | Must-have |
| **Advertiser/brand displayed** | Agencies, brand marketers | Competitive intelligence | Must-have |
| **Occupancy status** (booked/vacant) | Operators | Revenue optimization | Must-have |
| **Format/size** | Agencies | Media planning | High |
| Condition (damage, obstruction) | Operators | Maintenance planning | Nice-to-have |

#### Pharmacy -- Top Data Fields
| Data Field | Who Pays For It | Why It's High-Value | Priority |
|---|---|---|---|
| **Location (GPS)** | All pharmacy buyers | Foundation | Must-have |
| **Formal/informal classification** | Regulators, public health | Enforcement and health policy | Must-have |
| **Operating status** (open/closed) | Consumers, insurers | Access metrics | Must-have |
| **On-duty rotation (pharmacie de garde)** | Consumer apps, insurers | Night/weekend access | High |
| Product categories available | Pharma companies | Distribution intelligence | Nice-to-have |

#### Census Proxy -- Top Data Fields
| Data Field | Who Pays For It | Why It's High-Value | Priority |
|---|---|---|---|
| **Building count** | Developers, banks, telcos | Population proxy | Must-have |
| **Construction activity** (new/in-progress/complete) | Developers | Growth indicator | Must-have |
| **Ground-floor commercial occupancy** | Developers, banks | Economic vitality proxy | High |
| **Building height (stories)** | Urban planners | Densification indicator | Nice-to-have |
| Residential/commercial classification | Urban planners, insurers | Zoning intelligence | Nice-to-have |

### 7.3 Highest-Value Delta Types (Across All Verticals)

| Rank | Delta Type | Verticals | Why It's Highest Value | Who Pays |
|---|---|---|---|---|
| **1** | **Blockage/disruption events** | Roads, Fuel (stock-outs) | Immediate operational impact; time-sensitive; saves real money per incident | Logistics, ride-hailing, fuel companies |
| **2** | **New entity openings** | Mobile Money, Alcohol, Pharmacy | Distribution expansion opportunity; competitive intelligence | Telcos, breweries, pharma |
| **3** | **Entity closures** | Mobile Money, Alcohol | Network health signal; competitive opportunity; market contraction indicator | Telcos, breweries |
| **4** | **Brand/operator switches** | Mobile Money, Billboards | Competitive intelligence; market share shift signal | Telcos, ad agencies |
| **5** | **Formal/informal ratio shifts** | Alcohol, Pharmacy | Regulatory environment signal; market maturation indicator | Regulators, public health, development orgs |
| **6** | **Density changes by zone** | All verticals | Neighborhood economic development signal; investment indicator | Banks, developers, telcos, government |

### 7.4 Where to Focus Limited Collection Resources for Maximum Commercial Return

**Priority Collection Schedule (First 6 Months):**

| Month | Primary Collection Focus | Secondary Focus | Why This Sequence |
|---|---|---|---|
| **Month 1 (April)** | Roads baseline (all road segments in Bonamoussadi) | Mobile Money agent mapping | Roads baseline must be complete before rainy season; mobile money is easy to collect simultaneously |
| **Month 2 (May)** | Mobile Money deep collection (activity status, services) | Fuel stations (complete inventory) | Deepen mobile money data for telco pitch; fuel is quick (only 5-10 stations) |
| **Month 3 (June)** | Roads ACTIVE MONITORING (rainy season begins!) | Alcohol POS mapping begins | Rainy season = highest-value data period for roads; start alcohol for SABC pitch |
| **Month 4 (July)** | Roads + Alcohol + Billboards | Continue mobile money updates | Multi-vertical data strengthens platform pitch; billboard data is quick to collect |
| **Month 5 (Aug)** | All verticals weekly updates | Pharmacy mapping begins | System is mature enough for all-vertical collection; pharmacy data for public health pitch |
| **Month 6 (Sep)** | All verticals + census proxy begins | Prepare first annual reports | Census proxy starts as enough baseline exists; annual reports demonstrate longitudinal value |

**Resource Allocation:**
- 40% of field agent time: Roads + Mobile Money (P0 verticals, highest ROI)
- 25% of field agent time: Alcohol + Fuel (P1 verticals, strong buyer interest)
- 20% of field agent time: Billboards + Pharmacy (P1-P2, valuable but slower sales cycle)
- 15% of field agent time: Census proxy (P2, strategic long-term value)

---

## Summary: The Commercial Thesis

ADL's commercial value is built on three pillars:

1. **Ground truth that nobody else has.** No competitor maps the informal economy at street level with verified, GPS-located, photo-evidenced data points. In a country where 30-50% of GDP is informal, this is an enormous gap.

2. **Consistent deltas that demonstrate change.** As Yannick Lefang said, "You need consistent deltas to be able to sell." Weekly snapshots with computed deltas turn static maps into dynamic intelligence. The delta is the product -- not the map.

3. **Immediately clear value for transactional buyers.** "Africans are very transactional." Every data product must answer: "If I buy this, what money do I save or make this week?" For logistics companies: "You avoid a CFA 200K truck reroute." For telcos: "You identify 15 agent gaps before your competitor fills them." For breweries: "You find 23 bars you're not selling to." The value must be concrete, immediate, and measurable.

**First revenue target:** CFA 5-10M/month by month 6 (2-3 paying customers at Professional tier). **12-month target:** CFA 20-40M/month (1-2 enterprise customers + 5-8 professional tier). **Path to CFA 100M+/month:** City-wide Douala coverage across all verticals, with enterprise contracts from telcos and development organizations.

---

## Sources

- [Alliance Media Cameroon](https://www.alliancemedia.com/cameroon/)
- [Sortlist -- Advertising Agencies in Douala](https://www.sortlist.com/advertising/douala-littoral-cm)
- [Cameroon Beer Market 2025-2030 -- StrategyHelix](https://strategyh.com/report/beer-market-in-cameroon/)
- [Boissons du Cameroun -- Wikipedia](https://en.wikipedia.org/wiki/Boissons_du_Cameroun)
- [AGL Transport and Logistics in Cameroon](https://www.aglgroup.com/en/transport-logistics-africa/cameroon/)
- [GEODIS in Cameroon](https://geodis.com/cm/en)
- [DSV in Cameroon](https://www.dsv.com/en/countries/africa/cameroon)
- [Cameroon Pharmaceutical Market -- Statista](https://www.statista.com/outlook/hmo/pharmaceuticals/cameroon)
- [Local Drug Makers Hold Only 5% -- Business in Cameroon](https://www.businessincameroon.com/public-management/0412-15445-local-drug-makers-hold-only-5-of-cameroon-s-pharmaceutical-market)
- [Orange Ends MTN's Long Hold -- The Africa Report](https://www.theafricareport.com/402382/orange-ends-mtns-long-hold-on-cameroons-mobile-market/)
- [CAMTEL Blue Money -- LaunchBase Africa](https://launchbaseafrica.com/2025/10/06/a-state-backed-telco-wants-to-dethrone-mtn-and-orange-cameroon-in-mobile-money-showdown/)
- [Cameroon Mobile Money Industry Tops CFA135.84bn -- Business in Cameroon](https://www.businessincameroon.com/finance/1012-15480-cameroon-s-mobile-money-industry-accelerates-topping-cfa135-84bn)
- [Wave Launches in Cameroon -- Fintech News Africa](https://fintechnews.africa/39497/fintech-cameroon/interest-in-fintech-picks-up-in-cameroon/)
- [Tradex SA 269M Liters in 2024 -- Business in Cameroon](https://www.businessincameroon.com/public-management/2109-15055-tradex-sa-reports-269m-liters-of-fuel-sold-in-2024-expands-into-local-food-at-stations)
- [TotalEnergies in Cameroon](https://totalenergies.com/cameroon)
- [Fuel Distribution Fierce Competition -- Cameroon Business Today](https://cameroonbusinesstoday.cm/articles/161/fr/fuel-distribution-fierce-competition)
- [World Bank Sustainable Cities Project -- Cameroon](https://www.worldbank.org/en/news/press-release/2025/05/30/new-project-boosts-infrastructure-and-land-services-in-cameroon)
- [Douala BRT $543M Project -- Business in Cameroon](https://www.businessincameroon.com/public-management/1209-15002-douala-launches-community-outreach-ahead-of-543m-brt-construction-in-2026)
- [UNDP Cameroon](https://www.undp.org/cameroon)
- [UN-Habitat Cameroon](https://unhabitat.org/cameroon)
- [SanlamAllianz Cameroon -- Business in Cameroon](https://www.businessincameroon.com/finance/1712-14392-sanlam-and-allianz-finalize-merger-to-form-sanlamallianz-in-cameroon)
- [Top Banks in Cameroon -- GBAF](https://www.globalbankingandfinance.com/list-of-banks-in-cameroon/)
- [SIC Housing Development -- Business in Cameroon](https://www.businessincameroon.com/public-management/0809-14980-sic-secures-234-hectares-in-douala-to-expand-housing-development)
- [Kasi Insight](https://www.kasiinsight.com/)
- [Kantar Africa Life 2025](https://www.kantar.com/campaigns/africa-life)
- [GeoPoll -- Mobile Surveys](https://www.geopoll.com/)
- [Yango Cameroon](https://yango.com/en_cm/)
- [Yango Expands to Bafoussam -- Cameroon Tribune](http://www.cameroon-tribune.cm/article.html/69481/fr.html/yango-expands-its-ride-hailing-service-bafoussam-enhancing-mobility-in-the-country.)
- [Poor-Quality Medicines in Cameroon -- PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8437161/)
- [WHO Cameroon -- Health Accounts](https://www.who.int/about/accountability/results/who-results-report-2020-mtr/country-story/2023/implementing-updated-health-accounts-to-reduce-financial-hardship-in-cameroon-s-healthcare-system)
- [USAID Global Health Supply Chain -- Cameroon](https://www.ghsupplychain.org/country-profile/cameroon)
- [Real Estate Investment in Cameroon 2025 -- ACCREG](https://accregltd.org/the-ultimate-guide-to-real-estate-investment-in-cameroon-2025-edition/)
- [Cameroon Real Estate Forecasts -- The Africanvestor](https://theafricanvestor.com/blogs/news/cameroon-real-estate-forecasts)
