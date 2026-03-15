# 01 — Vertical-by-Vertical Matrix

**What this document is:** A single-reference matrix covering all 7 ADL verticals with priority ranking, estimated POI counts, capture complexity, update cadence, and detailed breakdowns of data needs, actors, gaps, and delta methods for the Bonamoussadi pilot.

**How to use it:** Start with the Summary Table to understand relative priority and scope. Then drill into individual vertical tables when planning field protocols, building capture forms, or briefing agents.

---

## Summary Table

| Vertical | Priority | Est. POI Count (Bonamoussadi) | Capture Complexity | Update Frequency | Commercial Value |
|---|---|---|---|---|---|
| `transport_road` | **P0** | 50--80 road segments | Medium | Daily to real-time (rainy season) / Weekly (dry season) | Very High |
| `mobile_money` | **P0** | 100--200 agent points | Low | Weekly | Very High |
| `pharmacy` | **P1** | 30--55 (10--15 formal + 20--40 informal) | Medium | Monthly (formal) / Weekly (informal) | High |
| `fuel_station` | **P1** | 5--10 stations | Low | Weekly (stock/price) / Quarterly (openings) | High |
| `alcohol_outlet` | **P1** | 80--150 points of sale | High | Weekly | High |
| `billboard` | **P2** | 30--60 locations | Low | Monthly | Medium |
| `census_proxy` | **P2** | 560+ buildings/businesses | Medium | Monthly (buildings) / Quarterly (demographics) | High (long-term) |

**Total estimated POIs for pilot:** 855--1,115 points of interest across all verticals.

---

## Priority Definitions

| Level | Meaning | Launch Timing |
|---|---|---|
| **P0** | Launch in Week 1 of pilot. Highest real-time value, clearest commercial buyers. | Immediate |
| **P1** | Launch in Week 2--3. High value, strong buyer interest, moderate capture complexity. | Early pilot |
| **P2** | Launch in Week 3--4. Important for completeness and long-term asset building. | Mid-pilot |

---

## 1. transport_road

| Dimension | Detail |
|---|---|
| **Data Needed** | Road segment GPS coordinates, surface type (paved/unpaved/gravel/laterite), condition rating, blockage status (clear/partial/blocked), cause of blockage (flooding/construction/accident), vehicle passability (sedan/SUV/truck/moto), estimated clearance time, bypass route, photo evidence |
| **Actors** | Ministry of Public Works (national roads), Douala City Council (municipal), road contractors (often Chinese-funded), taxi and moto-taxi operators, bus and freight companies, traffic police, emergency services, ride-hailing (Yango, Gozem), World Bank ($543M BRT project, construction 2026) |
| **Products/Services** | Real-time road blockage alert API, weekly road condition dashboard, rainy season flood risk map, construction zone tracking, enterprise routing integration for logistics and ride-hailing |
| **Likely Problems** | Conditions change within hours during rainy season (Jun--Oct); GPS accuracy reduced in urban canyons; "blocked" is subjective (spectrum from impassable to difficult); seasonal bias in dry-season data; construction zones may lack signage |
| **Data Gaps** | No real-time road condition system for Douala; historical flooding patterns not digitized by street; traffic density data unavailable; blocked roads communicated only via social media; road surface not systematically mapped; construction locations not centrally tracked |
| **Delta Method** | Daily to real-time field reporting during rainy season; weekly during dry season. Track: blockage events, condition deterioration/improvement, new paving or rehabilitation, flooding recurrence by location, construction project progress |
| **Est. POI Count** | 50--80 road segments in Bonamoussadi |
| **Update Frequency** | Daily to real-time (rainy season, Jun--Oct) / Weekly (dry season, Nov--May) |

### Capture Checklist — transport_road

- [ ] Define road segment boundaries (intersection to intersection)
- [ ] Establish condition rating scale (1--5 with photo examples)
- [ ] Create blockage classification taxonomy (flooding / construction / accident / other)
- [ ] Set passability categories with vehicle type matrix
- [ ] Train agents on GPS track recording vs. point capture
- [ ] Plan rainy-season surge protocol (daily reporting cadence)

