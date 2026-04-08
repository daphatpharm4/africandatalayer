# NovaGarage Africa — Application Guide

> African Data Layer | Application Strategy & Draft Responses
> Deadline: **April 23, 2026 at 5:00 PM EAT** | Apply at: **novagarage.africa/apply**

---

## What Is NovaGarage?

NovaGarage is a prestigious pan-African innovation showcase selecting **15 entrepreneurs** to present at the **Africa Forward Summit** (May 11–12, 2026, Nairobi, Kenya), organized under the high patronage of **President William Ruto of Kenya** in partnership with the French-African Foundation and Autonomous Advancement Initiative.

This is not a traditional accelerator — it is a **high-visibility pitch platform** in front of investors, corporate leaders, and policymakers from across Africa and Europe. Selected startups join a lasting continental network.

**Focus sectors:** Energy · Agriculture · Mobility · Finance

---

## Eligibility Checklist

Before submitting, verify every item:

- [ ] All co-founders are **under 35 years old** (as of application date)
- [ ] At least one founder holds **African citizenship or refugee status** in an African country
- [ ] Team has **up to 4 co-founders** listed (only 2 can attend the summit if selected)
- [ ] The product is **beyond the idea stage** — a working prototype or MVP must exist
- [ ] The solution addresses a **real-world challenge** in one of the 4 focus sectors
- [ ] You can articulate **measurable economic, social, or environmental impact**
- [ ] You have identified **investment or scaling needs** to present at the summit
- [ ] Application submitted before **April 23, 2026 at 5:00 PM EAT**

**African Data Layer status:**
- MVP: COMPLETE — fully deployed on Vercel with PostgreSQL backend, live field agent app
- Sector fit: Finance (primary) + Mobility (secondary)
- Geography: Cameroon (Bonamoussadi, Douala pilot)
- Language: Bilingual English/French (matches Francophone Africa context)

---

## Positioning Strategy

### Lead Sector: Finance

NovaGarage's Finance track is the strongest fit. Position African Data Layer as **financial infrastructure intelligence** — not just a mapping app:

- **Mobile money agent network data**: African Data Layer tracks every mobile money agent location in a city — which providers they carry (MTN, Orange, Express Union), whether they currently have float, their payment methods, and real-time operational status. This is data that banks, fintechs, and regulators cannot access through any other systematic source.
- **Real-time market price data in XAF**: Fuel prices, retail prices, and service availability are captured and verified by field agents — creating a ground-truth economic dataset unavailable from satellites or government statistics.
- **Economic inclusion mapping**: Pharmacies (licensed vs. unlicensed), alcohol outlets (formal vs. informal), and census-proxy buildings map the informal economy — the 60–80% of economic activity that no existing dataset covers.
- **Agent micro-income**: The XP and rewards system turns data collection into paid, dignified work for community members who would otherwise be outside the formal economy.

### Secondary Sector: Mobility

- **Road condition intelligence**: The road segment vertical captures blocked roads, surface types, passability by vehicle type, traffic levels, and street lighting — all verified by agents on the ground.
- **Urban mobility planning**: The data directly informs logistics companies, ride-hailing platforms, and city planners about which roads are accessible, blocked, or deteriorated.

### Core Narrative

> Africa's economic data is missing at the city block level. Investors make decisions without it. Fintechs deploy products without it. Governments plan infrastructure without it. African Data Layer solves this: a fraud-verified, offline-first, crowdsourced data layer for Francophone African cities — built by and for communities on the ground.

---

## Elevator Pitch (3 Sentences)

> African businesses, investors, and governments make billion-dollar decisions about cities where reliable block-level data simply does not exist. African Data Layer is a mobile-first, offline-capable platform that deploys community field agents to map the financial, physical, and commercial infrastructure of African cities — with multi-layer fraud detection ensuring data you can trust. Starting with Bonamoussadi, Douala, we are building the data foundation that African economic growth depends on.

