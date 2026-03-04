# ADL Pitch Deck Source Matrix

This matrix is the single source of truth for quantitative claims used across all pitch decks in `docs/pitch/`.

## Source Hierarchy
1. `docs/team/*` (primary)
2. `research/*` (secondary)
3. `docs/pitch-one-pager-kasi-insight.md` (context only)

## Conflict Handling Notes
- Fraud KPI conflict: `docs/team/06-data-analytics.md` uses Phase 1 fraud target `< 5%`; `docs/team/05-fraud-strategy.md` proposes `< 2%`. Decks use `< 5%` for near-term execution and mention `< 2%` as future hardening.
- Uptime/SLA conflict: `docs/team/01-cloud-architecture.md` lists MVP uptime `99%`, while pilot SLA in `research/03-cloud-architect-technical-architecture.md` targets `99.5%`. Decks use `99.5%` as pilot operating target.

## Claim Inventory
| Tag | Quantitative claim used in decks | Primary source | Supporting/alternate source | Notes/assumptions |
|---|---|---|---|---|
| `SM-01` | Douala metro population (2025 estimate) is `~4.35M` | `research/01-data-analyst-local-context.md:35` | `research/01-data-analyst-local-context.md:200` | Use as city-level market context only |
| `SM-02` | Bonamoussadi has `~560` registered businesses (estimate) | `research/01-data-analyst-local-context.md:36` | `research/01-data-analyst-local-context.md:607` | Pilot-zone density reference |
| `SM-03` | Cameroon informal economy estimated at `30-50%` of GDP; ~`90%` active population employed informally | `research/01-data-analyst-local-context.md:42` | - | Used to frame informal-sector data gap |
| `SM-04` | Last official census in Cameroon was `2005`; Douala grew from `~1.9M` to `~4.35M` estimate by 2025 | `research/01-data-analyst-local-context.md:199-200` | - | Supports "stale official data" argument |
| `SM-05` | `41%` of roads are in poor condition; only `10%` of road network is tarred/paved | `research/01-data-analyst-local-context.md:49` | `research/01-data-analyst-local-context.md:465` | Used in transport and reliability narrative |
| `SM-06` | Cameroon alcohol market projected at `~$4.9B` in 2025; `40,000+` alcohol points of sale nationally | `research/01-data-analyst-local-context.md:133-134` | - | Used for vertical opportunity sizing |
| `SM-07` | Cameroon has `890` petrol stations nationally; `175` in Littoral (Douala area) | `research/01-data-analyst-local-context.md:264` | - | Used for fuel vertical context |
| `SM-08` | Mobile money market: Orange ~`70%`, MTN ~`30%`; combined `>80%` of electronic transactions | `research/01-data-analyst-local-context.md:329` | `research/01-data-analyst-local-context.md:334` | Used for fintech buyer value proposition |
| `SM-09` | Informal drug sales represent `>25%` of national drug market | `research/01-data-analyst-local-context.md:399` | - | Used for health/pharmacy impact narrative |
| `SM-10` | Cameroon data protection Law No. `2024/017` enacted on `2024-12-23` | `research/01-data-analyst-local-context.md:550` | - | Compliance narrative anchor |
| `SM-11` | Compliance urgency note references `June 2026` timing window | `research/01-data-analyst-local-context.md:605` | - | Treated as planning assumption from research document |
| `SM-12` | Phase 1 target: `200` verified points across `3` categories | `docs/team/06-data-analytics.md:43` | `docs/team/07-marketing-strategy.md:625` | North-star operational target |
| `SM-13` | Phase 1 target: `20` Weekly Active Contributors (WAC) | `docs/team/06-data-analytics.md:91` | `docs/team/08-service-delivery-project-plan.md:355` | Core supply-side target |
| `SM-14` | Phase 1 freshness target: median `< 14 days` | `docs/team/06-data-analytics.md:121` | `docs/team/08-service-delivery-project-plan.md:356` | Core quality and buyer trust metric |
| `SM-15` | Phase 1 retention target: `D1 >= 30%`, `D7 >= 20%`, `D30 >= 10%` | `docs/team/06-data-analytics.md:203` | `docs/team/07-marketing-strategy.md:605-606` | Used in contributor and investor decks |
| `SM-16` | Phase 1 fraud-rate target: `< 5%` | `docs/team/06-data-analytics.md:373` | `docs/team/05-fraud-strategy.md:1281` | `docs/team/05` lists `< 2%` long-term target |
| `SM-17` | Phase 1 verification-rate target: `25%` of points verified | `docs/team/06-data-analytics.md:408` | `docs/team/07-marketing-strategy.md:634` | Used in quality-control messaging |
| `SM-18` | Phase 1 photo-attachment target: `95%` for user submissions | `docs/team/06-data-analytics.md:562` | - | Used in provenance/QA messaging |
| `SM-19` | Phase 1 API latency target: `p50 < 500ms`, `p95 < 2s` | `docs/team/06-data-analytics.md:593` | `docs/team/01-cloud-architecture.md:46` | Used in B2B trust and SLA slides |
| `SM-20` | Phase 1 sync failure-rate target: `< 2%` | `docs/team/06-data-analytics.md:616` | - | Used in contributor reliability messaging |
| `SM-21` | FMCG buyer budget: `$2,000-$15,000/month`; one-time snapshots `$5,000-$25,000` | `docs/team/07-marketing-strategy.md:42` | - | ICP budget range |
| `SM-22` | Fintech buyer budget: `$1,000-$8,000/month`; city-level maps `$10,000-$50,000` | `docs/team/07-marketing-strategy.md:57` | - | ICP budget range |
| `SM-23` | Logistics buyer budget: `$500-$5,000/month` | `docs/team/07-marketing-strategy.md:72` | - | ICP budget range |
| `SM-24` | NGO/development budget: `$10,000-$100,000` per project | `docs/team/07-marketing-strategy.md:87` | - | ICP budget range |
| `SM-25` | ADL cost per data point benchmark: `$0.05-$0.15` vs traditional surveys `$2-$10` | `docs/team/07-marketing-strategy.md:357` | `docs/team/07-marketing-strategy.md:379` | Comparative unit-economics positioning |
| `SM-26` | Supply funnel targets: `200` signups, `30%` activation, `D7 20%`, `D30 10%` | `docs/team/07-marketing-strategy.md:602-606` | - | Phase 1 marketing targets |
| `SM-27` | Demand funnel targets: `10` demos, `5` pilot users, `1` paid subscription in Phase 1 | `docs/team/07-marketing-strategy.md:615-617` | - | Phase 1 B2B targets |
| `SM-28` | 90-day growth budget total: `1,885,000 FCFA` (`$3,016`) | `docs/team/07-marketing-strategy.md:895` | - | Includes acquisition and contributor incentives |
| `SM-29` | Student budget context: `30,000-80,000 FCFA/month`; ADL incremental `5,000-10,000 FCFA/month` is meaningful | `docs/team/07-marketing-strategy.md:106` | - | Contributor motivation anchor |
| `SM-30` | Persona benchmark: competitor market-research spend of `$15,000` for stale report | `docs/team/07-marketing-strategy.md:245` | - | Used to frame ADL ROI |
| `SM-31` | Fintech persona LTV model: `$3,000-$8,000` initial + `$1,500-$3,000/month`; potential `$20,000-$50,000/year` enterprise | `docs/team/07-marketing-strategy.md:250` | - | Used as directional commercial example |
| `SM-32` | Development agency pain benchmark: traditional survey costs `$30,000-$50,000` and takes `4 months` | `docs/team/07-marketing-strategy.md:263` | - | Used for NGO/public-sector value proposition |
| `SM-33` | Phase 1 project budget range (12 weeks): `$750-$1,950` total | `docs/team/08-service-delivery-project-plan.md:496` | `docs/team/08-service-delivery-project-plan.md:495` | Investor capital-efficiency narrative |
| `SM-34` | Execution risk thresholds include `D7 < 20%` retention risk and zero-B2B risk in Phase 1 | `docs/team/08-service-delivery-project-plan.md:275-276` | - | Used in risk slide |
| `SM-35` | Pilot scope: `6-week` field pilot with `10-20` field agents in Bonamoussadi | `research/04-cloud-engineer-implementation.md:1562` | `research/03-cloud-architect-technical-architecture.md:1376` | Core execution scope |
| `SM-36` | Implementation effort by phase: `10` dev-days, `22` dev-days, `22.5` dev-days | `research/04-cloud-engineer-implementation.md:1580` | `research/04-cloud-engineer-implementation.md:1608,1637` | Used for delivery realism |
| `SM-37` | Total implementation effort estimate: `~54` developer-days | `research/04-cloud-engineer-implementation.md:2131` | - | Capacity planning metric |
| `SM-38` | Infrastructure cost in implementation summary: `$20/month` (unchanged, Vercel Pro) | `research/04-cloud-engineer-implementation.md:2130` | `research/03-cloud-architect-technical-architecture.md:1384` | Used in investor cost slide |
| `SM-39` | Additional tooling cost estimate: `$0/month` (Sentry/Uptime/GitHub Actions free tiers) | `research/04-cloud-engineer-implementation.md:2129` | - | Efficiency and runway narrative |
| `SM-40` | Implementation timeline span: `14 weeks total` | `research/04-cloud-engineer-implementation.md:1650` | - | Used in roadmap slides |
| `SM-41` | Pilot infrastructure subtotal: `$20-21/month` | `research/03-cloud-architect-technical-architecture.md:1399` | - | Cost floor estimate |
| `SM-42` | Pilot monthly infrastructure cost envelope: `$20-65/month` | `research/03-cloud-architect-technical-architecture.md:1885` | `research/03-cloud-architect-technical-architecture.md:1420` | Envelope used in investor and partner decks |
| `SM-43` | Data usage profile: `~9MB/day`, `~200MB/month` per agent, `~500 XAF/month` data cost per agent | `research/03-cloud-architect-technical-architecture.md:554,556,561` | - | Contributor operating-cost messaging |
| `SM-44` | Pilot SLA targets include API availability `99.5%`, photo upload success `95%`, freshness `< 7 days`, client API p95 `< 3s` | `research/03-cloud-architect-technical-architecture.md:1614,1625,1630,1644` | - | Used in B2B and partner trust slides |
| `SM-45` | Architecture principle: no fixed-cost infra until `10K+` users; API p95 target `< 2s` for Africa in MVP table | `docs/team/01-cloud-architecture.md:38,46` | `docs/team/01-cloud-architecture.md:692` | Supports scalability narrative |
| `SM-46` | Fraud risk-score weights: location `0.25`, photo `0.25`, temporal `0.15`, user `0.20`, behavioral `0.15` | `docs/team/05-fraud-strategy.md:700-704` | - | Used in contributor trust and QA messaging |
| `SM-47` | Fraud action thresholds: `0-25` auto-approve, `26-50` soft review, `51-75` hard review, `76-100` auto-reject | `docs/team/05-fraud-strategy.md:954-957` | - | Used in anti-fraud explanation |
| `SM-48` | Fraud operations KPI targets: detection recall `>70%`, false positive `<10%`, resolution `<72h` | `docs/team/05-fraud-strategy.md:1282-1285` | - | Used in governance and ops slides |

## Placeholder Policy
Unknown live metrics (for example current verified points, active paying customers, exact fundraising amount) are marked in deck files as `[[TO VALIDATE_*]]` and intentionally excluded from quantitative claims until confirmed.