---

## 2. mobile_money

| Dimension | Detail |
|---|---|
| **Data Needed** | GPS location, operator (MTN MoMo / Orange Money / both / CAMTEL Blue Money), activity status (open/closed/inactive), services offered (cash-in, cash-out, bill pay, merchant), float availability indicator, agent branding, photo evidence |
| **Actors** | MTN Cameroon (MoMo, ~30% market share), Orange Cameroon (Orange Money, ~70%, CFA 800B monthly transactions), CAMTEL (entering 2026), COBAC (banking commission), BEAC (central bank), ANIF (financial intelligence), super-agents/master agents, individual kiosk agents, fintechs (Wave, launched Aug 2025), development orgs (CGAP, World Bank, Gates Foundation) |
| **Products/Services** | Weekly agent network dashboard (interactive map), monthly agent churn report, quarterly financial inclusion report, enterprise API for operator back-office integration |
| **Likely Problems** | Extreme agent turnover (open/close weekly); multi-operator agents complicate attribution; branded but inactive agents; float availability invisible without asking; KYC compliance weak (ID coverage <60%); agent-level fraud documented |
| **Data Gaps** | No public geolocated database of active agents; activity status unknown without field verification; float/liquidity untracked publicly; transaction density proprietary; commission structures opaque |
| **Delta Method** | Weekly field re-survey of all agent locations. Track: agent density changes by micro-zone, agent churn rate, multi-service vs. single-service agents, new merchant acceptance points |
| **Est. POI Count** | 100--200 agent points in Bonamoussadi |
| **Update Frequency** | Weekly |

### Capture Checklist — mobile_money

- [ ] Define agent status categories: active (transacting), branded-inactive, closed, new
- [ ] Create multi-operator attribution rules (MTN only / Orange only / both / CAMTEL)
- [ ] Design float availability proxy question for field agents
- [ ] Map agent clusters at major intersections (Carrefour Bonamoussadi etc.)
- [ ] Establish weekly re-survey route covering all known agent points

---

## 3. pharmacy

| Dimension | Detail |
|---|---|
| **Data Needed** | GPS location, name, formal/informal classification, operating hours, on-duty rotation (pharmacie de garde), product categories available, proximity to health facilities, license status, photo evidence |
| **Actors** | DPML (licensing), LANACOME (quality control), IGSPL (inspection), Pharmacists Council, CENAME (national essential medicines procurement), licensed wholesale distributors, formal community pharmacies, informal street/market vendors, prescribers (doctors, clinics, hospitals), international pharma (Sanofi, Novartis, Roche, WHO, UNICEF, USAID) |
| **Products/Services** | Monthly pharmacy access report, quarterly public health intelligence report, pharmacie de garde API for consumer apps, distribution intelligence for pharma companies |
| **Likely Problems** | Informal drug vendors are mobile and hard to classify; counterfeit medicines cannot be identified visually; temporary pharmacy closures without notice; night/duty rotation poorly communicated; discrepancy between licensed and actually operating |
| **Data Gaps** | No public geolocated directory of licensed pharmacies in Douala; informal vendor locations unmapped; real-time drug availability not tracked at retail; operating hours and on-duty schedules not digitized; retail drug pricing not monitored |
| **Delta Method** | Monthly formal pharmacy visits, weekly informal vendor surveys near markets. Track: informal vendor density changes, new pharmacy openings, stock-out frequency for essential medicines, pharmacy-to-population ratio |
| **Est. POI Count** | 30--55 total (10--15 formal pharmacies + 20--40 informal vendors) |
| **Update Frequency** | Monthly (formal) / Weekly (informal vendors) |

### Capture Checklist — pharmacy

- [ ] Obtain Pharmacists Council registry as baseline for formal pharmacies
- [ ] Define formal/informal classification criteria (green cross signage, license display, fixed vs. mobile)
- [ ] Identify market areas and transport hubs where informal vendors concentrate
- [ ] Design pharmacie de garde schedule capture (rotation calendar)
- [ ] Create essential medicines checklist for stock-out tracking (top 10 drugs)