*Use this verbatim to open your written application and any verbal pitch.*

---

## Application Question Drafts

These are the expected questions based on NovaGarage's published selection criteria. Adapt each response with your team's specific details where indicated.

---

### Q1: What problem does your solution solve?

**Draft response:**

African cities are economically invisible. Official statistics are years out of date. Satellite imagery cannot tell you if a mobile money agent has float today, whether a pharmacy is licensed, or which roads are currently passable. This data gap means fintech companies deploy agents blind, logistics companies route around roads that are actually passable, investors underwrite markets they cannot see, and governments plan infrastructure without knowing what already exists.

In Cameroon alone, the informal economy represents over 70% of economic activity — and it is entirely unmapped. African Data Layer addresses this by enabling community members to systematically collect, verify, and update location-level data across 7 categories of urban infrastructure: mobile money agents, fuel stations, pharmacies, road conditions, buildings, billboards, and alcohol retail outlets. Every data point is fraud-verified through EXIF metadata analysis, GPS velocity checks, and a trust scoring system — so clients receive data they can confidently act on.

---

### Q2: Describe your MVP / prototype

**Draft response:**

African Data Layer is a fully deployed mobile-first web application (React 19 + TypeScript), accessible on any Android device including low-end models in bright sunlight on 2G connectivity. The MVP includes:

- **Field agent app**: Agents capture geolocated submissions with photos across 7 data verticals. The app works fully offline (75-item IndexedDB queue, auto-sync on reconnect) and is bilingual English/French.
- **Fraud detection layer**: Every submission passes multi-layer automated review — EXIF metadata extraction from photos (GPS coordinates, device fingerprint, timestamp verification), GPS velocity anomaly detection (flags impossible travel at >80 km/h, blocks at >200 km/h), and a trust tier system (New → Standard → Trusted → Elite) that weights data quality by agent history.
- **Admin review dashboard**: Submissions above a fraud risk threshold are queued for human review, with full forensic detail including EXIF data, risk scores, and agent trust history.
- **Data pipeline**: Raw submissions are deduplicated, confidence-scored, and merged into projected data points with weekly and monthly snapshot deltas.
- **Gamification system**: Agents earn XP for each verified submission, with streak rewards, quality bonuses, and a redemption marketplace — turning data collection into dignified, compensated work.
- **Client dashboard**: Aggregated analytics, delta reports, and exportable insights for data clients.

The pilot is active in Bonamoussadi, Douala, Cameroon.

---

### Q3: What is your target market and its size?

**Draft response:**

**Primary market — Data clients:**
- Fintechs and mobile money operators (MTN Mobile Money, Orange Money, Express Union) that need agent network intelligence across Francophone Africa
- Logistics and last-mile delivery companies (requires passable road data)
- FMCG brands and distributors (requires outlet distribution maps and pricing data)
- Investors and private equity firms requiring market intelligence before deploying capital in West and Central African cities
- Development finance institutions (World Bank, AFD, IFC) requiring infrastructure baselines for project planning

**Secondary market — Field agent employment:**
- Community members in urban Cameroon (and eventually across Francophone Africa) seeking dignified, flexible income through verified data collection

**Market size:**
The African urban data market is nascent but growing rapidly. Consultancies charge $5,000–$50,000 per city-level data report. With 54 countries and hundreds of secondary cities entirely unmapped, the total addressable market for reliable African urban data is conservatively in the hundreds of millions of dollars annually. No systematic, fraud-verified, continuously updated data layer currently exists for Francophone African cities at this resolution.

---

### Q4: What are your measurable economic, social, and environmental impacts?

**Draft response:**

**Economic impact:**
- Creates paid micro-employment for community field agents in a context of high urban unemployment — the XP rewards system is compensation infrastructure, not decoration
- Reduces market research costs for businesses entering Cameroonian and Francophone African markets from months and hundreds of thousands of dollars to days and subscription fees
- Enables fintechs to identify under-served mobile money corridors, directing financial services to areas currently lacking float coverage
- Provides fuel price transparency in XAF that reduces information asymmetry between consumers and fuel retailers

