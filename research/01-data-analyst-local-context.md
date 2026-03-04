# ADL Data Acquisition Strategy: Local Context Analysis
## Bonamoussadi, Douala, Cameroon

**Teammate 1 -- Data Analyst Deliverable**
**Date:** March 2026

---

## Table of Contents

1. [Pilot Area Profile: Bonamoussadi](#1-pilot-area-profile-bonamoussadi)
2. [Vertical Analysis](#2-vertical-analysis)
   - [2.1 Billboards](#21-billboards)
   - [2.2 Alcohol](#22-alcohol)
   - [2.3 Census](#23-census)
   - [2.4 Fuel](#24-fuel)
   - [2.5 Mobile Money](#25-mobile-money)
   - [2.6 Pharmacy](#26-pharmacy)
   - [2.7 Transport Roads (Including Blocked Roads)](#27-transport-roads-including-blocked-roads)
3. [Cross-Cutting: Competitor Landscape](#3-cross-cutting-competitor-landscape)
4. [Cross-Cutting: Regulatory Environment](#4-cross-cutting-regulatory-environment)
5. [Summary: Priority Matrix](#5-summary-priority-matrix)

---

## 1. Pilot Area Profile: Bonamoussadi

### Geography and Demographics

| Attribute | Detail |
|---|---|
| **City** | Douala, Littoral Region, Cameroon |
| **Municipality** | Douala V |
| **Neighborhood** | Bonamoussadi (includes sub-zones A, B, and Makepe) |
| **Douala metro population (2025 est.)** | ~4.35 million |
| **Bonamoussadi businesses (est.)** | ~560 registered businesses |
| **Elevation** | ~13m above sea level (coastal, flood-prone) |
| **Character** | Middle-class residential and commercial, multi-story buildings, relatively well-maintained roads compared to Douala average |

### Economic Profile

- **Cameroon GDP (2024):** ~$45 billion (nominal). Informal economy estimated at 30--50% of GDP depending on methodology; the ILO estimates the informal sector employs ~90% of the active population.
- **Douala's role:** Primary economic capital, main port city, industrial hub (breweries, textiles, palm oil, construction materials). Approximately 33.3% of Cameroon's informal production units are concentrated in Douala and Yaounde combined.
- **Bonamoussadi specifically:** Known as the neighborhood of Douala's "new middle classes." Tenant profile: mid-level professionals, SME owners, young dual-income families. University of Douala nearby. Gross rental yields of 7--10%. Proximity to supermarkets (Super U, Carrefour-Market, Spar, China Mall), banks (Ecobank), schools, clinics, and restaurants.
- **Poverty context:** Despite Douala's economic dominance, ~30% of the city's population lives below the poverty line.

### Infrastructure Context

- Roads in Bonamoussadi are among the best-maintained in Douala, but that is a low bar -- 41% of Cameroon's roads are in poor condition nationally, and only 10% of the national road network is tarred.
- The area is vulnerable to flooding during the rainy season (June--October), which directly affects road accessibility and business operations.
- Mobile network coverage is strong in Bonamoussadi (MTN, Orange), supporting mobile-first data collection.
- Google Maps satellite imagery is available for Douala; OpenStreetMap coverage exists but has gaps, particularly in peripheral and newly developed areas.

---

## 2. Vertical Analysis

---

### 2.1 Billboards

#### Existing Data Sources

| Source | Coverage | Quality | Access |
|---|---|---|---|
| **Alliance Media inventory** | National, including Douala and Douala International Airport | Commercial-grade | Proprietary; available to advertisers |
| **Ministry of Communication authorized list** | 155 approved advertising companies nationally (2023) | Official but static | Published annually; may lag reality |
| **JC Decaux Cameroun** | Urban street furniture, transit advertising | High for their network | Proprietary |
| **OpenStreetMap** | Sparse tagging of billboards | Low completeness | Open |
| **Google Street View** | Visual inspection possible | Variable age of imagery | Free |

#### Field Realities in Bonamoussadi/Douala

- Billboard advertising in Douala is dominated by a handful of licensed operators: Alliance Media, JC Decaux Cameroun, MC Cann Douala, and Acmar Media.
- The formal/informal split is significant: licensed companies hold official placements, but informal signage, hand-painted advertisements, and unauthorized poster boards proliferate throughout commercial corridors.
- Bonamoussadi, as a middle-class commercial area, attracts billboard placements from FMCG brands (beer, telecom, banking) along major intersections like Carrefour Bonamoussadi.
- Billboard density is highest along primary roads and commercial junctions; secondary streets have more informal signage.

#### Update Frequency Needed

| Change Type | Frequency | Driver |
|---|---|---|
| New billboard installation | Monthly | New advertising campaigns, seasonal promotions |
| Billboard content change | Weekly to monthly | Campaign cycles (telecoms, beer brands rotate frequently) |
| Billboard removal/damage | Event-driven | Weather damage (rainy season), municipal enforcement |
| Informal signage turnover | Weekly | Market dynamics, pop-up promotions |

#### Data Quality Risks

- **Boundary ambiguity:** Distinguishing formal billboards from large commercial signage and informal poster boards requires clear field definitions.
- **Ownership attribution:** Many billboards lack visible ownership markings; determining the operator requires local knowledge.
- **Seasonal damage:** Rainy season (June--October) causes physical damage that may render billboards unreadable or collapsed.
- **Regulatory enforcement waves:** Periodic municipal crackdowns remove unauthorized billboards in batches, causing sudden data invalidation.

#### Key Actors in the Value Chain

1. **Regulators:** Ministry of Communication (licensing), Douala City Council (urban planning permits)
2. **Billboard operators:** Alliance Media, JC Decaux, MC Cann Douala, Acmar Media, local operators
3. **Advertisers:** Telecoms (MTN, Orange), breweries (SABC/Brasseries du Cameroun), banks, consumer goods
4. **Media buying agencies:** Sortlist-listed agencies and local buyers
5. **Informal actors:** Local sign painters, poster distributors, small business owners

#### Data Gaps

- No centralized, geolocated inventory of all billboard assets in Douala exists.
- Informal signage is completely unmapped.
- Billboard occupancy rates (booked vs. vacant) are not publicly available.
- Historical data on billboard lifecycle (installation date, content rotation) is absent.

#### Delta Indicators (Most Valuable Changes to Track)

- New billboard installations (signals commercial investment in an area)
- Vacancy rates (signals economic health of advertising market)
- Informal-to-formal ratio shifts (signals regulatory enforcement or market maturation)
- Content category shifts (which industries are spending on OOH advertising)

---

### 2.2 Alcohol

#### Existing Data Sources

| Source | Coverage | Quality | Access |
|---|---|---|---|
| **Euromonitor / Statista** | National market data | High-level market sizing | Paid reports |
| **SABC (Brasseries du Cameroun)** | Distribution network for their brands | Detailed but proprietary | Internal only |
| **Ministry of Commerce** | Licensed bar/point-of-sale registers | Formal sector only | Government records |
| **WHO Global Alcohol Report** | National consumption statistics | Aggregate | Open |
| **OpenStreetMap** | Some bars/restaurants tagged | Low completeness | Open |

#### Field Realities in Bonamoussadi/Douala

- **Market size:** Cameroon's alcoholic beverages market is projected at ~$4.9 billion in 2025, one of the largest in Central Africa.
- **Point-of-sale density:** Over 40,000 bars and points of sale for alcoholic drinks exist nationally. In a commercial neighborhood like Bonamoussadi, the density of bars, "off-licences" (debit de boisson), and informal drinking spots is extremely high.
- **Formal vs. informal:** The formal sector is dominated by Brasseries du Cameroun (SABC), producing brands like "33" Export, Castel, and Beaufort. However, the informal sector is massive -- estimated at $1--2 billion in alcohol sales bypassing formal oversight. This includes artisanal brews, small distillers, undocumented imports, and smuggled spirits from Nigeria.
- **Quality concerns:** Research has found that 32.1% of informally sold alcohol exceeds EU methanol safety limits, 13.9% has discrepancies between declared and actual alcohol strength, and 16% lacks basic labeling.
- **Bonamoussadi context:** As a middle-class area, Bonamoussadi has a mix of formal bars/lounges (serving branded beer) and informal neighborhood spots. Street-side vendors selling sachets of spirits are common even in upscale areas.

#### Update Frequency Needed

| Change Type | Frequency | Driver |
|---|---|---|
| New bar/point-of-sale opening | Weekly | Low barrier to entry, high turnover |
| Bar/point-of-sale closure | Weekly | Business failure, regulatory action |
| Product availability changes | Monthly | Supply chain disruptions, brand launches |
| Pricing changes | Quarterly | Government price controls, inflation |
| Seasonal demand shifts | Seasonal | Holidays, festivals, dry/rainy season |

#### Data Quality Risks

- **High informal turnover:** Unlicensed drinking spots open and close rapidly, making any snapshot quickly outdated.
- **Dual-purpose establishments:** Many shops sell alcohol alongside other goods, making classification difficult.
- **Under-reporting:** Operators may understate activity to avoid tax/regulatory attention.
- **Smuggled products:** Counterfeit and smuggled alcohol is indistinguishable from legitimate products at point of sale without inspection.
- **Night-only operations:** Some establishments operate primarily at night, making daytime field capture incomplete.

#### Key Actors in the Value Chain

1. **Producers:** SABC/Brasseries du Cameroun (dominant), Union Camerounaise de Brasseries (UCB), informal distillers
2. **Importers:** Formal importers (wines, spirits), informal cross-border traders (Nigeria)
3. **Distributors:** SABC distribution network, independent wholesalers, informal distributors
4. **Retailers:** Licensed bars, restaurants, hotels, off-licences, street vendors, informal spots
5. **Regulators:** Ministry of Commerce (licensing), Ministry of Public Health (quality), tax authorities
6. **Consumers:** Urban middle class (branded beer), lower income (artisanal brews, sachets)

#### Data Gaps

- No geolocated database of all alcohol points of sale in Douala exists.
- Informal sector volume is estimated but not measured.
- Product-level distribution data (which brands are sold where) is proprietary to SABC.
- Quality/safety data at point of sale is virtually non-existent.
- Operating hours and actual vs. licensed activity are undocumented.

#### Delta Indicators

- New establishment openings/closures (economic vitality signal)
- Informal-to-formal ratio (regulatory environment signal)
- Brand distribution shifts (market competition intelligence)
- Price point changes (inflation/economic stress indicator)
- Density changes by micro-zone (commercial development patterns)

---

### 2.3 Census

#### Existing Data Sources

| Source | Coverage | Quality | Access |
|---|---|---|---|
| **BUCREP (Bureau Central des Recensements et des Etudes de Population)** | National census | Last official census: 2005 | Government; limited digital access |
| **UN Population Division** | Country-level projections | Modeled estimates | Open |
| **Worldometer / World Population Review** | City-level estimates | Extrapolations from 2005 census | Open |
| **Cameroon Data Portal (Open Data for Africa)** | Sub-national statistics | Based on 2005 census with projections | Open |
| **DHS (Demographic & Health Survey)** | Sample-based surveys | High quality for covered indicators | Open |
| **INS (Institut National de la Statistique)** | Various household surveys | Variable | Government |

#### Field Realities in Bonamoussadi/Douala

- **Critical data gap:** Cameroon's last official census was conducted in 2005 -- over 20 years ago. All current population figures for Douala and its neighborhoods are projections and estimates, not observed data.
- **Rapid urbanization:** Douala has grown from ~1.9 million (2005 census) to an estimated 4.35 million (2025), meaning census-based data is fundamentally unreliable at the neighborhood level.
- **Bonamoussadi transformation:** The neighborhood has undergone significant densification since 2005, with multi-story residential construction transforming what were previously lower-density areas.
- **Informal settlements:** Population counts miss informal and unregistered residents, temporary workers, and seasonal migrants.
- **Addressing challenges:** Most of Douala lacks formal street addresses, making population enumeration at block level extremely difficult.

#### Update Frequency Needed

| Change Type | Frequency | Driver |
|---|---|---|
| Household count | Annually | Construction, migration |
| Population density estimates | Quarterly | Seasonal migration patterns |
| Demographic composition | Annually | Economic shifts, university enrollment cycles |
| Building footprint changes | Monthly | Active construction in Bonamoussadi |

#### Data Quality Risks

- **21-year-old baseline:** Any census data references the 2005 census, which is fundamentally outdated for a rapidly growing city.
- **Projection errors compound:** Small errors in growth rate assumptions produce large errors over 20+ years.
- **Under-enumeration:** Informal residents, domestic workers, and transient populations are systematically missed.
- **Political sensitivity:** Census data in Cameroon has ethnic and regional political implications, which can influence data collection and publication.
- **No address system:** Without formal addresses, linking population data to specific locations is extremely challenging.

#### Key Actors

1. **BUCREP:** Official census authority
2. **INS (Institut National de la Statistique):** Statistical surveys
3. **Ministry of Economy, Planning and Regional Development:** Uses census data for planning
4. **Douala City Council / Douala V Municipality:** Local governance and planning
5. **UNFPA / UNDP:** International support for census operations
6. **Community chiefs (chefs de quartier):** Local knowledge holders for population in their areas

#### Data Gaps

- No neighborhood-level population data exists that is less than 20 years old.
- Building-level occupancy data is non-existent.
- Demographic composition (age, gender, income) at neighborhood level is unavailable.
- Migration patterns into and out of Bonamoussadi are untracked.
- No reliable household income data at the micro-zone level.

#### Delta Indicators

- Building construction/demolition (proxy for population change)
- Occupancy rates (occupied vs. vacant units)
- Commercial establishment density (proxy for economic activity and population)
- School enrollment numbers (proxy for family demographics)
- Utility connection counts (proxy for household formation)

---

### 2.4 Fuel

#### Existing Data Sources

| Source | Coverage | Quality | Access |
|---|---|---|---|
| **CSPH (Hydrocarbons Prices Stabilization Fund)** | National pricing data | Official, regulated | Government |
| **SCDP (Societe Camerounaise des Depots Petroliers)** | Storage/distribution infrastructure | Internal | Not public |
| **Logistics Cluster (WFP)** | Fuel infrastructure assessment | Humanitarian-grade | Open |
| **GlobalPetrolPrices.com** | National price tracking | Aggregate | Open |
| **Brand operator data (Total, Tradex, OLA Energy)** | Station-level | Proprietary | Internal |
| **OpenStreetMap** | Some stations tagged | Incomplete | Open |

#### Field Realities in Bonamoussadi/Douala

- **Station count:** 890 petrol stations nationally, with 175 filling stations in the Littoral region (Douala area). In Bonamoussadi specifically, there are several branded stations including a confirmed Tradex Bonamoussadi location.
- **Market structure:** The sector is dominated by three players -- Total (26% market share), MRS (18%), and OLA Energy (formerly OiLibya, 8%), plus state-owned Tradex. In total, 33 fuel distribution companies operate nationally.
- **Price regulation:** Fuel prices are set by CSPH (a government entity) and are uniform across all SCDP depot locations. As of 2024, average gasoline price was ~679 XAF/liter, with regulated maximums around 840 XAF/liter.
- **Informal fuel sales:** Black market fuel, particularly smuggled from Nigeria, is sold in jerry cans and bottles along roads, especially in border areas, but also present in urban markets.
- **Services beyond fuel:** Stations increasingly offer convenience stores, food, and other services -- Tradex notably launched food service at its stations.

#### Update Frequency Needed

| Change Type | Frequency | Driver |
|---|---|---|
| Station opening/closure | Quarterly | Capital-intensive; slow change |
| Fuel price changes | Event-driven (government decree) | CSPH regulation, international oil prices |
| Stock-outs / supply disruptions | Daily to weekly | Supply chain issues, SONARA refinery problems |
| Service offerings | Monthly | Business strategy |
| Informal fuel vendor presence | Weekly | Supply/demand, enforcement |

#### Data Quality Risks

- **Station vs. vendor confusion:** Informal fuel sellers operate near formal stations, creating confusion in classification.
- **Temporary closures:** Stations may close temporarily for supply issues, renovation, or regulatory reasons without formal notification.
- **Service scope creep:** Multi-purpose stations (fuel + convenience + mobile money) complicate categorization.
- **Subsidy distortions:** Government fuel subsidies (significant budget item in 2024) mask true market dynamics.

#### Key Actors

1. **SONARA:** National refinery (Limbe), sole domestic refiner
2. **SCDP:** Storage and distribution monopoly (13 depots in 6 regions)
3. **CSPH:** Price regulation authority
4. **Marketers:** Total Cameroon, Tradex (state-owned), OLA Energy/OiLibya, MRS, Neptune Oil, and ~28 smaller companies
5. **Informal vendors:** Black market fuel sellers (jerry cans)
6. **Consumers:** Private vehicles, commercial transport, motorbike taxis (major consumers)

#### Data Gaps

- No real-time fuel availability data exists at station level.
- Queue lengths and wait times are untracked.
- Informal fuel sales volume is unknown.
- Station-level service inventory (ATM, convenience store, car wash, etc.) is not centralized.
- Fuel quality at point of sale is not monitored systematically.

#### Delta Indicators

- Stock-out events (supply chain health signal)
- New station construction (infrastructure investment)
- Informal vendor density near stations (supply constraint indicator)
- Service diversification at stations (market maturation)
- Price compliance (adherence to CSPH regulated prices)

---

### 2.5 Mobile Money

#### Existing Data Sources

| Source | Coverage | Quality | Access |
|---|---|---|---|
| **BEAC / COBAC** | CEMAC-level transaction data | Aggregate | Regulatory reports |
| **MTN MoMo reports** | National agent/transaction data | High-level | Annual reports, press releases |
| **Orange Money reports** | National agent/transaction data | High-level | Annual reports, press releases |
| **GSMA State of the Industry** | National mobile money stats | Annual | Open |
| **ICTD research** | Agent economics and challenges | Academic | Open |
| **OpenStreetMap** | Some agent locations tagged | Very incomplete | Open |

#### Field Realities in Bonamoussadi/Douala

- **Market dominance:** Two operators dominate -- Orange Money (~70% market share by transaction value, 10 million customers, 168,000 points of presence including 108,000 merchant points and 60,000 distribution points) and MTN MoMo (~30%, ~6 million users). Together they handle >80% of electronic transactions in Cameroon.
- **Transaction volume:** Mobile money transactions totaled CFA 22,137 billion in 2023, with 2.2 billion transactions (up from 615 million in 2019 -- a 3.6x increase).
- **Agent density in Bonamoussadi:** As a middle-class commercial area, agent density is very high. Mobile money kiosks and agent points are found at nearly every commercial intersection, often with multiple competing agents within meters of each other.
- **Agent challenges:** After a 2022 tax on mobile money transactions, agents report declining revenues, increased competition, fraud/scams, and liquidity management difficulties.
- **CAMTEL entry:** The state-owned telecom company CAMTEL is entering the mobile money market, potentially adding a third operator.
- **Cameroon leads CEMAC:** Cameroon accounts for 62.11% of registered accounts, 63.58% of transaction volume, and 76.57% of transaction value in the CEMAC mobile money market.

#### Update Frequency Needed

| Change Type | Frequency | Driver |
|---|---|---|
| Agent point opening/closure | Weekly | Very high turnover, low barriers to entry |
| Agent liquidity status | Daily | Cash flow dynamics |
| Service availability (cash-in/out) | Daily | Float management |
| New service offerings (bill pay, etc.) | Monthly | Operator product launches |
| Pricing/fee changes | Event-driven | Operator or regulatory decisions |

#### Data Quality Risks

- **Extreme agent turnover:** Mobile money agents open and close very frequently; a point captured today may not exist next week.
- **Multi-operator agents:** Many agents serve both MTN and Orange, complicating exclusive attribution.
- **Branded vs. active:** An agent may display branding but be inactive or out of float.
- **Float availability:** An agent may be "open" but unable to service transactions due to cash flow constraints.
- **Identity verification gaps:** KYC compliance is weak; ID coverage below 60% in some areas (World Bank, 2024).
- **Fraud risk:** Agent-level fraud is documented and persistent, including transaction structuring and unauthorized operations.

#### Key Actors

1. **Operators:** MTN Cameroon (MoMo), Orange Cameroon (Orange Money), CAMTEL (entering market)
2. **Regulators:** COBAC (banking commission), BEAC (central bank), ANIF (financial intelligence)
3. **Super-agents/Aggregators:** Master agents who manage networks of sub-agents
4. **Individual agents:** Small business owners, kiosk operators, street-side agents
5. **Merchants:** Businesses accepting mobile money payments
6. **Consumers:** Individuals using mobile money for transfers, bill payments, savings

#### Data Gaps

- No public, geolocated database of active mobile money agents exists.
- Agent activity status (active vs. inactive) is unknown without field verification.
- Float/liquidity availability is completely untracked at the public level.
- Transaction density by location is proprietary to operators.
- Agent commission structures and actual earnings are opaque.
- Fee transparency (actual fees charged vs. official rates) varies by agent.

#### Delta Indicators

- Agent density changes by micro-zone (financial access indicator)
- Agent churn rate (market health signal)
- Multi-service vs. single-service agents (market sophistication)
- Float availability patterns (cash circulation health)
- New merchant acceptance points (digital payment adoption)

---

### 2.6 Pharmacy

#### Existing Data Sources

| Source | Coverage | Quality | Access |
|---|---|---|---|
| **Pharmacists Council of Cameroon** | Registered pharmacies | Official registry | Government; limited digital access |
| **DPML (Dept. of Pharmacy, Drugs and Laboratories)** | Licensed pharmaceutical establishments | Regulatory | Government |
| **CENAME (Central Supply)** | National essential medicines supply | Procurement data | Government |
| **LANACOME** | Drug quality control testing | Laboratory data | Government |
| **WHO Essential Medicines List** | Reference formulary | International standard | Open |
| **OpenStreetMap** | Some pharmacies tagged | Incomplete | Open |

#### Field Realities in Bonamoussadi/Douala

- **Formal pharmacies:** Only licensed pharmacists can own pharmacy drug stores in Cameroon. "Pharmacie de Bonamoussadi" and "Pharmacie Makepe" are confirmed formal pharmacies in the area. Formal pharmacies are well-marked with green cross signage and are relatively easy to identify.
- **Informal drug markets:** This is the critical challenge. Informal drug vendors sell medicines spread on tables in markets, along streets, and at roadsides -- without prescriptions. The government estimates informal drug sales represent >25% of the national drug market. This is a major public health concern.
- **"Propharmacies":** In rural and semi-urban areas, propharmacies (simplified dispensaries run by non-pharmacists) provide basic medicines but with limited quality control.
- **Bonamoussadi context:** As a middle-class area, Bonamoussadi has multiple formal pharmacies and clinics (e.g., Clinique Picardie). However, informal medicine vendors are still present, particularly at market areas and transport hubs.
- **Supply chain:** The DPML licenses establishments; CENAME handles national procurement of essential medicines; distribution flows through formal wholesale pharmacies to retail pharmacies.

#### Update Frequency Needed

| Change Type | Frequency | Driver |
|---|---|---|
| Pharmacy opening/closure | Quarterly | High regulatory barriers; slow change |
| Informal vendor appearance/disappearance | Weekly | Enforcement cycles, market demand |
| Drug availability (stock-outs) | Weekly | Supply chain disruptions |
| Operating hours changes | Monthly | Staffing, demand patterns |
| On-duty pharmacy rotations (pharmacies de garde) | Daily/weekly | Regulatory rotation schedule |

#### Data Quality Risks

- **Formal/informal distinction:** Clearly identifiable for formal pharmacies (green cross, signage), but informal vendors are mobile and hard to classify.
- **Drug quality unknowable from observation:** Counterfeit and substandard medicines cannot be identified through visual field capture alone.
- **Temporary closures:** Pharmacies may close for restocking, staff absence, or regulatory issues without visible notice.
- **Night/duty pharmacies:** "Pharmacies de garde" (on-duty pharmacies open at night/weekends) rotate on a schedule that is often poorly communicated.
- **Licensed vs. operating:** A pharmacy may be registered but not actively operating, or operating under reduced capacity.

#### Key Actors

1. **Regulators:** DPML (licensing), LANACOME (quality control), IGSPL (inspection), Pharmacists Council of Cameroon
2. **National supply:** CENAME (essential medicines procurement)
3. **Wholesale distributors:** Licensed pharmaceutical wholesalers
4. **Formal retail:** Licensed community pharmacies (pharmacien d'officine)
5. **Informal retail:** Street vendors, market sellers, unregistered medicine shops
6. **Prescribers:** Doctors, clinics, hospitals
7. **Consumers:** Patients, self-medicating individuals

#### Data Gaps

- No public geolocated directory of licensed pharmacies in Douala exists digitally.
- Informal medicine vendor locations and product offerings are unmapped.
- Real-time drug availability (stock-outs of essential medicines) is not tracked at retail level.
- Pharmacy operating hours and on-duty rotation schedules are not systematically digitized.
- Drug pricing at retail level (price variation across pharmacies) is not monitored.

#### Delta Indicators

- Informal vendor density changes (regulatory enforcement / public health signal)
- New pharmacy openings (healthcare access improvement)
- Stock-out frequency for essential medicines (supply chain health)
- Pharmacy-to-population ratio changes by micro-zone
- Night/weekend pharmacy availability (healthcare access indicator)

---

### 2.7 Transport Roads (Including Blocked Roads)

#### Existing Data Sources

| Source | Coverage | Quality | Access |
|---|---|---|---|
| **Ministry of Public Works** | National road classification | Official but outdated | Government |
| **OpenStreetMap** | Road network geometry | Variable; gaps in peripheral areas | Open |
| **HDX (Humanitarian Data Exchange)** | Cameroon roads export | OSM-derived | Open |
| **Google Maps / Satellite** | Visual road coverage | Current imagery available | Free |
| **Logistics Cluster (WFP)** | Road condition assessments | Humanitarian focus | Open |
| **Douala City Council** | Municipal road plans | Planning-grade | Government |

#### Field Realities in Bonamoussadi/Douala

- **Road condition crisis:** 41% of Cameroon's roads are in poor condition nationally. Only 10% of the national road network is paved. Douala's roads are severely impacted by heavy rains, with the city launching emergency road rehabilitation plans in 2024.
- **Flooding vulnerability:** Douala sits at only 13m above sea level in a coastal mangrove ecosystem. Flooding is chronic during the rainy season (June--October), regularly blocking roads and rendering them impassable. This makes blocked-road tracking extremely valuable.
- **Bonamoussadi advantage:** Roads in Bonamoussadi are among the better-maintained in Douala, but still suffer from seasonal flooding, potholes, and congestion. The main commercial corridors are paved but secondary streets may be unpaved.
- **Traffic congestion drivers:** Motorbike taxis (motos) contribute significantly to traffic chaos. Roadside parking reduces effective road width. Goods vehicles serving Douala Port create heavy freight traffic on arterial roads.
- **Major infrastructure projects:** The Yaounde-Douala highway (Phase II, target completion 2028) and eastern access road to Douala are under construction, which will change traffic patterns.

#### Update Frequency Needed

| Change Type | Frequency | Driver |
|---|---|---|
| Road blockages (flooding) | Real-time / daily | Rainfall events (June--October peak) |
| Road blockages (construction) | Weekly | Infrastructure projects |
| Road blockages (accidents/incidents) | Real-time | Traffic events |
| Pothole / deterioration | Weekly to monthly | Weather, traffic volume |
| New road construction/paving | Monthly | Government infrastructure projects |
| Traffic pattern changes | Weekly | New construction, market days, events |

#### Data Quality Risks

- **Temporal sensitivity:** Road conditions change within hours during rainy season; data captured in the morning may be invalid by afternoon.
- **GPS accuracy in dense areas:** Urban canyons created by multi-story buildings in Bonamoussadi can reduce GPS accuracy.
- **Subjectivity of "blocked":** "Blocked" exists on a spectrum from "impassable by any vehicle" to "difficult for sedans but passable by SUV/moto." Clear categorization standards are essential.
- **Seasonal bias:** Data collected in dry season presents a misleadingly positive picture.
- **Construction zone ambiguity:** Temporary road closures for construction may or may not have signage.

#### Key Actors

1. **Ministry of Public Works:** National road infrastructure authority
2. **Douala City Council:** Municipal road maintenance
3. **Contractors:** Road construction companies (often Chinese-funded projects)
4. **Transport operators:** Taxi drivers, moto-taxi operators, bus companies, freight companies
5. **Traffic police:** Manage intersections and enforce traffic rules
6. **Citizens:** End-users who experience road conditions daily
7. **Emergency services:** Require real-time road accessibility data

#### Data Gaps

- No real-time road condition reporting system exists for Douala.
- Historical flooding patterns by specific street/intersection are not digitized.
- Traffic density data by road segment and time of day is unavailable.
- Blocked roads during rainy season are communicated only through social media and word of mouth.
- Road surface condition (paved, unpaved, gravel, laterite) is not systematically mapped at street level.
- Construction zone locations and expected completion dates are not centrally tracked.

#### Delta Indicators

- Road blockage events (real-time value for transport and logistics)
- Road condition deterioration/improvement over time
- New paving or rehabilitation (infrastructure investment tracking)
- Flooding recurrence by location (risk mapping)
- Traffic congestion patterns (urban planning value)
- Construction project progress (accountability tracking)

---

## 3. Cross-Cutting: Competitor Landscape

### Who Else Collects Ground-Truth Data in Cameroon?

| Competitor / Actor | What They Do | Strengths | Weaknesses | Overlap with ADL |
|---|---|---|---|---|
| **OpenStreetMap community (incl. HOT)** | Volunteer mapping of roads, buildings, POIs | Open data, large community | Inconsistent update frequency, no structured verification workflow | Road network, POI locations |
| **Google Maps** | Satellite imagery, business listings, navigation | Global coverage, high brand trust | Limited local verification, user-submitted data quality varies, no ground-truth for informal sector | Business locations, road network |
| **Alliance Media** | Billboard inventory for advertisers | Professional, commercial-grade | Limited to their own assets, proprietary | Billboard vertical only |
| **GeoCameroun (OSM-derived)** | Government-endorsed mapping initiative | Institutional backing | Unclear update mechanism, limited coverage | General mapping |
| **WFP Logistics Cluster** | Humanitarian logistics infrastructure assessment | Professional assessment, open data | Humanitarian focus only, infrequent updates | Fuel, roads |
| **Mobile mapping survey (Yaounde project)** | Mobile road mapping with georeferenced imagery | High accuracy | One-time project, not ongoing | Road network |
| **Cameroon-streets.openalfa.com** | Street-level directory for Cameroon neighborhoods | Structured by neighborhood, lists businesses/health services | Unclear data freshness, limited metadata | Business listings, health services |
| **MTN / Orange** | Agent network data for internal operations | Comprehensive for their agents | Proprietary, not shared | Mobile money agents |

### ADL's Competitive Advantage

ADL's differentiation lies in:
1. **Structured, verified ground-truth:** Unlike OSM or Google, ADL has an admin review workflow for data quality.
2. **Update cadence:** Continuous field capture vs. one-time surveys or volunteer-driven updates.
3. **Multi-vertical integration:** No competitor covers billboards, alcohol, fuel, mobile money, pharmacies, census-proxy, and roads simultaneously.
4. **Informal sector coverage:** This is the critical gap -- no existing data source reliably covers the informal economy, which represents the majority of economic activity in Douala.
5. **Offline-first architecture:** Essential for areas with intermittent connectivity, even in relatively well-connected Bonamoussadi.

---

## 4. Cross-Cutting: Regulatory Environment

### Data Protection Law (Law No. 2024/017)

Cameroon enacted its first comprehensive data protection law on December 23, 2024 (Law No. 2024/017 Relating to Personal Data Protection). Key implications for ADL:

| Requirement | Implication for ADL | Compliance Deadline |
|---|---|---|
| **Explicit, informed consent** before data processing | Must obtain consent when capturing data about identifiable businesses/individuals | June 23, 2026 |
| **Independent Data Protection Authority** | New regulator to engage with; will set standards for data controllers | Being established |
| **Data processing registration** | ADL must register as a data controller/processor | June 23, 2026 |
| **International data transfers** | Stringent conditions for transferring personal data to countries without adequate protection; requires binding corporate rules or standard contractual clauses | Immediate |
| **Right to erasure** | Individuals can request deletion of their data | Immediate |
| **Data breach notification** | Must notify authority and affected individuals of breaches | Immediate |

### Sector-Specific Regulations

| Sector | Key Regulation | Implication |
|---|---|---|
| **Advertising/Billboards** | Law No. 2006/018 on advertising; Ministry of Communication annual licensing | Only approved companies can conduct advertising; ADL is mapping, not advertising, but should clarify regulatory position |
| **Alcohol** | Restrictions on alcohol advertising in outdoor spaces; licensing requirements for points of sale | ADL data could support regulatory compliance monitoring |
| **Pharmacy** | 1990/1992 pharmacy profession laws; DPML licensing | Mapping informal drug sellers has public health value but could raise sensitivity |
| **Mobile Money** | COBAC/BEAC regulation; 2025 fintech licensing deadline | Agents must be licensed; ADL data could help operators verify agent compliance |
| **Fuel** | CSPH price regulation; petroleum sector liberalization (2000) | Fuel prices are government-regulated; ADL can track compliance |
| **Census** | BUCREP mandate for official census | ADL provides census-proxy, not official census; positioning matters |
| **Roads** | Ministry of Public Works jurisdiction | Road condition data has clear public interest value |

### AML/KYC Considerations

- ANIF (National Financial Investigation Agency) and COBAC enforce AML/CFT regulations.
- Mobile money operations are subject to KYC requirements, but ID coverage is below 60% in some areas.
- ADL's agent location data could support KYC/compliance efforts by mobile money operators.

---

## 5. Summary: Priority Matrix

### Vertical Prioritization for Bonamoussadi Pilot

| Vertical | Data Freshness Need | Existing Data Quality | Informal Sector Challenge | Commercial Value | Recommended Priority |
|---|---|---|---|---|---|
| **Transport Roads** | Real-time / daily | Low (no real-time system) | Low (roads are observable) | Very High (transport, logistics, delivery) | **P0 -- Highest** |
| **Mobile Money** | Weekly | Very Low (no public directory) | High (agent churn) | Very High (financial services, telcos) | **P0 -- Highest** |
| **Pharmacy** | Monthly | Low (no digital directory) | High (informal drug sellers) | High (pharma companies, public health) | **P1 -- High** |
| **Fuel** | Weekly | Medium (branded stations known) | Medium (informal vendors) | High (fuel companies, logistics) | **P1 -- High** |
| **Alcohol** | Weekly | Very Low (no geolocated data) | Very High (massive informal) | High (breweries, FMCG) | **P1 -- High** |
| **Billboards** | Monthly | Medium (operators have own data) | Medium (informal signage) | Medium (advertising agencies) | **P2 -- Medium** |
| **Census** | Quarterly | Very Low (20+ year old data) | Low (observable via proxies) | High (planning, government) | **P2 -- Medium** |

### Key Strategic Insights

1. **Roads and mobile money should launch first.** They have the highest real-time value, clear commercial buyers (logistics companies, telcos, financial services), and the data changes frequently enough to justify continuous collection.

2. **The informal sector is ADL's biggest opportunity and challenge.** No competitor systematically maps informal businesses. This is where ADL creates unique value. But it also requires the most sophisticated field protocols -- informal businesses are hard to identify, classify, and track over time.

3. **Rainy season (June--October) is a natural forcing function.** Road blockage data becomes extremely valuable during this period. ADL should plan its pilot launch to coincide with or precede the rainy season to demonstrate real-time value immediately.

4. **Census-proxy data is a slow-burn asset.** While not commercially valuable in the short term, building a longitudinal dataset of building counts, business density, and occupancy rates creates a uniquely valuable demographic proxy that no one else has. This data becomes more valuable over time.

5. **Regulatory timing is favorable.** The June 2026 compliance deadline for Cameroon's new data protection law creates urgency for businesses to understand their data practices. ADL should position its data collection as compliant from day one.

6. **Bonamoussadi is an ideal pilot zone** because it has a manageable geographic footprint (~560 businesses), a mix of formal and informal activity, relatively good infrastructure for field agents, and enough commercial density to generate meaningful datasets across all seven verticals.

### Estimated Field Capture Scope for Bonamoussadi

| Vertical | Estimated Points of Interest | Capture Complexity |
|---|---|---|
| Transport Roads | ~50--80 road segments | Medium (condition assessment requires training) |
| Mobile Money | ~100--200 agent points | Low (visible signage, easy to locate) |
| Pharmacy | ~10--15 formal + ~20--40 informal | Medium (informal sellers may be mobile) |
| Fuel | ~5--10 stations | Low (large, fixed, branded) |
| Alcohol | ~80--150 points of sale | High (many informal, night-only, dual-purpose) |
| Billboards | ~30--60 billboard/signage locations | Low (stationary, visible) |
| Census proxy | ~560+ buildings/businesses | Medium (requires systematic coverage) |

---

## Sources

- [Douala -- Wikipedia](https://en.wikipedia.org/wiki/Douala)
- [Cameroon Population (2026) -- Worldometer](https://www.worldometers.info/world-population/cameroon-population/)
- [Alliance Media Cameroon](https://www.alliancemedia.com/cameroon/)
- [Cameroon: 155 advertising companies approved -- Business in Cameroon](https://www.businessincameroon.com/public-management/2601-11223-cameroon-155-advertising-companies-approved-to-operate-this-year)
- [Cameroon Law No. 2006/018 on Advertising](https://assets.tobaccocontrollaws.org/uploads/legislation/Cameroon/Cameroon-Law-No.-2006018-on-Ads.pdf)
- [Cameroon's $4.9B Alcohol Market -- Business in Cameroon](https://www.businessincameroon.com/agro-industry/1909-15044-cameroon-s-projected-4-9b-alcohol-market-in-2025-faces-informal-sector-safety-risks)
- [Beer in Cameroon -- Euromonitor](https://www.euromonitor.com/beer-in-cameroon/report)
- [BUCREP -- GHDx](https://ghdx.healthdata.org/organizations/central-bureau-census-and-population-studies-cameroon)
- [Cameroon Census Data Portal](https://cameroon.opendataforafrica.org/fizfxjc/population-and-housing-census)
- [Cameroon Fuel -- Logistics Cluster](https://lca.logcluster.org/31-cameroon-fuel)
- [Cameroon Gasoline Prices -- GlobalPetrolPrices](https://www.globalpetrolprices.com/Cameroon/gasoline_prices/)
- [Fuel Distribution: Fierce Competition -- Cameroon Business Today](https://cameroonbusinesstoday.cm/articles/161/fr/fuel-distribution-fierce-competition)
- [Orange Cameroon 70% MoMo market share -- Business in Cameroon](https://www.businessincameroon.com/finance/0707-11752-orange-cameroon-boasts-70-momo-market-share-with-cfa800bn-in-monthly-transactions)
- [Cameroon Mobile Money Agents Struggling -- ICTD](https://www.ictd.ac/blog/cameroon-mobile-money-agents-struggling-to-increase-revenue/)
- [Community Pharmacists in Cameroon](https://www.njeitimah-outlook.com/articles/article/2088187/114423.htm)
- [Unsafe Roadside Medication in Cameroon -- Anadolu Agency](https://www.aa.com.tr/en/africa/unsafe-roadside-medication-risks-public-health-in-cameroon/1905704)
- [Requirements to Open a Pharmacy in Cameroon](https://primetimelawoffice.com/requirements-to-open-a-pharmacy-in-cameroon/)
- [41% of Cameroon's Roads in Poor Condition](https://www.stopblablacam.com/society/0512-11571-road-network-41-of-cameroons-roads-are-in-poor-condition-minister-of-public-works)
- [Douala Emergency Road Plan -- Business in Cameroon](https://www.businessincameroon.com/big-projects/0809-14976-douala-launches-emergency-road-plan-amid-heavy-rains-and-waste-crisis)
- [Cameroon Road Network -- Logistics Cluster](https://dlca.logcluster.org/display/DLCA/2.3+Cameroon+Road+Network)
- [Cameroon Data Protection Law No. 2024/017](https://prc.cm/en/multimedia/documents/10271-law-n-2024-017-of-23-12-2024-web)
- [Key Features of Law 2024/017 -- Pollicy](https://pollicy.medium.com/key-features-of-law-2024-017-on-personal-data-protection-in-cameroon-5ee06f79dd1a)
- [Cameroon Data Protection Compliance -- Lex Africa](https://lexafrica.com/2025/10/cameroon-data-protection-law-compliance/)
- [Cameroon Informal Economy Data -- World Economics](https://www.worldeconomics.com/National-Statistics/Informal-Economy/Cameroon.aspx)
- [Bonamoussadi -- DoualZoom](https://www.doualazoom.com/en/quartier/quartier/BONAMOUSSADI)
- [Cameroon Roads -- HDX/OpenStreetMap](https://data.humdata.org/dataset/hotosm_cmr_roads)
- [OSM WikiProject Cameroon](https://wiki.openstreetmap.org/wiki/WikiProject_Cameroon)
- [Mobile Road Mapping in Cameroon -- GIM International](https://www.gim-international.com/content/article/mobile-road-mapping-in-cameroon)
- [Cameroon Fintech Licensing -- LaunchBase Africa](https://launchbaseafrica.com/2025/05/16/cameroons-fintech-ultimatum-three-months-to-license-or-cease-operations/)
- [Makepe II Bonamoussadi Street Guide](https://cameroon-streets.openalfa.com/makepe-ii-bonamoussadi)