---

## 4. fuel_station

| Dimension | Detail |
|---|---|
| **Data Needed** | GPS location, operator/brand, services offered (convenience store, car wash, mobile money, food), stock-out status, price compliance, informal vendor presence nearby, queue indicators, photo evidence |
| **Actors** | SONARA (national refinery, Limbe), SCDP (13 depots, distribution monopoly), CSPH (price stabilization), TotalEnergies (26% share), Tradex (state-owned), MRS (18%), OLA Energy (8%), Neptune Oil, ~28 smaller companies, informal black market fuel sellers, private vehicles, commercial transport, moto-taxis |
| **Products/Services** | Weekly fuel market pulse, monthly competitive report, real-time stock-out alert API, integration feed for fleet management systems |
| **Likely Problems** | Informal fuel sellers near formal stations create classification confusion; temporary closures without notification; multi-purpose stations complicate categorization; government subsidies mask true market dynamics |
| **Data Gaps** | No real-time fuel availability at station level; queue lengths untracked; informal sales volume unknown; station-level service inventory not centralized; fuel quality not monitored systematically |
| **Delta Method** | Weekly station visits. Track: stock-out events, new station construction, informal vendor density near stations, service diversification, price compliance with CSPH regulated prices |
| **Est. POI Count** | 5--10 stations in Bonamoussadi |
| **Update Frequency** | Weekly (stock/price checks) / Quarterly (structural changes) |

### Capture Checklist — fuel_station

- [ ] List all branded stations in Bonamoussadi with operator attribution
- [ ] Design service inventory form (fuel types, convenience, car wash, mobile money, food)
- [ ] Create stock-out detection protocol (visual cues, agent inquiry)
- [ ] Map informal fuel vendor locations (jerry can sellers near stations)
- [ ] Record CSPH regulated price for compliance comparison

---

## 5. alcohol_outlet

| Dimension | Detail |
|---|---|
| **Data Needed** | GPS location, business name, formal/informal classification, brands available, operating hours, price points, license status, photo evidence |
| **Actors** | SABC/Brasseries du Cameroun (dominant, 75%+ market), UCB, informal distillers, formal importers (wines, spirits), informal cross-border traders (Nigeria), SABC distribution network, independent wholesalers, licensed bars, restaurants, off-licences, street vendors, informal spots, Ministry of Commerce (licensing), Ministry of Public Health (quality), consumers (urban middle class for branded beer; lower income for artisanal brews, sachets) |
| **Products/Services** | Quarterly distribution intelligence report, monthly alert digest (openings/closures), annual market structure report, enterprise API for distribution management |
| **Likely Problems** | High informal turnover (unlicensed spots open/close rapidly); dual-purpose establishments (shops selling alcohol alongside other goods); under-reporting by operators; counterfeit/smuggled products indistinguishable at POS; night-only operations make daytime capture incomplete |
| **Data Gaps** | No geolocated POS database in Douala; informal sector volume estimated but unmeasured; product-level distribution data proprietary to SABC; quality/safety data at POS non-existent; operating hours undocumented |
| **Delta Method** | Weekly agent re-surveys of commercial corridors. Track: new establishment openings/closures, informal-to-formal ratio, brand distribution shifts, price point changes, density changes by micro-zone |
| **Est. POI Count** | 80--150 points of sale in Bonamoussadi |
| **Update Frequency** | Weekly |

### Capture Checklist — alcohol_outlet

- [ ] Define outlet type taxonomy: licensed bar, restaurant, off-licence, street vendor, informal spot, dual-purpose
- [ ] Plan evening/night capture sessions (many outlets operate primarily at night)
- [ ] Create brand availability checklist (top 10 brands by market share)
- [ ] Map commercial corridors for systematic re-survey routes
- [ ] Design dual-purpose establishment classification rule (primary vs. incidental alcohol sales)

---

## 6. billboard