**Social impact:**
- Maps licensed vs. unlicensed pharmacies — directly relevant to medication safety and public health infrastructure
- Identifies road blockages and condition degradation — relevant to emergency services routing and urban planning
- Census-proxy building data (electricity access, water access, storey count, construction material) provides a proxy for socioeconomic conditions unavailable in official statistics
- Bilingual EN/FR design ensures accessibility across Cameroon's linguistic divide

**Environmental impact:**
- Road condition and passability data enables optimized routing that reduces fuel consumption and vehicle wear for logistics operators
- Infrastructure mapping supports evidence-based municipal investment in areas that need it most (street lighting, water, electricity)

---

### Q5: What are your investment or scaling needs?

**Draft response:**

African Data Layer is seeking investment and partnerships to scale across three dimensions:

**1. Agent network expansion (immediate)**
Moving from Bonamoussadi pilot to full Douala coverage (13 arrondissements), then Yaoundé. This requires agent recruitment, onboarding, and rewards funding. Estimated: [your specific figure].

**2. Data sales and client acquisition**
Building a commercial data API and sales function to convert the data into recurring subscription revenue from fintechs, FMCG companies, and development finance institutions. Estimated: [your specific figure].

**3. Platform infrastructure and security**
Scaling the fraud detection pipeline, database infrastructure, and snapshot engine to handle multi-city, multi-country data volumes. Estimated: [your specific figure].

**Partnership needs:**
- Mobile money operators: Data-sharing agreements to validate and enrich our mobile money agent dataset
- Telecoms: Connectivity partnerships to support offline-first agents in low-bandwidth zones
- Development finance institutions: Project-based data contracts for infrastructure mapping

*Tip: Fill in specific dollar/EUR figures before submitting. Be concrete — NovaGarage judges favor founders who know their numbers.*

---

### Q6: Describe your team

**Draft response:**

*[Fill in your actual team details below using this structure:]*

**[Founder Name] — [Role]**
[Age] | [Nationality] | [Background in 2 sentences — technical, business, or field experience]

**[Co-Founder Name] — [Role]**
[Age] | [Nationality] | [Background]

**Why this team:**
We are building African Data Layer from Cameroon, not from a Western co-working space. We understand the realities of building for agents in Bonamoussadi — the sunlight, the cracked screens, the 2G connectivity, the trust dynamics of grassroots data collection. Our design decisions (offline-first, large touch targets, bilingual, sunlight-readable contrast) come from lived knowledge of this context, not from market research.

---

## Key Numbers to Memorize

Have these ready for any verbal pitch, panel Q&A, or follow-up conversation:

| Metric | Value |
|--------|-------|
| Data verticals | 7 (pharmacy, fuel, mobile money, road, billboard, alcohol, buildings) |
| Data fields per location | 30+ enrichable fields across all verticals |
| Offline queue capacity | 75 submissions (survives full connectivity loss) |
| Auto-retry attempts | 6 retries per submission before expiry |
| Offline TTL | 72 hours (data preserved for 3 days without connectivity) |
| Fraud detection layers | 5 (EXIF, GPS velocity, trust score, behavioral, IP cross-validation) |
| Trust tier system | 5 tiers: New → Standard → Trusted → Elite → Restricted |
| GPS anomaly flag threshold | 80 km/h travel speed between submissions |
| GPS anomaly block threshold | 200 km/h travel speed |
| Pilot location | Bonamoussadi, Douala, Cameroon |
| Accessible connectivity | Works on 2G, low-end Android |
| Languages | English + French (bilingual throughout) |
| Accessibility standard | WCAG 2.1 AA target |
| Platform | Mobile-first web (React 19 + TypeScript 5.8) |

---

## Competitive Differentiation

