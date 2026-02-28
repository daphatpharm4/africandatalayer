# ADL Marketing Strategy & Growth Playbook

**Author:** Teammate 7 -- Marketing Genius
**Date:** 2026-02-28
**Status:** Living document -- updates with each growth phase
**Predecessors:**
- [01-cloud-architecture.md](./01-cloud-architecture.md) (Cloud Architect)
- [06-data-analytics.md](./06-data-analytics.md) (Data Analyst)
- [pitch-one-pager-kasi-insight.md](../pitch-one-pager-kasi-insight.md) (Kasi Insight meeting context)

**Scope:** Ideal customer profiles, personas, positioning, channel strategy, growth metrics, 90-day playbook, and content strategy for African Data Layer

---

## Table of Contents

1. [Ideal Customer Profiles (ICPs)](#1-ideal-customer-profiles-icps)
2. [Personas](#2-personas)
3. [Positioning & Messaging](#3-positioning--messaging)
4. [Channel Strategy & Experiments](#4-channel-strategy--experiments)
5. [Growth Metrics & Funnel](#5-growth-metrics--funnel)
6. [Growth Playbook (First 90 Days)](#6-growth-playbook-first-90-days)
7. [Content Strategy](#7-content-strategy)

---

## 1. Ideal Customer Profiles (ICPs)

### ICP 1 -- Data Consumers (B2B Buyers)

These are the organizations that pay for ADL data. Each sub-segment has distinct pain points, budgets, and buying triggers. The Kasi Insight meeting confirmed: the highest-value buyers are those who need **consistent deltas** -- tracking what changed in the retail/service landscape month-over-month.

---

#### ICP 1a: FMCG & Beverage Companies (Retail Audit Buyers)

| Field | Detail |
|---|---|
| **Examples** | Guinness Cameroun, SABC (Societe Anonyme des Brasseries du Cameroun), Diageo Africa, Nestle CWAR, Unilever Cameroon |
| **Pain point** | After selling to grossistes (wholesalers), they lose visibility on where products end up. They cannot track distribution penetration, competitor shelf presence, or new informal retail points. Current retail audit providers (Nielsen, Kantar) are expensive and operate at macro level. |
| **Buying trigger** | Quarterly business review reveals distribution gaps; competitor launches new product and they cannot measure speed-to-shelf; marketing team needs billboard traffic data for ad spend optimization |
| **Budget** | $2,000-$15,000/month for ongoing data feeds; $5,000-$25,000 for one-time retail landscape snapshots |
| **Decision maker** | Country Commercial Director or Head of Trade Marketing |
| **Champion** | Field Sales Manager or Distribution Analytics Lead |
| **Data they need** | Retail point locations, product availability by SKU, competitor presence, informal vs formal outlet classification, month-over-month deltas |
| **Frequency** | Monthly or quarterly snapshots with delta reporting |

---

#### ICP 1b: Fintech & Mobile Money Operators

| Field | Detail |
|---|---|
| **Examples** | MTN MoMo, Orange Money, Wave, Flutterwave, MFS Africa, Afriland First Bank (digital expansion) |
| **Pain point** | Expanding agent networks without reliable data on existing coverage. Cannot identify underserved neighborhoods or agent density gaps. Competitor agent mapping is done manually by field teams at high cost. |
| **Buying trigger** | Entering new city or neighborhood; agent churn spikes and they need to understand coverage gaps; regulator requires agent density reporting |
| **Budget** | $1,000-$8,000/month for API access; $10,000-$50,000 for city-level coverage maps |
| **Decision maker** | Head of Agent Network / VP Distribution |
| **Champion** | Product Manager (Growth) or Business Intelligence Analyst |
| **Data they need** | Mobile money agent locations, operating hours, services offered (cash-in/cash-out, bill pay), competitor agent proximity, agent density per neighborhood |
| **Frequency** | Weekly to monthly updates |

---

#### ICP 1c: Logistics & Delivery Companies

| Field | Detail |
|---|---|
| **Examples** | Gozem, Yango (Douala operations), Glovo Cameroon, DHL Africa last-mile, Jumia Logistics, Bolore Transport & Logistics |
| **Pain point** | Route planning fails because maps show roads that do not exist or miss roads that do. Point-of-delivery data is inaccurate. Driver ETAs are unreliable because landmark-based navigation depends on knowing what is actually at each corner. |
| **Buying trigger** | Launching in new city; delivery failure rate exceeds 15%; driver complaint data shows navigation issues |
| **Budget** | $500-$5,000/month for API access; usage-based pricing preferred |
| **Decision maker** | Head of Operations or CTO |
| **Champion** | Engineering Lead or Operations Analyst |
| **Data they need** | POI locations with landmarks, operating hours, accessibility notes, road-level validation |
| **Frequency** | Real-time or weekly updates |

---

#### ICP 1d: NGOs, Development Agencies & Government

| Field | Detail |
|---|---|
| **Examples** | UNICEF, WHO (pharmacy/health mapping), GIZ, AFD (Agence Francaise de Developpement), World Bank Digital Development, Cameroon Ministry of Health, Institut National de la Statistique |
| **Pain point** | Census data is 5-10 years old. Health facility registers are incomplete. Cannot plan intervention programs without knowing where pharmacies, clinics, and essential services actually operate today. |
| **Buying trigger** | New program launch (e.g., vaccine distribution); disaster response planning; regulatory mandate to update service registries |
| **Budget** | $10,000-$100,000 per project (grant-funded, procurement cycles 3-6 months) |
| **Decision maker** | Country Director or Program Manager |
| **Champion** | M&E (Monitoring & Evaluation) Officer or Data/GIS Specialist |
| **Data they need** | Health service point locations, formal vs informal classification, service availability, population catchment estimates |
| **Frequency** | Quarterly snapshots or project-based deliveries |

---

### ICP 2 -- Field Contributors (Supply Side)

Contributors are the engine of ADL. Per the analytics framework (doc 06), Phase 1 targets 20 Weekly Active Contributors (WAC) with D7 retention >= 20%. Each contributor sub-segment has distinct motivations and constraints.

---

#### ICP 2a: University Students

| Field | Detail |
|---|---|
| **Examples** | Students at Universite de Douala, ESSEC (Ecole Superieure des Sciences Economiques et Commerciales), IUT Douala, Universite de Yaounde I |
| **Motivation** | Extra income (primary), CV building, tech-savviness, social status among peers. In Cameroon, monthly student budget is 30,000-80,000 FCFA ($45-$125); even 5,000-10,000 FCFA/month ($8-$16) from ADL is meaningful. |
| **Typical device** | Android (Tecno, Itel, Samsung A-series), 1-2 GB RAM, shared data bundles of 500 MB-2 GB/month |
| **Connectivity** | 3G/4G on campus, spotty in residential areas. Offline-first is critical. |
| **Daily routine** | Classes 8am-2pm, free afternoons, active on WhatsApp/Facebook, commute through commercial neighborhoods |
| **Acquisition channel** | WhatsApp groups, campus ambassadors, word-of-mouth, university digital boards |

---

#### ICP 2b: Gig Workers & Moto-Taxi Drivers

| Field | Detail |
|---|---|
| **Examples** | Bendskin (moto-taxi) riders in Douala, delivery couriers, freelance artisans |
| **Motivation** | Supplemental income during idle time between rides/jobs. Already navigate the city daily and know every corner. |
| **Typical device** | Low-end Android (Tecno Pop, Itel A-series), often shared phone or secondary device |
| **Connectivity** | Intermittent 2G/3G while moving. Offline queue (IndexedDB with exponential backoff per doc 01) is essential. |
| **Daily routine** | On the road 6am-8pm, idle waiting periods at taxi stands, familiar with fuel stations and mobile money points |
| **Acquisition channel** | Fuel station flyers, moto-taxi stand ambassadors, WhatsApp driver groups |

---

#### ICP 2c: Mobile Money Agents & Small Business Owners

| Field | Detail |
|---|---|
| **Examples** | MTN MoMo agents, Orange Money agents, pharmacie vendeuses, boutique owners |
| **Motivation** | Enrich data about their own business for visibility (free marketing), earn rewards, competitive intelligence on nearby agents. The Kasi meeting flagged that mobile money agents already track competitor locations informally. |
| **Typical device** | Mid-range Android (Tecno Spark, Samsung A-series), dedicated business phone |
| **Connectivity** | Fixed location, usually 3G/4G, data plans of 2-5 GB/month |
| **Daily routine** | Stationary at their kiosk 7am-7pm, slow periods mid-morning and mid-afternoon, strong neighborhood social networks |
| **Acquisition channel** | Direct outreach at their kiosk, agent network WhatsApp groups, church/community announcements |

---

#### ICP 2d: Community Leaders & Local Entrepreneurs

| Field | Detail |
|---|---|
| **Examples** | Neighbourhood chiefs (chefs de quartier), church group leaders, market association presidents, NGO community health workers |
| **Motivation** | Community development, social proof/status, ability to mobilize others. They are force multipliers -- one community leader can recruit 5-10 active contributors. |
| **Typical device** | Varies widely, often mid-range Android |
| **Connectivity** | Varies, but they have strong offline social networks |
| **Daily routine** | Community meetings, market visits, church activities. Deep local knowledge. |
| **Acquisition channel** | Direct in-person relationship building, community group presentations, referral from existing contributors |

---

### ICP 3 -- Investors & Partners

---

#### ICP 3a: Impact Investors & Development Finance

| Field | Detail |
|---|---|
| **Examples** | Catalyst Fund, Village Capital, GSMA Innovation Fund, Digital Africa, Proparco, IFC (World Bank Group), Orange Ventures Africa |
| **Interest** | Infrastructure plays that improve data availability across Africa. Financial inclusion, health access, and urban planning alignment. |
| **Buying trigger** | ADL demonstrates consistent data quality metrics (freshness < 14 days, verification rate > 30%) with a clear path to $500K ARR. |
| **What they need to see** | Unit economics (cost per verified data point), retention cohorts, B2B pipeline, defensibility of data moat |

---

#### ICP 3b: Tech Accelerators & Ecosystem Partners

| Field | Detail |
|---|---|
| **Examples** | Y Combinator (data infrastructure track), Techstars (African programs), Google for Startups Africa, Flat6Labs, ActivSpaces Douala |
| **Interest** | Scalable platform models with network effects. ADL's two-sided marketplace (contributors + data buyers) fits this. |
| **Partnership value** | Mentorship, B2B introductions, credibility signal, follow-on funding connections |

---

## 2. Personas

### Persona 1: Amina Tchinda -- The University Contributor

| Field | Detail |
|---|---|
| **Age** | 21 |
| **Location** | Bonamoussadi, Douala. Lives in a shared room near Universite de Douala campus. |
| **Device** | Tecno Spark 8, Android 11, 2 GB RAM. Buys 1 GB MTN data bundles for 1,000 FCFA (~$1.60). |
| **Language** | French (primary), English (conversational). Uses phone in French. |
| **Monthly budget** | 50,000 FCFA ($80) from family remittances. Needs 10,000-15,000 FCFA more to cover transport and food. |
| **Goals** | Earn consistent side income without conflicting with class schedule. Build a portfolio of tech-related work for future job applications. Get recognized among peers as someone who knows the neighborhood well. |
| **Frustrations** | Most "earn money with your phone" apps are scams or pay after weeks of delay. Data bundles run out quickly if apps are data-hungry. Apps that crash on her phone or drain battery are immediately deleted. |
| **How she discovers ADL** | Her friend Serge, a campus ambassador, posts in their department WhatsApp group: "Gagnez 5,000 FCFA/semaine en mappant les pharmacies de Bonamoussadi." She clicks the link during a boring lecture. |
| **First experience** | Opens the PWA, signs up with Google in 30 seconds. Sees the map centered on Bonamoussadi with nearby pharmacies. Contributes data about the pharmacy next to her lecture hall. Earns 5 XP immediately. Feels a small dopamine hit. |
| **What makes her stay** | Weekly XP leaderboard where she competes with Serge. Consistent payouts every Friday. The app works when her data runs out (offline mode). She can contribute during her walk from campus to her room. |
| **What makes her leave** | Payout delays beyond 48 hours. App starts eating her data bundle. XP rewards feel meaningless (no real-world redemption). A newer, shinier earning app launches. |
| **Lifetime value to ADL** | 15-25 verified contributions/month for 4-6 months. If retained through one academic year, she becomes a campus ambassador recruiting 3-5 others. |

---

### Persona 2: Emmanuel Nkeng -- The Mobile Money Agent

| Field | Detail |
|---|---|
| **Age** | 34 |
| **Location** | Carrefour Ange Raphael, Bonamoussadi. Runs an MTN MoMo kiosk. |
| **Device** | Samsung Galaxy A13, Android 12, dedicated business phone. 3 GB Orange data plan. |
| **Language** | French (primary), Pidgin English (with customers), basic English. |
| **Monthly income** | 120,000-180,000 FCFA ($190-$290) from MoMo commissions. Good months hit 200,000 FCFA. |
| **Goals** | Understand where competitor Orange Money agents are opening nearby. Get his kiosk to appear on any map or directory customers might search. Know which hours are slowest so he can do ADL contributions during downtime. |
| **Frustrations** | New MoMo agents open next to him and cut into his business. No way to see a map of the agent landscape. Google Maps does not show most MoMo kiosks. He suspects some nearby "agents" are fraudulent (unregistered). |
| **How he discovers ADL** | An ADL field coordinator visits his kiosk during a slow afternoon and explains: "We are mapping all the mobile money agents in Bonamoussadi. You can list your kiosk for free and earn rewards for mapping others around you." |
| **First experience** | He maps his own kiosk in 2 minutes. Sees it appear on the ADL map with a verified badge. Immediately wants to map the three competitor agents within 200 meters. |
| **What makes him stay** | His kiosk gets visibility. He earns 2,000-3,000 FCFA/week mapping nearby businesses during slow hours. He becomes the neighborhood data expert and other agents ask him about ADL. |
| **What makes him leave** | If competitor data he contributes somehow benefits his competitors more than him. If rewards stop. If the app requires too much data/bandwidth. |
| **Lifetime value to ADL** | 8-12 enrichment events/month with very high accuracy (he knows these businesses personally). Key referral node for 5-10 other agents. His data about operating hours, services, and competitor presence is among the highest-quality ADL receives. |

---

### Persona 3: Fatou Diallo -- The Logistics Startup PM

| Field | Detail |
|---|---|
| **Age** | 29 |
| **Location** | Dakar, Senegal (ADL future market). Works remotely 2 days/week, office in Plateau district 3 days. |
| **Device** | MacBook Pro (work), iPhone 14 (personal). Company Slack, Notion, Google Workspace. |
| **Role** | Product Manager at a last-mile delivery startup operating in Douala, Dakar, and Abidjan. |
| **Goals** | Reduce delivery failure rate from 18% to under 10%. Build a reliable POI database so drivers can navigate using landmarks ("next to the Total station on Rue de la Joie") instead of unreliable street addresses. |
| **Frustrations** | Google Maps data in Douala is 2+ years stale. OpenStreetMap coverage is patchy and unmaintained. Her engineering team spent 3 months building an internal POI system that only covers 30% of their delivery zones. Hiring field teams to map cities is expensive ($3,000-$5,000 per city). |
| **How she discovers ADL** | Searches "hyperlocal POI data Africa API" on Google. Finds an ADL blog post ranking for "pharmacy locations Douala API." Clicks through to the API docs. |
| **First experience** | Signs up for the free developer tier. Makes a GET request to `/api/points?category=pharmacy&lat=4.05&lng=9.74&radius=2000`. Gets back 47 verified pharmacies with coordinates, names, and operating hours. Realizes this would have taken her field team 2 weeks to collect. |
| **What makes her stay** | Data freshness (median < 14 days vs. her internal data at 90+ days stale). API reliability. Coverage expanding into her other operating cities. Clear pricing that scales with usage. |
| **What makes her leave** | Data quality drops (stale points, incorrect coordinates). API goes down during business hours. Pricing jumps unpredictably. Coverage does not expand to her priority cities. |
| **Lifetime value to ADL** | $1,500-$3,000/month API subscription. Introduces ADL to 2-3 other startup PMs in her network. Provides feature requests that improve the product for all B2B customers. |

---

### Persona 4: Thierry Mbarga -- The Fintech Product Manager

| Field | Detail |
|---|---|
| **Age** | 32 |
| **Location** | Lagos, Nigeria. His company is expanding mobile lending product to Cameroon. |
| **Device** | MacBook Air (work), Samsung Galaxy S23 (personal). Uses Linear, Figma, Mixpanel daily. |
| **Role** | Senior Product Manager at a Series B fintech. Tasked with launching in Cameroon within 6 months. |
| **Goals** | Map the financial services landscape in Douala and Yaounde before launch. Identify underserved areas where their lending product would have the highest demand. Understand mobile money agent density to plan cash-out partnerships. |
| **Frustrations** | Cameroon market data is scarce compared to Nigeria or Kenya. His team's Cameroon market research cost $15,000 and delivered a PDF with data from 2023. He needs granular, current, neighborhood-level data, not country-level reports. |
| **How he discovers ADL** | A LinkedIn post from a Cameroon tech ecosystem account mentions ADL. His Head of Expansion forwards it with "This could save us the field research budget." |
| **First experience** | Books a demo call. ADL shows him a live dashboard of mobile money agent density in Bonamoussadi with weekly freshness. He compares it to his $15,000 market research report and sees 3x more data points at neighborhood level. |
| **What makes him stay** | ADL expands to Yaounde and other Cameroon cities on a timeline that matches his launch roadmap. Custom data packages tailored to financial services use case. Responsive account management. |
| **What makes him leave** | Coverage limited to one neighborhood. No SLA on data freshness. Cannot get custom fields (e.g., agent float levels, transaction volume proxies). |
| **Lifetime value to ADL** | $3,000-$8,000 for initial market entry dataset. $1,500-$3,000/month ongoing subscription. Enterprise contract potential at $20,000-$50,000/year as they scale Cameroon operations. |

---

### Persona 5: Carine Mengue -- The Development Agency Program Officer

| Field | Detail |
|---|---|
| **Age** | 38 |
| **Location** | Yaounde, Cameroon. Works at a bilateral development agency (GIZ or AFD). |
| **Device** | Lenovo ThinkPad (work), iPhone 12 (personal). Uses Outlook, Teams, Power BI. |
| **Role** | Program Officer for Health Systems Strengthening. Manages a $2M program to improve pharmaceutical distribution in Littoral and Centre regions. |
| **Goals** | Map every pharmacy (formal and informal) in target regions. Understand supply chain gaps: which neighborhoods lack access to essential medicines. Report to headquarters with data-backed evidence of program impact. |
| **Frustrations** | The Ministry of Health pharmacy register was last updated in 2019. Informal pharmacies (vendeurs ambulants) are completely invisible in official data. Hiring a survey firm costs $30,000-$50,000 and takes 4 months. By the time data arrives, it is already stale. |
| **How she discovers ADL** | Attends a GIZ innovation day in Yaounde where ADL presents. Or, her M&E consultant recommends ADL after seeing the Bonamoussadi pharmacy dataset. |
| **First experience** | Requests a sample dataset for Bonamoussadi pharmacies. Receives 85 verified points with formal/informal classification, product categories, and operating hours. Compares to the Ministry register (which shows 12 pharmacies for the same area). The gap is immediately compelling. |
| **What makes her stay** | Data quality reporting (verification rate, freshness score). Ability to track deltas month-over-month ("15 new informal pharmacies appeared in Q2"). Compliance with development agency data standards. French-language reports and dashboards. |
| **What makes her leave** | Cannot guarantee data provenance (who collected it, when, how verified). No formal/informal classification methodology. Pricing requires procurement process that ADL cannot accommodate. |
| **Lifetime value to ADL** | $15,000-$40,000 per project contract (1-2 projects/year). Introduces ADL to 3-4 other program officers. Provides legitimacy signal for other institutional buyers. Multi-year program renewals if data proves useful for impact reporting. |

---

## 3. Positioning & Messaging

### 3.1 Positioning Statements

**For Contributors:**

> African Data Layer turns your local knowledge into real income. Walk your neighborhood, map the businesses you already know, and earn weekly rewards -- even when your internet is off.

*French:*

> African Data Layer transforme vos connaissances locales en revenus reels. Parcourez votre quartier, cartographiez les commerces que vous connaissez deja, et gagnez des recompenses chaque semaine -- meme sans connexion internet.

---

**For Data Buyers (B2B):**

> African Data Layer delivers verified, continuously refreshed point-of-interest data for African cities -- built by thousands of local contributors, validated by automated fraud detection, and accessible via a simple API. Stop making decisions with stale maps.

*French:*

> African Data Layer fournit des donnees de points d'interet verifiees et actualisees en continu pour les villes africaines -- collectees par des milliers de contributeurs locaux, validees par detection automatique de fraude, et accessibles via une API simple. Arretez de prendre des decisions avec des cartes obsoletes.

---

**For Investors:**

> African Data Layer is building the ground-truth data infrastructure for Africa's essential services. Our crowdsourced, offline-first platform creates a compounding data moat: every contribution makes the dataset more valuable, every new data buyer funds more contributors, and every new city creates network effects that are expensive to replicate.

---

### 3.2 Tagline Options

| # | English | French |
|---|---------|--------|
| 1 | **Map your city. Earn real rewards.** | **Cartographiez votre ville. Gagnez de vraies recompenses.** |
| 2 | **Africa's ground truth, updated daily.** | **La verite terrain de l'Afrique, actualisee chaque jour.** |
| 3 | **Your neighborhood knowledge has value.** | **Vos connaissances de quartier ont de la valeur.** |
| 4 | **Fresh data for Africa. Built by Africa.** | **Des donnees fraiches pour l'Afrique. Construites par l'Afrique.** |
| 5 | **The data layer Africa was missing.** | **La couche de donnees qui manquait a l'Afrique.** |

**Recommended primary tagline:** Option 3 for contributor acquisition (emotional, personal, validates their existing knowledge). Option 5 for B2B and investor audiences (positions ADL as infrastructure).

---

### 3.3 Value Proposition Canvas

#### Segment A: Contributors

| Component | Detail |
|---|---|
| **Jobs to be done** | Earn supplemental income with flexible hours. Build marketable skills. Gain social recognition in their community. |
| **Pains** | Most mobile earning apps are scams or pay too little. Data bundles are expensive and most apps waste them. No way to monetize local knowledge. Unemployment or underemployment, especially for students. |
| **Gains** | Weekly payouts in mobile money (FCFA). Visible progress (XP, leaderboard ranking). Works offline -- does not eat data bundles. Takes 2-3 minutes per contribution (fits into any routine). Community recognition as a "data ambassador." |
| **Pain relievers (ADL)** | Offline-first design (IndexedDB queue syncs when connectivity returns). Lightweight PWA (<500 KB initial load). Transparent XP system (5 XP per event, visible immediately). Weekly payout cycle, not monthly. |
| **Gain creators (ADL)** | Leaderboard competition. Campus ambassador program with elevated status. Referral bonuses. Skill certification ("ADL Verified Data Collector") for CV. |

#### Segment B: Data Buyers

| Component | Detail |
|---|---|
| **Jobs to be done** | Make location-based business decisions with confidence. Enter new African markets with reliable data. Track competitive landscape changes over time. |
| **Pains** | Google Maps and OSM data in Africa is stale, incomplete, and unverified. Hiring field survey teams is slow ($3K-$5K/city) and one-time (data decays immediately). Existing data providers operate at macro level (country/region), not micro (neighborhood). |
| **Gains** | Always-fresh POI data (median freshness < 14 days). Neighborhood-level granularity. Structured data with consistent schema. API-first access that integrates into existing workflows. Month-over-month delta reporting. |
| **Pain relievers (ADL)** | Crowdsourced data keeps costs 80% below traditional field surveys. Automated fraud detection ensures quality without manual review bottleneck. Event-sourcing model provides full data provenance. |
| **Gain creators (ADL)** | Custom data packages by category, geography, and refresh frequency. Delta reporting (the Kasi meeting confirmed: "capture the delta and report on it" is the highest-value output). Dashboard access for non-technical users. Formal/informal classification that no other provider offers. |

#### Segment C: Investors

| Component | Detail |
|---|---|
| **Jobs to be done** | Find scalable infrastructure businesses with defensible moats in Africa. Deploy capital into impact-aligned ventures. |
| **Pains** | Most African data startups fail to achieve data quality at scale. Two-sided marketplaces are hard to bootstrap. Unit economics in low-income markets are unproven. |
| **Gains** | Clear path from Bonamoussadi proof-of-concept to city-by-city expansion. Compounding data moat (more contributors = better data = more buyers = more revenue = more contributors). Impact alignment (health access, financial inclusion, urban planning). |
| **Pain relievers (ADL)** | Automated fraud detection reduces cost of quality assurance. Offline-first architecture solves the hardest technical problem upfront. Event-sourcing provides auditable data lineage that institutional buyers require. |
| **Gain creators (ADL)** | Network effects create winner-take-most dynamics per city. Multiple revenue streams (API subscriptions, enterprise deals, project-based contracts). Expansion playbook replicable to any African city. |

---

### 3.4 Competitive Differentiation

| Dimension | ADL | OpenStreetMap | Google Maps | Proprietary Surveys (Nielsen, Kantar) | Other Crowdsourcing (Premise, mSurvey) |
|---|---|---|---|---|---|
| **Data freshness** | Median < 14 days (target). Continuous contributor updates. | Years-stale in most African neighborhoods. Volunteer-dependent. | Updated irregularly. Street View cars visit African cities rarely. | Quarterly at best. Data delivered as static PDF reports. | Project-based. Data stops flowing when contracts end. |
| **Informal sector coverage** | Core strength. Contributors map informal pharmacies, unlicensed MoMo agents, roadside fuel sellers. | Almost zero informal coverage. OSM mappers focus on physical structures. | Does not index informal businesses. | Samples formal sector only. | Some coverage, but question-driven (not spatial). |
| **Offline capability** | Offline-first (IndexedDB queue with exponential backoff). Works on 2G. | Editing requires connectivity. | Requires connectivity for all updates. | Paper-based field collection, then manual digitization. | Most require connectivity. |
| **Cost per data point** | $0.05-$0.15 (contributor incentive + platform cost) | Free (volunteer labor) but unreliable supply | N/A (Google's internal cost) | $2-$10 per data point (field enumerator salary + logistics) | $0.50-$2.00 per survey response |
| **Data provenance** | Full event log: who, when, where, what device, fraud score | Edit history available but unstructured | Opaque | Enumerator ID tracked but not publicly verifiable | Survey-level tracking |
| **Delta reporting** | Built-in: month-over-month changes in POI landscape | Not a product feature | Not available | Expensive add-on service | Not standard |
| **API access** | REST API, real-time | Overpass API (complex, raw) | Places API (expensive at scale) | Custom data delivery (FTP/email) | API available but project-scoped |

**ADL's defensible advantages:**
1. **Informal sector data** -- Nobody else systematically collects it.
2. **Continuous freshness** -- Incentivized contributors keep data alive; surveys and OSM do not.
3. **Delta reporting** -- The Kasi meeting confirmed this is the highest-value output: "capture the delta and report on it." ADL's event-sourcing model makes delta computation native.
4. **Offline-first** -- Technical moat that is hard to retrofit into existing platforms.
5. **Local contributor network** -- Once built in a neighborhood, the contributor community is a defensible asset.

---

### 3.5 Messaging Framework by Channel & Audience

| Channel | Audience | Primary Message | Tone | CTA |
|---|---|---|---|---|
| **WhatsApp group** | Students, gig workers | "Gagnez de l'argent en marchant dans votre quartier. 5 min = 250 FCFA." | Casual, peer-to-peer, French/Pidgin | "Cliquez ici pour commencer" (link to PWA) |
| **Facebook/Instagram ad** | Young adults in Douala | "Vos voisins gagnent deja de l'argent avec ADL. Et vous?" | Social proof, FOMO, visual (screenshot of earnings) | "Telecharger maintenant" |
| **LinkedIn post** | Fintech/logistics PMs | "We mapped 200+ pharmacies in one Douala neighborhood in 3 weeks. Our API delivers what Google Maps cannot: verified, fresh, informal-sector data." | Professional, data-driven | "Request API access" |
| **Twitter/X thread** | Data/tech community | "Why is African POI data so broken? A thread. (1/8)" | Educational, provocative | "Follow us for updates" |
| **Conference talk** | Enterprise buyers, investors | "The retail audit industry charges $10/data point. We do it for $0.10 with better freshness. Here is how." | Authoritative, numbers-driven | "Book a demo at our booth" |
| **Radio spot** | General Douala population | "Vous connaissez votre quartier mieux que Google. Avec African Data Layer, cette connaissance vous rapporte de l'argent. Inscrivez-vous gratuitement." | Warm, local, spoken French | "Demandez a votre ami qui utilise deja ADL" |
| **Campus poster** | University students | "WANTED: Data Ambassadors. 10,000 FCFA/semaine. Aucune experience requise." | Bold, job-listing style | QR code to signup |
| **Email (B2B)** | Data buyer prospects | Subject: "Your Douala data is 2 years old. Ours is 2 weeks old." | Direct, value-proposition-first | "See sample data for your city" |

---

## 4. Channel Strategy & Experiments

### 4.1 Digital Channels

---

#### Experiment D1: WhatsApp Community (Bonamoussadi Contributors)

| Field | Detail |
|---|---|
| **Hypothesis** | A moderated WhatsApp community with weekly challenges and leaderboard updates will achieve 50 signups in 2 weeks, with 40% making their first contribution within 48 hours. |
| **Experiment design** | Create a WhatsApp Community with 3 sub-groups: (1) General announcements, (2) Bonamoussadi contributors, (3) Q&A/support. Seed with 10 early contributors. Post daily: morning challenge ("Map 3 pharmacies today and earn bonus XP"), evening leaderboard screenshot. Share payment proof screenshots weekly. |
| **Budget** | 0 FCFA (organic). Moderator time: 1 hour/day. |
| **Timeline** | Weeks 1-4 (ongoing) |
| **Success metric** | 50 members joined, 20 first contributions, 10 active by week 2 |
| **Decision criteria** | Continue if 40%+ of joiners make first contribution. Scale to Yaounde if D7 retention > 20%. Kill if fewer than 10 contributions in first week. |

---

#### Experiment D2: Facebook/Instagram Ads (Douala Youth)

| Field | Detail |
|---|---|
| **Hypothesis** | Targeted ads showing earnings proof (screenshot of XP balance + payout) will generate signups at < 500 FCFA ($0.80) cost per signup, with > 25% activation rate. |
| **Experiment design** | Three ad variants: (A) "Gagnez 5,000 FCFA/semaine" with earnings screenshot, (B) "Vos voisins mappent leur quartier et gagnent de l'argent" with contributor photo, (C) "Etudiant? Gagne de l'argent entre tes cours" with campus context. Target: ages 18-30, Douala, interests in technology/mobile money/freelancing. Budget split equally across 3 variants for 7 days, then scale the winner. |
| **Budget** | 50,000 FCFA ($80) for initial 2-week test. Scale to 200,000 FCFA ($320) if unit economics work. |
| **Timeline** | Weeks 3-6 |
| **Success metric** | 100 signups, 25 activated (first contribution), CPA < 500 FCFA |
| **Decision criteria** | Scale winning variant 3x if CPA < 500 FCFA and activation > 25%. Pause if CPA > 1,000 FCFA. Test new creatives if activation < 15%. |

---

#### Experiment D3: Twitter/X for B2B Awareness

| Field | Detail |
|---|---|
| **Hypothesis** | A weekly thread on African data infrastructure challenges will generate 5 inbound B2B inquiries within 60 days. |
| **Experiment design** | Publish 2 threads/week: one educational ("Why Africa's POI data is broken"), one data-driven ("We mapped 200 pharmacies in Bonamoussadi -- here is what we found"). Tag relevant accounts (AfricaTechSummit, GSMA, local tech influencers). Engage in replies to logistics/fintech discussions. |
| **Budget** | 0 FCFA (organic). Content creation: 3 hours/week. |
| **Timeline** | Weeks 1-12 (ongoing) |
| **Success metric** | 500 followers, 5 B2B DM inquiries, 2 demo calls booked |
| **Decision criteria** | Continue if generating 1+ inbound inquiry/month. Invest in Twitter ads if organic engagement rate > 3%. |

---

#### Experiment D4: LinkedIn for Enterprise & Investors

| Field | Detail |
|---|---|
| **Hypothesis** | Direct outreach to 50 relevant decision-makers (logistics ops leads, fintech expansion PMs, development agency M&E officers) will generate 10 demo calls within 30 days. |
| **Experiment design** | Week 1: Build target list of 50 prospects from ICP 1a-1d. Week 2-3: Send personalized connection requests with 2-line value prop. Week 3-4: Follow up with sample data offer. Simultaneously: publish 1 article/week on LinkedIn about ADL insights (e.g., "How many pharmacies are in Bonamoussadi? The answer might surprise you"). |
| **Budget** | LinkedIn Sales Navigator: $79.99/month. Content creation: 2 hours/week. |
| **Timeline** | Weeks 5-12 |
| **Success metric** | 30% connection acceptance rate, 10 demo calls, 2 pilot agreements |
| **Decision criteria** | Scale outreach to 200 prospects if conversion to demo > 15%. Hire part-time SDR if pipeline exceeds founder capacity. |

---

#### Experiment D5: University Digital Boards

| Field | Detail |
|---|---|
| **Hypothesis** | Digital announcements on university intranets/Facebook groups will drive 20 signups per campus at zero cost. |
| **Experiment design** | Partner with student associations at Universite de Douala, ESSEC, and IUT. Post in official Facebook groups with association endorsement. Format: "Programme Ambassadeur ADL -- Gagnez de l'argent en cartographiant votre campus." |
| **Budget** | 0 FCFA. Relationship-building time with student association leaders. |
| **Timeline** | Weeks 3-4 |
| **Success metric** | 20 signups per campus, 10 activated |
| **Decision criteria** | Roll out to 5 more campuses if activation > 30%. |

---

#### Experiment D6: TikTok for Young Contributor Recruitment

| Field | Detail |
|---|---|
| **Hypothesis** | Short-form video content showing the contribution workflow (walk, photograph, submit, earn) will generate 30 signups from organic reach within 4 weeks. |
| **Experiment design** | Create 5 TikTok videos: (1) "Day in the life of an ADL contributor," (2) "I earned 5,000 FCFA walking to class," (3) "POV: you discover your neighborhood has 47 pharmacies," (4) "How to map a MoMo agent in 60 seconds," (5) "My ADL earnings this week." Post 3x/week. Use trending sounds and local French/Pidgin. |
| **Budget** | 0 FCFA (organic). Video production: 2 hours/week using phone camera. |
| **Timeline** | Weeks 3-8 |
| **Success metric** | 30 signups traceable to TikTok (UTM parameter), 5,000 views on top video |
| **Decision criteria** | Invest in paid TikTok promotion if organic CPA < 1,000 FCFA equivalent. |

---

### 4.2 Offline Channels

---

#### Experiment O1: Campus Ambassador Program

| Field | Detail |
|---|---|
| **Hypothesis** | 5 campus ambassadors, each incentivized to recruit 10 contributors, will deliver 50 active contributors in Bonamoussadi within 3 weeks. |
| **Experiment design** | Recruit 5 top-performing early contributors. Give each a target: 10 recruits who make at least 3 contributions each. Compensation: 2,000 FCFA per qualified recruit (paid when recruit reaches 3 contributions). Ambassadors get ADL-branded T-shirts and "Data Ambassador" title in-app. Weekly standup via WhatsApp voice note. |
| **Budget** | 100,000 FCFA ($160) for ambassador payouts. 50,000 FCFA ($80) for T-shirts (10 units). Total: 150,000 FCFA ($240). |
| **Timeline** | Weeks 3-6 |
| **Success metric** | 50 new contributors activated (>= 3 contributions each) |
| **Decision criteria** | Scale to 15 ambassadors if cost per activated contributor < 3,000 FCFA. Restructure incentives if fewer than 30 activated by week 5. |

---

#### Experiment O2: Mobile Money Agent Network Seeding

| Field | Detail |
|---|---|
| **Hypothesis** | Visiting 20 MoMo/Orange Money agents in person and helping them map their kiosk will convert 12 into active contributors who each map 5+ nearby businesses. |
| **Experiment design** | Field coordinator visits 20 agents in Bonamoussadi during slow hours (10am-12pm). Script: "We are creating a map of all mobile money agents in Bonamoussadi. Map your kiosk for free visibility. Map 5 nearby businesses and earn 1,000 FCFA this week." Leave a flyer with QR code. Follow up via WhatsApp after 48 hours. |
| **Budget** | 30,000 FCFA ($48) for field coordinator transport and airtime. 20,000 FCFA ($32) for flyer printing (200 flyers). Total: 50,000 FCFA ($80). |
| **Timeline** | Weeks 3-5 |
| **Success metric** | 12 agents activated, 60+ business points contributed |
| **Decision criteria** | Expand to Akwa and Deido agent networks if > 50% conversion. |

---

#### Experiment O3: Church & Community Group Presentations

| Field | Detail |
|---|---|
| **Hypothesis** | A 10-minute presentation at 3 church youth group meetings will generate 15 signups with 60% activation (community trust accelerates adoption). |
| **Experiment design** | Identify 3 large churches in Bonamoussadi with active youth groups (e.g., Eglise Evangelique du Cameroun, Paroisse Catholique Sainte-Therese). Request 10 minutes during youth meeting. Presentation: "Use your phone to map your neighborhood and earn money. Your church community can be the most-mapped in Douala." Live demo of one contribution. Sign up 5 people on the spot. |
| **Budget** | 10,000 FCFA ($16) for transport and printed materials. |
| **Timeline** | Weeks 4-6 (aligned with Sunday youth meetings) |
| **Success metric** | 15 signups, 9 activated |
| **Decision criteria** | Systematize into a "Community Launch Kit" if activation > 50%. |

---

#### Experiment O4: Local Radio Spots (Douala)

| Field | Detail |
|---|---|
| **Hypothesis** | 30-second radio spots on 2 popular Douala stations during morning drive (6-9am) will generate 50 app visits and 15 signups over 2 weeks. |
| **Experiment design** | Script (French): "Vous connaissez votre quartier mieux que Google Maps. Avec African Data Layer, transformez cette connaissance en argent. Inscrivez-vous gratuitement sur africandatalayer.com. Gagnez chaque semaine en cartographiant les pharmacies, stations, et kiosques autour de vous." Air on Radio Siantou and Sweet FM. 3 spots/day during morning and evening drive. Track with dedicated URL or SMS short code. |
| **Budget** | 150,000-300,000 FCFA ($240-$480) for 2-week flight on 2 stations. |
| **Timeline** | Weeks 7-8 (after digital channels establish baseline) |
| **Success metric** | 50 unique visits from radio (tracked via short URL), 15 signups |
| **Decision criteria** | Scale to 4-week flight if CPA < 2,000 FCFA. Test on Yaounde stations if Douala results are positive. |

---

#### Experiment O5: Flyer Distribution at Fuel Stations & Pharmacies

| Field | Detail |
|---|---|
| **Hypothesis** | Flyers placed at 15 fuel stations and 15 pharmacies in Bonamoussadi will generate 20 signups within 3 weeks (people who work at these locations have downtime and local knowledge). |
| **Experiment design** | Design bilingual flyer (French/English): headline "Gagnez de l'argent avec votre telephone / Earn money with your phone," QR code to PWA, 3 bullet points (earn weekly, works offline, 5 minutes per contribution). Negotiate with station managers and pharmacists to display at counter. Leave 20 flyers per location. |
| **Budget** | 15,000 FCFA ($24) for 600 flyers. 10,000 FCFA ($16) for distribution transport. Total: 25,000 FCFA ($40). |
| **Timeline** | Weeks 3-5 |
| **Success metric** | 20 signups from QR code scans (tracked via UTM) |
| **Decision criteria** | Refresh flyers monthly if generating > 5 signups/week. |

---

### 4.3 B2B Channels

---

#### Experiment B1: LinkedIn Outreach to Logistics/Fintech PMs

| Field | Detail |
|---|---|
| **Hypothesis** | Personalized outreach to 50 PMs at logistics and fintech companies operating in Cameroon will generate 5 demo calls and 1 pilot agreement within 6 weeks. |
| **Experiment design** | Build prospect list: Gozem, Yango, Glovo, Jumia Logistics, Wave, MFS Africa, Flutterwave (Cameroon operations). Identify Head of Ops, PM Growth, or Data Lead on LinkedIn. Send 3-touch sequence: (1) Connection request + 2-line intro, (2) Share sample data screenshot 3 days later, (3) Offer free pilot dataset 5 days after. Track in simple CRM (Notion or Google Sheet). |
| **Budget** | LinkedIn Sales Navigator: $79.99/month. Founder time: 5 hours/week. |
| **Timeline** | Weeks 5-12 |
| **Success metric** | 15 connections accepted, 5 demo calls, 1 signed pilot |
| **Decision criteria** | Hire fractional SDR if pipeline exceeds 20 qualified leads. |

---

#### Experiment B2: Mobile Money Operator Partnerships

| Field | Detail |
|---|---|
| **Hypothesis** | Presenting ADL agent mapping data to MTN MoMo and Orange Money regional managers will generate a data-sharing pilot where the operator provides agent lists in exchange for ADL enrichment data. |
| **Experiment design** | Prepare a "Bonamoussadi Agent Landscape" report showing: total agents mapped, density map, competitor breakdown, formal vs informal. Request meeting with MTN MoMo Littoral regional manager via warm introduction (through contributor network or tech ecosystem contacts). Propose: "We have mapped X agents in Bonamoussadi. We can cover all of Douala in 60 days. In exchange, help us validate our data against your official agent records." |
| **Budget** | 20,000 FCFA ($32) for printed report and transport. |
| **Timeline** | Weeks 7-10 |
| **Success metric** | 1 meeting secured, partnership LOI signed |
| **Decision criteria** | If operator shows interest, prioritize mobile money vertical for Phase 2 expansion. |

---

#### Experiment B3: Conference Presence

| Field | Detail |
|---|---|
| **Hypothesis** | Presenting at 1 regional tech conference will generate 10 B2B leads and 3 investor conversations. |
| **Experiment design** | Target conferences: AfricaCom (Cape Town, Nov 2026), Africa Tech Summit (Nairobi, Feb 2027), or closer: Douala Digital Week, ActivSpaces Demo Day. For near-term: apply to pitch at ActivSpaces Douala monthly showcase (free). Prepare 5-minute pitch + live demo. For later: submit speaker proposal to AfricaCom on "Crowdsourcing hyperlocal data infrastructure in Africa." |
| **Budget** | ActivSpaces: 0 FCFA. AfricaCom: $2,000-$3,000 (travel + registration). |
| **Timeline** | Weeks 8-12 (local events), 6+ months (international) |
| **Success metric** | 10 business cards/LinkedIn connections, 3 demo requests, 1 follow-up meeting |
| **Decision criteria** | Prioritize local events until B2B product-market fit is validated. International conferences after first paying customer. |

---

#### Experiment B4: Developer Relations & API Documentation

| Field | Detail |
|---|---|
| **Hypothesis** | Publishing comprehensive API docs with a free developer tier will generate 10 developer signups and 3 integration projects within 60 days. |
| **Experiment design** | Create API documentation site (can be a section on existing site or hosted on ReadMe/GitBook). Include: authentication guide, endpoint reference, code samples (Python, JavaScript, curl), rate limits, pricing tiers. Free tier: 1,000 API calls/month. Promote via dev-focused communities: r/africa (Reddit), Africa tech Slack/Discord channels, dev.to articles. |
| **Budget** | 0 FCFA (documentation is content investment). Founder engineering time: 10 hours for docs + free tier setup. |
| **Timeline** | Weeks 5-8 |
| **Success metric** | 10 developer signups, 3 active API integrations |
| **Decision criteria** | Invest in developer advocate hire if >20 active API users. |

---

## 5. Growth Metrics & Funnel

### 5.1 Contributor Funnel (Supply Side)

| Stage | Metric | Phase 1 Target (Weeks 1-12) | Phase 2 Target (Months 4-6) | Measurement |
|---|---|---|---|---|
| **Awareness** | Impressions / reach | 10,000 impressions across channels | 100,000 | Facebook Ads Manager, WhatsApp group size, radio reach estimate |
| **Acquisition** | App visits / signups | 200 signups (15-20/week) | 1,000 signups | Supabase auth events, UTM tracking |
| **Activation** | First contribution within 24h | 30% of signups (60 people) | 35% | `point_events` first row per `user_id` vs signup timestamp |
| **Engagement** | Contributions per user per week | Median 3/week among active users | Median 5/week | KPI-T2-03 from analytics framework |
| **Retention** | D7 active rate | 20% | 30% | KPI-T2-02 retention cohorts |
| **Retention** | D30 active rate | 10% | 20% | KPI-T2-02 retention cohorts |
| **Referral** | Viral coefficient (K) | 0.3 (each contributor invites 0.3 new activated users) | 0.5 | Referral code tracking |
| **Revenue** | Contributor cost per verified point | < 500 FCFA ($0.80) | < 300 FCFA ($0.48) | Total contributor payouts / total verified points |

### 5.2 Data Buyer Funnel (Demand Side)

| Stage | Metric | Phase 1 Target (Weeks 1-12) | Phase 2 Target (Months 4-6) | Measurement |
|---|---|---|---|---|
| **Awareness** | B2B prospects aware of ADL | 100 (LinkedIn views, conference contacts) | 500 | LinkedIn analytics, CRM |
| **Interest** | Demo requests / API signups | 10 | 50 | CRM, API auth events |
| **Evaluation** | Free tier / pilot users | 5 | 15 | API usage logs |
| **Purchase** | Paid subscriptions or contracts | 1 | 5 | Stripe/invoicing |
| **Expansion** | Account revenue growth | N/A (too early) | 20% account expansion | Revenue per account over time |
| **Advocacy** | Customer referrals | 1 referral | 5 referrals | CRM attribution |

### 5.3 North Star Metric

**Active Verified Data Points per Region** (KPI-T1-01 from analytics framework).

This metric captures both sides of the marketplace: contributors must produce data (supply), and the data must be cross-verified (quality). Phase 1 target: 200 verified points across 3 categories in Bonamoussadi.

### 5.4 Key Ratios to Monitor Weekly

| Ratio | Formula | Healthy Range | Red Flag |
|---|---|---|---|
| **Activation rate** | First contribution within 24h / Total signups | > 25% | < 15% |
| **Cost per activated contributor** | Total acquisition spend / Activated contributors | < 3,000 FCFA ($4.80) | > 5,000 FCFA ($8.00) |
| **Contributions per active user per week** | Total weekly contributions / WAC | > 3 | < 2 |
| **Verification rate** | Points with 2+ contributor events / Total points | > 30% | < 15% |
| **Fraud rejection rate** | Rejected events / Total events | 5-15% (healthy fraud detection) | > 25% (contributor quality issue) or < 2% (detection too weak) |
| **B2B pipeline velocity** | Demo requests per month / Outreach volume | > 10% | < 5% |

---

## 6. Growth Playbook (First 90 Days)

### Phase 0: Pre-Launch Foundation (Weeks 1-2)

**Objective:** All messaging, assets, and infrastructure ready before first contributor touches the product.

| Day | Action | Owner | Deliverable |
|---|---|---|---|
| 1-2 | Finalize contributor-facing messaging in French and English | Marketing | Messaging doc approved |
| 1-2 | Create WhatsApp Community (3 groups: Annonces, Contributeurs Bonamoussadi, Support) | Marketing | Community live with welcome message |
| 3-4 | Design and print 500 flyers (bilingual, QR code to PWA) | Marketing | Flyers ready for distribution |
| 3-4 | Set up UTM tracking for all channels (WhatsApp, Facebook, flyers, campus, radio) | Engineering | UTM parameters configured, tracking dashboard live |
| 5-6 | Record 3 TikTok/Instagram Reels showing contribution workflow | Marketing | Videos edited and scheduled |
| 5-6 | Create campus ambassador recruitment post for university WhatsApp groups | Marketing | Post approved, ready to send |
| 7 | Seed WhatsApp group with 10 early contributors (friends, family, beta testers) | Founder | 10 members, 5 contributions |
| 8-10 | Set up weekly metrics dashboard (signups, activations, contributions, retention) | Engineering + Analytics | Dashboard live in Supabase/Metabase |
| 10-12 | Prepare B2B sample data package (Bonamoussadi pharmacies) for outreach | Data + Marketing | PDF/interactive demo ready |
| 12-14 | Write first 2 blog posts for SEO | Marketing | Posts published |

**Week 2 Checkpoint:** WhatsApp community has 15+ members. 10+ contributions from seed users. Tracking infrastructure works. Ready for campus launch.

---

### Phase 1: Bonamoussadi Campus Blitz (Weeks 3-4)

**Objective:** Reach 50 active contributors in Bonamoussadi through campus-first strategy.

| Day | Action | Owner | Deliverable |
|---|---|---|---|
| 15 | Launch campus ambassador program: recruit 5 ambassadors from seed contributors | Marketing | 5 ambassadors confirmed, targets set |
| 15 | Post in Universite de Douala, ESSEC, IUT Facebook groups and WhatsApp channels | Ambassadors | 3+ posts per campus |
| 16-17 | Distribute flyers at 15 pharmacies and 10 fuel stations in Bonamoussadi | Field coordinator | 500 flyers placed |
| 17-18 | Visit 20 mobile money agents in person (Experiment O2) | Field coordinator | 20 agents visited, 12+ onboarded |
| 18-19 | Launch Facebook/Instagram ad campaign (Experiment D2, variant A/B/C test) | Marketing | Ads live, budget allocated |
| 19-21 | First WhatsApp community challenge: "Map 5 pharmacies by Friday, earn bonus 500 FCFA" | Marketing | Challenge announced, leaderboard tracked |
| 21 | First weekly payout to all qualifying contributors | Finance | Payouts confirmed via MoMo/OM |
| 22-24 | Church youth group presentations (Experiment O3, first 2 churches) | Founder/Ambassador | 2 presentations delivered |
| 25-28 | Daily WhatsApp engagement: morning challenge, evening leaderboard, contributor spotlights | Marketing | 14 posts over 2 weeks |

**Week 4 Checkpoint:**
- 50 signups (target)
- 20 activated contributors (40% activation)
- 100+ verified data points
- WhatsApp community at 40+ members
- Facebook ad CPA measured, winning variant identified

**Decision gate:** If < 25 signups, diagnose messaging or channel issue before expanding. If activation < 20%, investigate onboarding friction.

---

### Phase 2: Neighborhood Expansion (Weeks 5-6)

**Objective:** Expand from Bonamoussadi to Akwa and Deido neighborhoods. Reach 100 active contributors.

| Day | Action | Owner | Deliverable |
|---|---|---|---|
| 29-30 | Create sub-groups in WhatsApp Community for Akwa and Deido | Marketing | 2 new sub-groups |
| 29-30 | Recruit 3 new ambassadors in Akwa (from contributor referrals or new recruits) | Marketing | 3 ambassadors, 2 in Akwa, 1 in Deido |
| 31-33 | Replicate flyer distribution in Akwa and Deido (fuel stations, pharmacies, MoMo kiosks) | Field coordinator | 400 flyers distributed |
| 33-35 | Scale winning Facebook ad variant. Add Akwa/Deido geo-targeting. | Marketing | Ad spend increased 3x on winning variant |
| 35-37 | Launch "Neighborhood Challenge": which neighborhood maps the most points this week? | Marketing | Inter-neighborhood competition live |
| 37-42 | Begin API documentation (Experiment B4) | Engineering | Docs draft live on /docs endpoint |
| 37-42 | Start TikTok content series (Experiment D6) | Marketing | 3 videos posted |

**Week 6 Checkpoint:**
- 100 total signups across 3 neighborhoods
- 40 active contributors (D7)
- 200 verified data points (North Star Phase 1 target)
- 3 neighborhoods with data coverage
- API docs draft available

---

### Phase 3: First B2B Outreach (Weeks 7-8)

**Objective:** Generate 10 warm B2B leads and begin demand-side validation.

| Day | Action | Owner | Deliverable |
|---|---|---|---|
| 43-44 | Prepare "Bonamoussadi Data Landscape" report for B2B prospects | Data + Marketing | PDF report with maps, stats, sample data |
| 43-44 | Build target list of 50 B2B prospects (LinkedIn research) | Marketing | Prospect list in CRM |
| 45-47 | Begin LinkedIn outreach sequence (Experiment B1, first 25 prospects) | Founder | 25 connection requests sent |
| 47-49 | Prepare and deliver MTN MoMo agent landscape pitch (Experiment B2) | Founder | Meeting requested or delivered |
| 49-50 | Launch local radio spot on Radio Siantou (Experiment O4) | Marketing | Radio spots airing 3x/day |
| 50-56 | Continue LinkedIn outreach (remaining 25 prospects) | Founder | 50 total outreach messages |
| 50-56 | Follow up with interested B2B prospects: share sample data, offer pilot | Founder | 5+ conversations active |

**Week 8 Checkpoint:**
- 10 B2B prospects in active conversation
- 3 demo calls completed
- 1 pilot agreement in discussion
- Radio spot performance measured
- Contributor base stable at 40+ WAC

---

### Phase 4: Scale & Optimize (Weeks 9-12)

**Objective:** Double down on what works, kill what does not, close first B2B deal.

| Week | Action | Decision |
|---|---|---|
| **Week 9** | Review all experiment results. Calculate CPA by channel, activation rate, D7 retention. | Kill channels with CPA > 5,000 FCFA or activation < 15%. Scale channels with CPA < 2,000 FCFA. |
| **Week 9** | Analyze contributor quality by acquisition channel. | Identify which channels produce highest-quality contributors (most verified points, lowest fraud rate). |
| **Week 10** | If B2B pipeline has 3+ qualified leads: prepare custom data packages and pricing proposals. | Prioritize the vertical (pharmacy, MoMo, fuel) with strongest buyer interest. |
| **Week 10** | Expand campus ambassador program to Yaounde (Universite de Yaounde I) if Douala playbook works. | Go only if Douala D30 retention > 10% and cost per verified point < 500 FCFA. |
| **Week 11** | Close first B2B pilot deal ($500-$2,000 for data package or 30-day API trial). | Any paying customer validates demand. |
| **Week 11** | Apply to ActivSpaces Douala Demo Day or similar local pitch event. | Conference pipeline for Q3. |
| **Week 12** | Compile 90-day retrospective: total contributors, verified points, B2B pipeline, unit economics, retention cohorts. | Present to advisors/investors. Decide: continue current direction, narrow to one vertical, or pivot. |

**Week 12 Success Criteria (Phase 1 Complete):**

| Metric | Target | Red Flag |
|---|---|---|
| Total signups | 200+ | < 100 |
| Weekly Active Contributors (WAC) | 40+ | < 20 |
| Verified data points | 200+ across 3 categories | < 100 |
| D7 retention | >= 20% | < 10% |
| D30 retention | >= 10% | < 5% |
| B2B pipeline | 10 prospects, 1 paying pilot | 0 paying customers and < 5 prospects |
| Cost per verified data point | < 500 FCFA ($0.80) | > 1,000 FCFA ($1.60) |
| Neighborhoods covered | 3+ in Douala | Only 1 |

---

## 7. Content Strategy

### 7.1 Blog / SEO Content Calendar

ADL needs to own search terms that B2B buyers use when looking for African location data. Target keywords and content plan:

| Priority | Target Keyword | Search Intent | Blog Post Title | Language |
|---|---|---|---|---|
| 1 | "pharmacy locations Douala" | Local/commercial | "Every Pharmacy in Bonamoussadi, Douala: A Complete Map (2026)" | EN + FR |
| 2 | "hyperlocal data Africa" | Informational/commercial | "Why Hyperlocal Data Is the Missing Infrastructure Layer in Africa" | EN |
| 3 | "mobile money agent map Cameroon" | Commercial | "Mapping Every Mobile Money Agent in Douala: What We Found" | EN + FR |
| 4 | "Africa POI data API" | Commercial/transactional | "How to Access Verified Point-of-Interest Data for African Cities via API" | EN |
| 5 | "crowdsourcing data Africa" | Informational | "Crowdsourcing vs. Traditional Surveys: How Africa's Data Gap Is Being Closed" | EN |
| 6 | "donnees geographiques Afrique" | Informational | "Cartographier l'Afrique par le bas : comment les contributeurs locaux construisent la couche de donnees qui manquait" | FR |
| 7 | "fuel station locations Cameroon" | Local/commercial | "Fuel Station Coverage in Douala: What Google Maps Misses" | EN + FR |
| 8 | "retail audit Africa" | Commercial | "The $0.10 Retail Audit: How Crowdsourced Data Disrupts Traditional Market Research in Africa" | EN |
| 9 | "informal economy data Africa" | Informational | "The Invisible Economy: Why Informal Businesses Are Missing from Every Map of Africa" | EN |
| 10 | "OpenStreetMap Africa coverage" | Informational | "OpenStreetMap in Africa: What It Gets Right, What It Misses, and How to Fill the Gaps" | EN |

**Publishing cadence:** 2 posts/month during Phase 1, scaling to weekly in Phase 2.

**Content production process:** Founder writes first draft from ADL data insights. Each post includes real data (e.g., "We found 87 pharmacies in a neighborhood where Google Maps shows 4"). Real data is the content moat -- competitors cannot produce this content without doing the fieldwork.

---

### 7.2 Social Proof Assets

These assets convert skeptics at every stage of the funnel.

| Asset | Purpose | Production Plan |
|---|---|---|
| **Contributor earnings screenshots** | Recruit new contributors. "Look, real people earning real money." | Ask top 5 contributors for permission to share anonymized earnings. Post weekly in WhatsApp and Instagram. |
| **Before/after map comparison** | B2B sales. "Google Maps shows 4 pharmacies. ADL shows 87." | Generate side-by-side screenshots from Google Maps vs ADL for Bonamoussadi. Use in LinkedIn posts, pitch decks, blog posts. |
| **Data quality metrics dashboard** | Investor/B2B credibility. "Our data is verified and fresh." | Publish monthly transparency report: verification rate, freshness score, contributor count, fraud rejection rate. |
| **Contributor video testimonials** | Emotional resonance. "Hear from Amina, a student who earns 20,000 FCFA/month with ADL." | Record 3-minute phone videos with top contributors. Use in Facebook/Instagram ads and website. |
| **B2B case study** | Enterprise sales. "How [Company X] reduced delivery failures by 40% using ADL data." | Write after first B2B pilot completes. Even a 1-page case study with real metrics is high-value. |
| **Neighborhood coverage reports** | Community pride + B2B pipeline. "Bonamoussadi is now the best-mapped neighborhood in Cameroon." | Generate automatically from ADL data. Share with community leaders and local press. |

---

### 7.3 Developer Documentation

API documentation is a sales channel for technical buyers. Key sections:

| Section | Content | Priority |
|---|---|---|
| **Quick Start** | "Get your first 10 data points in 5 minutes." Authentication, first API call, response format. | Week 5 |
| **Authentication** | API key generation, rate limits, free tier vs paid tier. | Week 5 |
| **Endpoints Reference** | `GET /api/points` (list/filter), `GET /api/points/:id` (detail), `GET /api/categories` (available categories), `GET /api/coverage` (coverage map). | Week 6 |
| **Code Samples** | Python, JavaScript (Node.js), curl. "Get all pharmacies within 2 km of a point." | Week 6 |
| **Data Dictionary** | Field definitions, category schemas, event types, freshness metadata. | Week 7 |
| **Pricing** | Free tier (1,000 calls/month), Startup ($99/month, 10K calls), Enterprise (custom). | Week 8 |
| **Changelog** | Coverage updates, new categories, API changes. | Ongoing |

**Hosting:** Start with a dedicated `/docs` page on the ADL site or a free-tier ReadMe.io/GitBook site. Migrate to custom docs site when API revenue justifies it.

---

### 7.4 Investor Materials

| Material | Purpose | Timeline |
|---|---|---|
| **Pitch deck (10-12 slides)** | Fundraising conversations, accelerator applications | Week 8-10 |
| **One-pager** | Conference handouts, email attachments (update existing Kasi Insight one-pager) | Week 2 (update existing) |
| **Data room** | Due diligence for serious investors | Month 4+ |

**Pitch deck outline:**

| Slide | Content |
|---|---|
| 1. Title | ADL logo, tagline ("The data layer Africa was missing"), founding team |
| 2. Problem | African businesses and organizations make decisions with stale, incomplete location data. Google Maps shows 4 pharmacies where there are 87. The informal economy is invisible. |
| 3. Solution | Crowdsourced, offline-first platform that incentivizes local contributors to map essential services. Automated fraud detection ensures quality. API delivers data to B2B buyers. |
| 4. Why now | Mobile penetration crossing 80% in urban Africa. Fintech, logistics, and FMCG companies expanding and need hyperlocal data. Traditional data providers (Nielsen, Kantar) are too expensive and too slow. |
| 5. Product demo | Screenshot of contributor flow + API response + dashboard |
| 6. Traction | X verified points, Y contributors, Z neighborhoods, first B2B pilot |
| 7. Business model | Contributor incentives funded by B2B data subscriptions. Unit economics: cost per verified point vs. revenue per API call. |
| 8. Market size | Africa's location data and market research market: $X billion (cite GSMA, McKinsey). SAM: companies operating in Cameroon and West Africa needing POI data. |
| 9. Competitive landscape | Differentiation matrix (vs. OSM, Google, Nielsen, Premise). Key moat: informal sector data + continuous freshness + offline-first. |
| 10. Go-to-market | City-by-city expansion. Bonamoussadi -> Douala -> Cameroon -> West Africa. Campus ambassador model for supply. LinkedIn outreach + partnerships for demand. |
| 11. Team | Founder background (cloud architecture, LVMH consulting, Africa market experience since 2018). Advisory network. |
| 12. Ask | Raising $X for Y months of runway. Use of funds: contributor incentives (40%), engineering (30%), GTM (20%), ops (10%). |

**Data room structure (Month 4+):**

```
/data-room
  /corporate
    - Certificate of incorporation
    - Shareholder agreement
    - Cap table
  /financials
    - Monthly P&L (from launch)
    - Unit economics model
    - Financial projections (3-year)
  /product
    - Architecture documentation (doc 01)
    - System design (doc 02)
    - Security audit (doc 04)
    - Fraud detection framework (doc 05)
  /traction
    - Weekly KPI dashboard exports
    - Contributor growth chart
    - B2B pipeline summary
    - Customer testimonials / LOIs
  /market
    - TAM/SAM/SOM analysis
    - Competitor landscape
    - ICP documentation (this document)
  /legal
    - Data privacy policy
    - Terms of service
    - Contributor agreement
```

---

## Appendix A: Budget Summary (First 90 Days)

| Item | Amount (FCFA) | Amount (USD) |
|---|---|---|
| Facebook/Instagram ads (Experiment D2) | 200,000 | $320 |
| Campus ambassador payouts (Experiment O1) | 100,000 | $160 |
| Ambassador T-shirts | 50,000 | $80 |
| Mobile money agent outreach (Experiment O2) | 50,000 | $80 |
| Church/community presentations (Experiment O3) | 10,000 | $16 |
| Radio spots (Experiment O4) | 300,000 | $480 |
| Flyer printing and distribution (Experiment O5) | 25,000 | $40 |
| LinkedIn Sales Navigator (3 months) | 150,000 | $240 |
| Contributor incentive payouts (estimated 200 contributors x 5,000 FCFA avg) | 1,000,000 | $1,600 |
| **Total** | **1,885,000** | **$3,016** |

This is a lean budget appropriate for a pre-revenue startup validating product-market fit. The single largest line item is contributor incentive payouts, which directly produce the data asset. Every other line item can be cut without stopping data production.

---

## Appendix B: Key Cameroonian Market Context

| Factor | Detail | Implication for ADL |
|---|---|---|
| **Internet penetration** | ~45% (2025), heavily mobile. MTN and Orange dominate. | Mobile-first PWA is the right form factor. |
| **Smartphone penetration** | ~55% in urban areas, predominantly low-end Android (Tecno, Itel). | App must work on 1-2 GB RAM devices. Offline-first is essential. |
| **Mobile money** | MTN MoMo and Orange Money are the primary payment rails. 70%+ of urban adults use mobile money. | Payout via MoMo/OM is the only viable contributor payment method. |
| **Language** | French dominant in Douala, English in Northwest/Southwest, Pidgin as lingua franca. | All contributor-facing content must be bilingual (FR/EN). Pidgin for informal communications (WhatsApp, TikTok). |
| **Youth unemployment** | ~60% underemployment among 18-35 in urban areas. | Strong pull for any legitimate earning opportunity. Messaging: income stability > gig economy hype. |
| **Social media usage** | Facebook and WhatsApp dominate. Instagram growing among youth. Twitter/X used by tech/business community. TikTok growing fast among 15-25. | WhatsApp is the primary community channel. Facebook for paid acquisition. TikTok for organic youth reach. |
| **Trust dynamics** | Word-of-mouth and personal referrals are the strongest trust signals. "My friend uses it" > "I saw an ad." | Campus ambassador and community leader strategies are higher-trust than digital ads. |
| **Payment expectations** | Small, frequent payments preferred over large, delayed ones. Consistency matters more than amount (confirmed by Kasi meeting). | Weekly payouts, not monthly. Even 2,000 FCFA/week is valuable if consistent. |
| **Competitor landscape** | No direct competitor doing hyperlocal crowdsourced POI data in Cameroon. OSM presence is minimal. Google Maps coverage is basic. | First-mover advantage in Cameroon. Speed of execution matters more than features. |

---

## Appendix C: French Translation of Key Marketing Assets

### Contributor Signup WhatsApp Message

> Salut! Tu connais bien ton quartier? African Data Layer te paie pour cartographier les pharmacies, stations-service et kiosques MoMo autour de toi.
>
> Comment ca marche:
> 1. Inscris-toi en 30 secondes (lien ci-dessous)
> 2. Photographie et localise un commerce pres de toi
> 3. Gagne des XP et recois ton paiement chaque vendredi sur MoMo/OM
>
> Ca marche meme sans connexion internet!
>
> Rejoins les +50 contributeurs de Bonamoussadi: [lien]
>
> Des questions? Ecris ici, on repond en moins de 2h.

### Flyer Text (Front)

> **GAGNEZ DE L'ARGENT AVEC VOTRE TELEPHONE**
>
> Cartographiez les commerces de votre quartier et gagnez chaque semaine.
>
> - 5 minutes par contribution
> - Paiement chaque vendredi sur MoMo/OM
> - Fonctionne meme hors connexion
>
> Scannez le QR code pour commencer >>
>
> **EARN MONEY WITH YOUR PHONE**
>
> Map the businesses in your neighborhood and earn every week.

### Radio Script (30 seconds, French)

> Vous connaissez votre quartier mieux que n'importe quelle carte. Les pharmacies, les kiosques MoMo, les stations-service -- vous savez ou ils sont. Avec African Data Layer, cette connaissance vous rapporte de l'argent reel. Inscrivez-vous gratuitement, cartographiez les commerces autour de vous, et recevez votre paiement chaque vendredi sur MTN MoMo ou Orange Money. Ca marche meme sans internet. African Data Layer -- vos connaissances de quartier ont de la valeur. Rendez-vous sur africandatalayer.com.

---

*This document is immediately actionable. Every experiment has a budget, timeline, and decision criteria. Start with Week 1, Day 1: finalize messaging and create the WhatsApp community. Everything else follows.*