| Dimension | Detail |
|---|---|
| **Data Needed** | GPS location, format/size, operator/owner, advertiser brand, content category, occupancy status (booked/vacant), condition, photo evidence, installation date |
| **Actors** | Ministry of Communication (licensing), Douala City Council (permits), Alliance Media, JC Decaux Cameroun, McCann Douala, Acmar Media, local operators, advertisers (MTN, Orange, SABC/Brasseries du Cameroun, banks, FMCG), media buying agencies (Sortlist-listed, Bamboo Agency), informal sign painters, poster distributors, small business owners |
| **Products/Services** | Monthly billboard market report (PDF/dashboard), real-time alert feed for content changes, one-time competitive audit, brand share-of-voice analytics |
| **Likely Problems** | Boundary ambiguity between formal billboards and large commercial signage; ownership attribution (many lack visible operator markings); seasonal damage during rainy season (Jun--Oct); periodic municipal crackdowns remove unauthorized boards in batches |
| **Data Gaps** | No centralized geolocated billboard inventory for Douala; informal signage completely unmapped; occupancy rates not public; no historical lifecycle data |
| **Delta Method** | Monthly field re-survey of all billboard locations. Track: new installations, vacancy rate changes, informal-to-formal ratio shifts, content category shifts |
| **Est. POI Count** | 30--60 billboard/signage locations in Bonamoussadi |
| **Update Frequency** | Monthly |

### Capture Checklist — billboard

- [ ] Define formal vs. informal signage classification boundary
- [ ] Create size/format taxonomy (large-format, street furniture, poster, informal)
- [ ] Design content category codebook (telecom, beer, banking, FMCG, political, other)
- [ ] Record occupancy status (booked with creative / vacant / damaged)
- [ ] Photograph each billboard face for content change detection

---

## 7. census_proxy

| Dimension | Detail |
|---|---|
| **Data Needed** | Building count, building height (stories), construction status (new/in-progress/complete), ground-floor commercial occupancy, residential/commercial classification, building condition, photo evidence |
| **Actors** | BUCREP (census authority, last census 2005), INS (statistical surveys), Ministry of Economy/Planning, Douala V Municipality, community chiefs (chefs de quartier), UNFPA, UNDP, World Bank, real estate developers (SIC, Diamond Realty), banks (Afriland, Ecobank), telecoms (network planning) |
| **Products/Services** | Quarterly neighborhood profile update, annual neighborhood census report, custom demographic analysis per project |
| **Likely Problems** | 21-year-old baseline (2005 census) makes all projections unreliable; rapid urbanization since 2005 (1.9M to 4.35M); informal residents and transient populations systematically missed; no address system in most of Douala; political sensitivity of census data |
| **Data Gaps** | No neighborhood-level population data less than 20 years old; zero building-level occupancy data; no demographic composition at neighborhood level; migration patterns untracked; no household income data at micro-zone level |
| **Delta Method** | Monthly building footprint surveys using field agents + satellite imagery comparison. Track: building construction/demolition (population proxy), occupancy rates, commercial establishment density (economic activity proxy), building height changes (densification indicator) |
| **Est. POI Count** | 560+ buildings and businesses in Bonamoussadi |
| **Update Frequency** | Monthly (building footprints) / Quarterly (demographic proxy indicators) |

### Capture Checklist — census_proxy

- [ ] Obtain satellite baseline imagery for Bonamoussadi (pre-pilot snapshot)
- [ ] Define building classification rules: residential, commercial, mixed-use, under-construction, vacant
- [ ] Design block-by-block systematic coverage plan (avoid gaps)
- [ ] Create building height estimation guide (count stories from photo)
- [ ] Establish ground-floor commercial occupancy recording method
- [ ] Coordinate with chefs de quartier for local population knowledge

---

## Sources

- `research/10-FINAL-STRATEGY-synthesis.md` — Sections 1 (Vertical Matrix) and 2 (Collection Mix)
- `research/01-data-analyst-local-context.md` — Sections 2 (Vertical Analysis) and 5 (Priority Matrix, POI estimates)
- `docs/vertical-delta-templates/00_verticals_overview_matrix.csv` — Structured vertical metadata

---

*Last updated: March 2026*