Expect this question from judges: *"Why not just use Google Maps, survey tools, or satellite data?"*

**vs. Google Maps / OpenStreetMap:**
Google Maps shows that a fuel station exists. African Data Layer tells you if it has fuel today, what the price per litre is in XAF, whether it has a functioning ATM, and how long the queue is. This is the difference between a map and market intelligence.

**vs. Survey tools (KoboToolbox, ODK):**
Survey tools are one-shot data collection with no fraud detection, no continuous update mechanism, no deduplication, and no confidence scoring. They produce snapshots; we produce a living data layer. Our agents are incentivized to return and update stale data — survey tools are not designed for this.

**vs. Satellite imagery:**
Satellites can see rooftops. They cannot see whether a mobile money agent has float, whether a pharmacy is licensed, or whether a road is passable. Ground truth requires people on the ground.

**vs. Market research firms:**
A traditional data report on Douala takes 3–6 months and costs tens of thousands of dollars. Our platform produces updated, fraud-verified data continuously, at a fraction of the cost, with transparent data provenance.

**Our unique advantages:**
1. **Fraud-verified crowdsourcing** — multi-layer automated detection prevents data poisoning at scale
2. **Offline-first resilience** — data collection survives the connectivity reality of African cities
3. **Cameroonian-rooted** — built by and for the communities it serves, not imported and adapted
4. **Continuous updates** — staleness thresholds per vertical (3 days for fuel prices, 30 days for buildings) ensure data stays current
5. **Agent compensation infrastructure** — XP and rewards align incentives; agents profit when data quality is high

---

## If Selected: Summit Presentation Tips

You will have a live showcase opportunity at the Kenya Cultural Centre – Norfolk, Nairobi on May 11, 2026. Here is what to prepare:

**Live demo checklist:**
- [ ] Load the agent app on a real Android phone (not a laptop simulation)
- [ ] Have a pre-loaded submission ready to show the capture flow (photo, geolocation, field selection)
- [ ] Show the admin queue with a real submission in review — demonstrate the EXIF forensics panel
- [ ] Show the client analytics dashboard with the delta report (new/changed/removed points)
- [ ] Have the leaderboard loaded to demonstrate agent gamification

**Slide deck structure (5–7 slides max):**
1. The problem — one slide, one number, one human face
2. The solution — show the app, not a diagram of the app
3. Why now, why Africa, why us — the urgency and the team
4. Traction — pilot data, agent count, submissions collected
5. The ask — specific investment amount, specific use of funds, specific milestone

**Anticipated judge questions:**
- How do you prevent agents from fabricating data? → EXIF extraction, GPS velocity checks, trust tier system
- Who pays for this? → Data API subscriptions from fintechs, FMCG, development finance institutions
- Why Cameroon first? → Francophone Africa is underserved; Douala is the economic capital with 3.5M people and the largest informal market in Central Africa
- How do you scale beyond Cameroon? → Same platform, add city geofences, recruit local agent coordinators; the vertical system is already abstracted
- What is the data worth? → One city survey from a consultancy costs $50K+; our API subscription is a fraction of that with daily updates

---

## Action Items Before April 23

- [ ] Complete team profile section (names, ages, nationalities, backgrounds)
- [ ] Finalize investment ask amounts (fill in the [your specific figure] placeholders)
- [ ] Prepare 2–3 screenshots or a short screen recording of the live app for the application
- [ ] Write a one-paragraph team bio that emphasizes Cameroonian roots and local expertise
- [ ] Calculate current pilot metrics (number of submissions, agents, locations mapped) to include as concrete traction numbers
- [ ] Identify the 2 team members who will attend if selected (summit allows max 2 per startup)
- [ ] Submit before **April 23, 2026 at 5:00 PM East Africa Time (EAT)** at novagarage.africa/apply

---

*Compiled April 8, 2026 | For use by African Data Layer founding team | Internal reference only*
