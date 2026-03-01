# ADL Service Delivery & Project Execution Plan

**Author:** Teammate 8 -- Service Delivery Manager / Project Leader
**Date:** 2026-03-01
**Status:** Living document -- updates at every sprint boundary
**Predecessors:**
- [01-cloud-architecture.md](./01-cloud-architecture.md) (Cloud Architect)
- [02-system-design.md](./02-system-design.md) (System Design Expert)
- [03-cloud-engineering.md](./03-cloud-engineering.md) (Cloud Engineer)
- [04-cybersecurity.md](./04-cybersecurity.md) (Cybersecurity Expert)
- [05-fraud-strategy.md](./05-fraud-strategy.md) (Fraud Specialist)
- [06-data-analytics.md](./06-data-analytics.md) (Data Analyst)
- [07-marketing-strategy.md](./07-marketing-strategy.md) (Marketing Genius)
- [pitch-one-pager-kasi-insight.md](../pitch-one-pager-kasi-insight.md) (Kasi Insight meeting context)

**Scope:** Project scope definition, milestone plan, ownership matrix, dependency map, RAID log, stakeholder cadence, and execution governance for African Data Layer

---

## Table of Contents

1. [Project Scope](#1-project-scope)
2. [Phase Plan & Milestones](#2-phase-plan--milestones)
3. [Ownership Matrix (RACI)](#3-ownership-matrix-raci)
4. [Dependency Map](#4-dependency-map)
5. [RAID Log](#5-raid-log)
6. [Stakeholder Cadence](#6-stakeholder-cadence)
7. [Decision Log](#7-decision-log)
8. [Execution Governance](#8-execution-governance)

---

## 1. Project Scope

### 1.1 Scope Statement

**In scope:**

| Area | Description | Source Document |
|------|-------------|-----------------|
| **Bonamoussadi MVP hardening** | Production-ready platform serving contributors and admin reviewers in one neighborhood | 01-cloud-architecture, 02-system-design |
| **Data quality pipeline** | Fraud detection, EXIF validation, cross-contributor verification | 04-cybersecurity, 05-fraud-strategy |
| **Analytics & KPI infrastructure** | Dashboards for north star metrics (verified points, WAC, freshness) | 06-data-analytics |
| **First B2B pilot** | One signed pilot customer (FMCG, fintech, or development agency) | 07-marketing-strategy |
| **Contributor acquisition (supply side)** | 20 Weekly Active Contributors with D7 retention >= 20% | 06-data-analytics, 07-marketing-strategy |
| **IaC & CI/CD** | Automated deployment pipeline, staging environment, observability | 03-cloud-engineering |
| **Security hardening** | Top-5 vulnerabilities from cybersecurity assessment remediated | 04-cybersecurity |
| **Go-to-market execution** | ICP outreach, campus ambassador program, first 3 B2B conversations | 07-marketing-strategy |

**Out of scope (Phase 1):**

| Area | Reason |
|------|--------|
| Multi-city expansion (beyond Bonamoussadi) | Must prove unit economics in one neighborhood first |
| Native mobile app | PWA is sufficient for MVP; native only when retention data justifies the investment |
| Real-time streaming APIs | Monthly/weekly delta reports are the validated buyer need (Kasi Insight feedback) |
| Contributor payout infrastructure | Manual payouts via mobile money until 50+ active contributors |
| Enterprise SLAs | No contractual SLAs until Phase 2; best-effort uptime |

### 1.2 Success Criteria (Phase 1 Exit Gate)

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Verified data points | >= 200 across 3 categories | KPI-T1-01 query (doc 06) |
| Weekly Active Contributors (WAC) | >= 20 | KPI-T1-02 query (doc 06) |
| Data freshness (median) | < 14 days | KPI-T1-03 query (doc 06) |
| Fraud detection rate | >= 60% of synthetic submissions caught | Fraud pipeline metrics (doc 05) |
| B2B pipeline | >= 1 signed pilot OR 3 qualified leads | CRM tracking |
| Platform uptime | >= 99% | Health endpoint monitoring (doc 03) |
| Zero critical security vulnerabilities | 0 P1 findings open | Security scan (doc 04) |

---

## 2. Phase Plan & Milestones

### 2.1 Phase Overview

| Phase | Name | Duration | Key Outcome |
|-------|------|----------|-------------|
| **Phase 1** | Bonamoussadi MVP | Weeks 1-12 | Production-ready platform, 20 WAC, 200 verified points, 1 B2B pilot |
| **Phase 2** | Cameroon Scale | Weeks 13-26 | 500 WAC, 2,000 verified points, 3-5 paying customers, $5K MRR |
| **Phase 3** | Pan-African | Weeks 27-52 | 10,000 WAC, 50,000 verified points, multi-city, $50K MRR |

### 2.2 Phase 1 Milestones (Weeks 1-12)

---

#### M1: Foundation (Weeks 1-2)

| Deliverable | Owner | Acceptance Criteria | Dependency |
|-------------|-------|---------------------|------------|
| IaC codified (Vercel + Supabase config as code) | Cloud Engineer | `vercel.json` enhanced per doc 03 spec, Supabase migrations scripted | None |
| CI/CD pipeline operational | Cloud Engineer | PR -> preview deploy -> staging -> prod pipeline with automated tests | None |
| Staging environment live | Cloud Engineer | Separate Supabase project, Vercel preview branch, seeded test data | None |
| Security: Gemini API key moved server-side | Cloud Engineer + Cybersecurity | `VITE_GEMINI_API_KEY` removed from client bundle (doc 04, finding S-01) | None |
| Security: Rate limiting on auth endpoints | Cloud Engineer + Cybersecurity | 10 req/min per IP on `/api/auth/*` (doc 04, finding D-01) | None |
| KPI dashboard v1 (internal) | Data Analyst | Supabase SQL queries for T1 KPIs running on schedule, viewable in admin | None |
| Contributor acquisition plan finalized | Marketing | Campus ambassador shortlist, WhatsApp group targets, onboarding script | None |

---

#### M2: Data Quality & Fraud (Weeks 3-4)

| Deliverable | Owner | Acceptance Criteria | Dependency |
|-------------|-------|---------------------|------------|
| Fraud scoring pipeline live | Fraud Specialist + Cloud Engineer | Risk score (0-100) computed per submission per doc 05 model | M1: staging env |
| EXIF validation hardened | Cloud Engineer | Photo hash deduplication, GPS-vs-submission distance check, stripped EXIF flagging | M1: CI/CD |
| Cross-contributor verification logic | System Design + Cloud Engineer | Points promoted to "verified" status when 2+ distinct contributors submit events | M1: staging env |
| Admin review queue enhanced | Cloud Engineer | Fraud indicators visible in review UI, bulk approve/reject, audit trail | M2: fraud scoring |
| Data quality alert rules | Data Analyst | Automated alerts when WAC drops >30% WoW or freshness exceeds 21 days | M1: KPI dashboard |

---

#### M3: Contributor Launch (Weeks 5-7)

| Deliverable | Owner | Acceptance Criteria | Dependency |
|-------------|-------|---------------------|------------|
| Campus ambassador program launched | Marketing | 3-5 ambassadors recruited at Universite de Douala / ESSEC, each with onboarding kit | M1: contributor plan |
| WhatsApp onboarding bot/flow | Marketing + Cloud Engineer | Automated welcome sequence in French, link to PWA, first-contribution guide | M1: contributor plan |
| Contributor onboarding UX optimized | System Design + Cloud Engineer | < 60 second sign-up to first contribution, offline mode explained | M2: complete |
| Gamification v1 live | Cloud Engineer | Leaderboard visible, XP earning transparent, weekly reset communicated | M1: CI/CD |
| First 10 active contributors | Marketing | 10 distinct users with >= 1 submission each in production | M3: ambassador launch |

---

#### M4: B2B Pipeline (Weeks 6-9)

| Deliverable | Owner | Acceptance Criteria | Dependency |
|-------------|-------|---------------------|------------|
| B2B landing page / data sample page | Marketing + Cloud Engineer | Public page showing Bonamoussadi coverage stats, sample data, contact form | M2: data quality |
| ICP 1a outreach (FMCG/Beverage) | Marketing | 5 personalized outreach messages sent to target accounts (doc 07 list) | M3: 10 contributors |
| ICP 1b outreach (Fintech/MoMo) | Marketing | 5 personalized outreach messages sent | M3: 10 contributors |
| ICP 1d outreach (NGO/Dev agency) | Marketing | 3 personalized outreach messages sent | M3: 10 contributors |
| API documentation (developer portal) | System Design + Cloud Engineer | Swagger/OpenAPI spec for public read endpoints, auth flow documented | M2: complete |
| Sample delta report (Bonamoussadi) | Data Analyst | Month-over-month delta report for pharmacies showing new/closed/changed POIs | M3: 10 contributors |

---

#### M5: Scale & Validate (Weeks 8-10)

| Deliverable | Owner | Acceptance Criteria | Dependency |
|-------------|-------|---------------------|------------|
| 20 WAC achieved | Marketing + all | KPI-T1-02 >= 20 for 2 consecutive weeks | M3: ambassador launch |
| 200 verified points achieved | all | KPI-T1-01 >= 200 across 3 categories | M3: active contributors |
| Contributor retention analysis | Data Analyst | D7, D14, D30 cohort analysis with actionable insights | M5: 20 WAC |
| First B2B demo delivered | Marketing | At least 1 demo meeting completed with qualified ICP | M4: outreach |
| Security audit (pre-B2B) | Cybersecurity | Re-scan confirms 0 critical vulnerabilities, rate limiting active, secrets secured | M2: security fixes |

---

#### M6: Phase 1 Close (Weeks 11-12)

| Deliverable | Owner | Acceptance Criteria | Dependency |
|-------------|-------|---------------------|------------|
| Phase 1 success criteria met | Project Leader | All 7 exit gate criteria green (see 1.2) | M5: all |
| B2B pilot agreement signed OR 3 qualified leads | Marketing | Documented commitment from at least 1 buyer OR pipeline of 3 | M5: demo |
| Unit economics calculated | Data Analyst + Marketing | Cost per verified data point, cost per WAC, projected LTV per B2B customer | M5: retention analysis |
| Phase 2 plan drafted | Project Leader | Scope, milestones, budget, team needs for Cameroon scale phase | M6: unit economics |
| Stakeholder review meeting | Project Leader | Presentation of Phase 1 results, go/no-go decision for Phase 2 | M6: all |
| Retrospective completed | Project Leader | What worked, what didn't, process improvements for Phase 2 | M6: close |

---

### 2.3 Milestone Timeline (Gantt View)

```
Week:     1    2    3    4    5    6    7    8    9   10   11   12
          |----|----|----|----|----|----|----|----|----|----|----|----|
M1 ████████████
   Foundation

M2           ████████████
             Data Quality & Fraud

M3                     ████████████████
                       Contributor Launch

M4                          ████████████████████
                            B2B Pipeline

M5                                    ████████████████
                                      Scale & Validate

M6                                                   ████████████
                                                     Phase 1 Close
```

---

## 3. Ownership Matrix (RACI)

**Legend:** R = Responsible (does the work), A = Accountable (owns the outcome), C = Consulted, I = Informed

| Workstream | Cloud Architect (T1) | System Design (T2) | Cloud Engineer (T3) | Cybersecurity (T4) | Fraud (T5) | Data Analyst (T6) | Marketing (T7) | Project Leader (T8) |
|------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Cloud infrastructure & IaC** | A | C | R | C | I | I | I | I |
| **CI/CD pipeline** | C | C | R/A | I | I | I | I | I |
| **API design & service boundaries** | C | A | R | C | C | I | I | I |
| **Data model changes** | I | A | R | C | C | C | I | I |
| **Fraud detection pipeline** | I | C | R | C | A | R | I | I |
| **Security hardening** | C | C | R | A | I | I | I | I |
| **Incident response** | I | I | R | A | C | I | I | I |
| **KPI dashboards & analytics** | I | C | C | I | I | R/A | I | I |
| **Data quality monitoring** | I | C | C | I | C | R/A | I | I |
| **Contributor acquisition** | I | I | C | I | I | C | R/A | I |
| **B2B sales & outreach** | I | I | C | I | I | C | R/A | I |
| **Content & positioning** | I | I | I | I | I | C | R/A | I |
| **Scope management** | C | C | C | C | C | C | C | R/A |
| **Milestone tracking** | I | I | I | I | I | I | I | R/A |
| **Stakeholder communication** | I | I | I | I | I | I | C | R/A |
| **Risk management** | C | C | C | C | C | C | C | R/A |
| **Budget oversight** | C | I | C | I | I | C | C | R/A |

---

## 4. Dependency Map

### 4.1 Critical Path

The critical path runs through the items that, if delayed, directly delay Phase 1 completion:

```
IaC + CI/CD (M1, W1-2)
    |
    v
Fraud Pipeline + EXIF Hardening (M2, W3-4)
    |
    v
Contributor Onboarding UX (M3, W5)
    |
    v
Campus Ambassador Launch (M3, W5-6)
    |
    v
10 Active Contributors (M3, W7)
    |
    v
20 WAC + 200 Verified Points (M5, W8-10)
    |
    v
Phase 1 Exit Gate (M6, W11-12)
```

### 4.2 Cross-Team Dependencies

| ID | Upstream | Downstream | Dependency | Risk if Delayed |
|----|----------|------------|------------|-----------------|
| DEP-01 | Cloud Engineer (T3): staging env | Fraud Specialist (T5): pipeline testing | Fraud pipeline cannot be tested without staging | M2 slips -> M3 slips -> critical path |
| DEP-02 | Cybersecurity (T4): threat model | Cloud Engineer (T3): security fixes | Fixes cannot begin until vulnerabilities are identified | Security debt accumulates |
| DEP-03 | System Design (T2): API spec | Cloud Engineer (T3): implementation | API changes without spec lead to rework | 1-2 week slip on M4 |
| DEP-04 | Data Analyst (T6): KPI queries | Marketing (T7): contributor metrics | Cannot measure contributor program success without dashboards | Blind scaling decisions |
| DEP-05 | Cloud Engineer (T3): contributor UX | Marketing (T7): ambassador launch | Cannot recruit ambassadors if onboarding is broken | M3 slips -> critical path |
| DEP-06 | Marketing (T7): 10 contributors | Data Analyst (T6): retention analysis | Cannot analyze retention without a contributor cohort | M5 slips |
| DEP-07 | Fraud Specialist (T5): scoring live | Cloud Engineer (T3): admin review UI | Admin UI fraud indicators depend on fraud pipeline output | M2 internal delay |
| DEP-08 | Data Analyst (T6): delta report | Marketing (T7): B2B outreach | Outreach is hollow without a sample data deliverable to show prospects | M4 weakened |

### 4.3 External Dependencies

| ID | External Party | What We Need | Risk | Mitigation |
|----|---------------|--------------|------|------------|
| EXT-01 | Supabase | Uptime, no breaking API changes | Low | Pin client library version, backup strategy per doc 03 |
| EXT-02 | Vercel | Edge deployment, serverless functions | Low | IaC allows migration to alternative (Cloudflare Workers) if needed |
| EXT-03 | Universite de Douala / ESSEC | Campus access for ambassador recruitment | Medium | Backup: recruit via WhatsApp groups without campus presence |
| EXT-04 | MTN / Orange | Mobile money for contributor payouts | Medium | Manual bank transfer as fallback until automated payout |
| EXT-05 | B2B prospects | Willingness to pilot | High | Multiple ICP segments targeted in parallel; pivot to different segment if first fails |

---

## 5. RAID Log

### 5.1 Risks

| ID | Risk | Probability | Impact | Owner | Mitigation | Contingency | Status |
|----|------|:-----------:|:------:|-------|------------|-------------|:------:|
| R-01 | **Contributor retention too low** -- D7 < 20%, contributors churn after first contribution | High | Critical | Marketing (T7) | Gamification v1, weekly payouts, campus ambassador social pressure | Pivot to paid field agents (higher cost, more reliable) | OPEN |
| R-02 | **No B2B buyer found in Phase 1** -- all outreach yields zero interest | Medium | High | Marketing (T7) | Multi-ICP approach (FMCG + fintech + NGO in parallel) | Pivot to open data / grant funding model; extend Phase 1 by 4 weeks | OPEN |
| R-03 | **Data quality insufficient for B2B** -- high fraud rate degrades dataset trust | Medium | Critical | Fraud (T5) | Automated fraud scoring, EXIF checks, cross-contributor verification | Manual review of all submissions (expensive but quality-preserving) | OPEN |
| R-04 | **Single-person bus factor** -- Charles as sole developer/operator | High | Critical | Project Leader (T8) | Document all runbooks (doc 03), automate deployments, write architectural decision records | Identify 1-2 technical contributors who can operate the platform | OPEN |
| R-05 | **Supabase cost spike** -- contributor growth drives unexpected database costs | Low | Medium | Cloud Architect (T1) | Usage monitoring, cost alerts at $50/$100/$200 thresholds (doc 03) | Migrate to self-hosted Postgres on Railway/Fly.io | OPEN |
| R-06 | **Competitor launches in Bonamoussadi** -- another data platform targets same geography | Low | Medium | Marketing (T7) | Speed to market, community relationships as moat | Pivot to partnership or differentiate on vertical depth | OPEN |
| R-07 | **Mobile connectivity worse than expected** -- offline queue edge cases cause data loss | Medium | High | Cloud Engineer (T3) | Offline queue already handles exponential backoff; add queue size monitoring | Increase IndexedDB queue limit, add SMS fallback for critical submissions | OPEN |
| R-08 | **Regulatory challenge** -- data collection requires permits or faces legal pushback | Low | High | Project Leader (T8) | Research Cameroon data protection laws (Loi N2024/014), consult local counsel | Restrict to non-PII data collection, partner with licensed entity | OPEN |

### 5.2 Assumptions

| ID | Assumption | Impact if Wrong | Validation Method | Status |
|----|------------|-----------------|-------------------|:------:|
| A-01 | University students in Bonamoussadi will contribute for 5,000-10,000 FCFA/week equivalent | Contributor model fails; need higher payouts or different demographic | Track actual contribution rates in weeks 5-7 | UNVALIDATED |
| A-02 | FMCG companies will pay $2,000-$15,000/month for retail audit data | Revenue model fails; need different pricing or customer segment | B2B outreach responses in weeks 6-9 | UNVALIDATED |
| A-03 | 200 verified points across 3 categories is achievable in 12 weeks | Phase 1 timeline fails | Weekly point creation velocity tracking from week 5 | UNVALIDATED |
| A-04 | PWA is sufficient for field contributors (no native app needed) | Contributor UX is too poor for retention | D7 retention analysis after 50+ contributors onboarded | UNVALIDATED |
| A-05 | Bonamoussadi (est. 100,000+ population) has enough POIs to be interesting to B2B buyers | Dataset is too small to sell; need to expand geography sooner | Map saturation analysis after 150+ points | UNVALIDATED |
| A-06 | Manual contributor payouts via mobile money are feasible up to 50 contributors | Payout overhead becomes unsustainable | Track payout time per contributor weekly | UNVALIDATED |
| A-07 | Vercel + Supabase free/hobby tiers are sufficient for Phase 1 costs | Need budget for infrastructure earlier than planned | Monthly infrastructure cost tracking | UNVALIDATED |
| A-08 | Monthly/weekly data freshness is sufficient for first buyers (per Kasi Insight feedback) | Buyers demand real-time; architecture needs redesign | Validate in first B2B conversations | PARTIALLY VALIDATED |

### 5.3 Issues

| ID | Issue | Priority | Owner | Action Required | Due Date | Status |
|----|-------|:--------:|-------|-----------------|:--------:|:------:|
| I-01 | Gemini API key exposed in client bundle | P1 | Cloud Engineer (T3) | Move to server-side API route per doc 04 finding S-01 | Week 1 | OPEN |
| I-02 | No rate limiting on any API endpoint | P1 | Cloud Engineer (T3) | Implement Vercel KV-based rate limiter per doc 03 | Week 2 | OPEN |
| I-03 | No staging environment exists | P2 | Cloud Engineer (T3) | Create separate Supabase project + Vercel preview branch | Week 2 | OPEN |
| I-04 | Admin review queue lacks fraud indicators | P2 | Cloud Engineer (T3) | Add risk score, EXIF flags, and distance alerts to review UI | Week 4 | OPEN |
| I-05 | No automated backups for Supabase data | P2 | Cloud Engineer (T3) | Configure pg_dump cron + Supabase point-in-time recovery | Week 3 | OPEN |
| I-06 | Contributor payout process undefined | P3 | Marketing (T7) | Define payout frequency, threshold, mobile money flow | Week 5 | OPEN |

### 5.4 Decisions

| ID | Decision | Date | Made By | Rationale | Alternatives Considered |
|----|----------|:----:|---------|-----------|------------------------|
| D-01 | Start with Bonamoussadi only, no multi-city in Phase 1 | 2026-02-26 | Charles + Kasi Insight feedback | Must prove unit economics and operational model in one neighborhood before expanding | Multi-city from day 1 (rejected: too expensive, quality risk) |
| D-02 | Target monthly/weekly delta reports, not real-time | 2026-02-26 | Charles + Kasi Insight feedback | "The continent is fine with monthly or even weekly data" -- real-time is overkill for first buyers | Real-time streaming API (rejected: overbuilt for current demand) |
| D-03 | PWA over native app | 2026-02-27 | Cloud Architect (T1) | Zero app store friction, instant updates, lower development cost. Revisit if D7 retention < 15% | React Native (rejected: higher cost, app store delays) |
| D-04 | Serverless-first architecture | 2026-02-27 | Cloud Architect (T1) | Zero idle cost, auto-scaling, no ops burden at MVP stage | Container-based (rejected: fixed costs, ops overhead) |
| D-05 | Event-sourcing data model (append-only) | 2026-02-27 | System Design (T2) | Full audit trail, replay capability, data provenance for B2B trust | Mutable records (rejected: lose provenance, audit trail) |
| D-06 | Focus on 3 initial verticals: pharmacy, mobile money, fuel station | 2026-02-26 | Charles + Kasi Insight feedback | High churn categories with clear buyer demand | All verticals at once (rejected: scope too broad) |

---

## 6. Stakeholder Cadence

### 6.1 Internal Cadence

| Ceremony | Frequency | Duration | Participants | Purpose | Output |
|----------|-----------|----------|--------------|---------|--------|
| **Daily standup** | Daily (async on Slack/WhatsApp) | 5 min | All active team members | Blockers, progress, plan for today | Written update in #adl-standup channel |
| **Sprint planning** | Every 2 weeks (Monday) | 60 min | All team leads | Define sprint goals, assign tasks, identify dependencies | Sprint backlog in project board |
| **Sprint review** | Every 2 weeks (Friday) | 45 min | All team leads | Demo completed work, review KPI dashboard, update RAID log | Sprint review notes, updated RAID log |
| **Retrospective** | Every 2 weeks (Friday, after review) | 30 min | All team leads | What worked, what didn't, process improvements | Action items with owners |
| **Technical sync** | Weekly (Wednesday) | 30 min | T1 + T2 + T3 + T4 | Architecture decisions, code review, technical debt triage | ADR (Architectural Decision Record) if needed |
| **Growth sync** | Weekly (Thursday) | 30 min | T6 + T7 + T8 | Contributor metrics, B2B pipeline, marketing experiments | Updated funnel metrics, experiment results |

### 6.2 External Stakeholder Cadence

| Stakeholder | Frequency | Format | Content | Owner |
|------------|-----------|--------|---------|-------|
| **Yannick Lefang (Kasi Insight)** | Monthly | 30-min call or in-person | Progress vs. his recommendations, specific questions, partnership exploration | Project Leader (T8) |
| **B2B pilot prospects** | As needed (minimum bi-weekly during M4-M5) | Email + call/demo | Data sample, coverage stats, pricing discussion | Marketing (T7) |
| **Campus ambassadors** | Weekly | WhatsApp group message | Performance stats, tips, payout confirmation, recognition | Marketing (T7) |
| **Active contributors (top 20)** | Bi-weekly | WhatsApp broadcast | Leaderboard update, new features, feedback request | Marketing (T7) |
| **Potential investors / advisors** | Monthly | Email update | Key metrics (WAC, verified points, freshness, pipeline), asks | Project Leader (T8) |
| **Technical advisors** | As needed | Async (email/chat) | Architecture review requests, scaling questions | Cloud Architect (T1) |

### 6.3 Reporting Templates

#### Weekly Status Report (sent every Friday by Project Leader)

```
# ADL Weekly Status -- Week [N] of Phase 1
Date: [YYYY-MM-DD]

## North Star Metrics
- Verified Data Points: [X] / 200 target
- Weekly Active Contributors (WAC): [X] / 20 target
- Data Freshness (median): [X] days / < 14 days target
- Fraud Detection Rate: [X]% / 60% target

## Milestone Status
- M1 (Foundation): [GREEN/YELLOW/RED] -- [one-line status]
- M2 (Data Quality): [GREEN/YELLOW/RED] -- [one-line status]
- M3 (Contributor Launch): [GREEN/YELLOW/RED] -- [one-line status]
- M4 (B2B Pipeline): [GREEN/YELLOW/RED] -- [one-line status]
- M5 (Scale & Validate): [GREEN/YELLOW/RED] -- [one-line status]
- M6 (Phase 1 Close): [GREEN/YELLOW/RED] -- [one-line status]

## Top 3 Accomplishments This Week
1. [...]
2. [...]
3. [...]

## Top 3 Risks / Blockers
1. [...]
2. [...]
3. [...]

## Key Decisions Made
- [D-XX]: [decision summary]

## Next Week Focus
1. [...]
2. [...]
3. [...]
```

#### Monthly Investor/Advisor Update

```
# ADL Monthly Update -- [Month Year]

## Headline
[One sentence: biggest achievement or learning this month]

## Key Metrics
| Metric | Last Month | This Month | Target |
|--------|-----------|------------|--------|
| Verified Points | ... | ... | 200 |
| WAC | ... | ... | 20 |
| Freshness (median days) | ... | ... | < 14 |
| B2B Pipeline | ... | ... | 1 pilot |

## What Worked
- [...]

## What Didn't Work
- [...]

## Key Learnings
- [...]

## Ask
[Specific help needed: intros, advice, resources]
```

---

## 7. Decision Log

### 7.1 Decision Framework

All decisions are categorized by reversibility and impact:

| | Low Impact | High Impact |
|---|---|---|
| **Easily Reversible** | Anyone decides, inform team async | Team lead decides, discuss at standup |
| **Hard to Reverse** | Team lead decides, discuss at sprint planning | Project Leader + relevant leads decide, document in RAID log |

### 7.2 Pending Decisions

| ID | Decision Needed | Options | Deadline | Owner | Dependencies |
|----|----------------|---------|:--------:|-------|--------------|
| PD-01 | Contributor payout mechanism | (a) MTN MoMo manual, (b) Orange Money manual, (c) Both, (d) Airtime credit | Week 4 | Marketing (T7) + Project Leader (T8) | A-06 validation |
| PD-02 | First B2B vertical to target aggressively | (a) FMCG/Beverage (retail audit), (b) Fintech/MoMo (agent mapping), (c) NGO/Dev agency | Week 6 | Marketing (T7) + Project Leader (T8) | B2B outreach responses |
| PD-03 | Pricing model for B2B | (a) Subscription, (b) Per-query API, (c) Project-based, (d) Hybrid | Week 8 | Marketing (T7) | First B2B conversations |
| PD-04 | Phase 2 geography | (a) Expand within Douala, (b) Add Yaounde, (c) Add another country | Week 11 | Project Leader (T8) | Phase 1 results |
| PD-05 | Hire first team member vs. stay solo | (a) Part-time technical contributor, (b) Part-time field coordinator, (c) Stay solo | Week 10 | Project Leader (T8) | Budget, Phase 1 traction |

---

## 8. Execution Governance

### 8.1 Sprint Structure

- **Sprint length:** 2 weeks
- **Sprint 1:** Weeks 1-2 (M1: Foundation)
- **Sprint 2:** Weeks 3-4 (M2: Data Quality & Fraud)
- **Sprint 3:** Weeks 5-6 (M3: Contributor Launch + M4 start)
- **Sprint 4:** Weeks 7-8 (M3 close + M4 + M5 start)
- **Sprint 5:** Weeks 9-10 (M5: Scale & Validate)
- **Sprint 6:** Weeks 11-12 (M6: Phase 1 Close)

### 8.2 Definition of Done

A deliverable is "done" when:

1. Code is merged to `main` branch (if code change)
2. Tests pass in CI/CD pipeline
3. Deployed to staging and smoke-tested
4. Deployed to production
5. Documented (runbook updated if operational, ADR if architectural)
6. Demo'd at sprint review
7. Acceptance criteria met (per milestone table)

### 8.3 Escalation Path

```
Level 1: Team lead resolves within 24 hours
    |
    v (unresolved)
Level 2: Project Leader (T8) mediates within 48 hours
    |
    v (unresolved)
Level 3: Charles (founder) makes final call
```

### 8.4 Change Control

Any change to Phase 1 scope, milestones, or success criteria requires:

1. Written change request (who, what, why, impact on timeline)
2. Impact assessment by affected team leads
3. Approval by Project Leader (T8)
4. Updated RAID log entry
5. Communication at next sprint planning

### 8.5 Budget Tracking (Phase 1)

| Category | Monthly Budget | Notes |
|----------|:-------------:|-------|
| **Infrastructure** (Vercel + Supabase) | $0-$50 | Free/hobby tiers; alert at $50 |
| **Contributor payouts** | $100-$300 | 20 contributors x 5,000-15,000 FCFA/month |
| **Marketing** (WhatsApp, flyers, campus events) | $50-$150 | Low-cost guerrilla marketing |
| **Tools** (analytics, monitoring, email) | $0-$50 | Free tiers where possible |
| **Contingency** | $100 | Unexpected costs |
| **Total Phase 1 monthly** | **$250-$650** | |
| **Total Phase 1 (12 weeks)** | **$750-$1,950** | |

### 8.6 Phase 1 Weekly Checklist (Project Leader)

- [ ] Monday: Review sprint backlog, unblock any dependencies
- [ ] Tuesday: Check KPI dashboard (WAC, verified points, freshness)
- [ ] Wednesday: Attend technical sync, review any PRs or ADRs
- [ ] Thursday: Attend growth sync, review B2B pipeline
- [ ] Friday: Write weekly status report, update RAID log, send to stakeholders
- [ ] Bi-weekly: Run sprint review + retrospective
- [ ] Monthly: Send investor/advisor update, schedule Kasi Insight check-in

---

## Appendix A: Team Contact Sheet

| Role | Teammate | Primary Channel | Backup Channel |
|------|----------|----------------|----------------|
| Cloud Architect (T1) | [TBD / Charles] | Slack #adl-infra | Email |
| System Design (T2) | [TBD / Charles] | Slack #adl-engineering | Email |
| Cloud Engineer (T3) | Charles | Slack #adl-engineering | WhatsApp |
| Cybersecurity (T4) | [TBD / Charles] | Slack #adl-security | Email |
| Fraud Specialist (T5) | [TBD / Charles] | Slack #adl-data | Email |
| Data Analyst (T6) | [TBD / Charles] | Slack #adl-data | Email |
| Marketing (T7) | [TBD / Charles] | Slack #adl-growth | WhatsApp |
| Project Leader (T8) | Charles | Slack #adl-general | WhatsApp |

> **Note:** In Phase 1, Charles wears most hats. The RACI matrix above is designed so that when team members are added, ownership transfers cleanly. Each document (01-08) serves as the onboarding brief for that role.

---

## Appendix B: Document Cross-Reference Matrix

This matrix shows how each team document feeds into the execution plan:

| Document | Feeds Into (Milestones) | Key Artifacts Used |
|----------|------------------------|-------------------|
| 01 - Cloud Architecture | M1 (infrastructure decisions), all phases (architecture principles) | NFR targets, environment strategy, cost model |
| 02 - System Design | M1 (API spec), M2 (verification logic), M4 (API docs) | Service boundaries, data model, API contracts |
| 03 - Cloud Engineering | M1 (IaC, CI/CD, staging), M2 (fraud pipeline deployment) | Runbooks, deployment pipeline, observability stack |
| 04 - Cybersecurity | M1 (security fixes), M5 (pre-B2B audit) | Threat model, vulnerability findings, incident response plan |
| 05 - Fraud Strategy | M2 (fraud pipeline), M5 (detection rate validation) | Risk scoring model, detection rules, response playbooks |
| 06 - Data Analytics | M1 (KPI dashboard), M5 (retention analysis), M6 (unit economics) | KPI definitions, SQL queries, dashboard designs, alert rules |
| 07 - Marketing Strategy | M3 (contributor acquisition), M4 (B2B outreach), M6 (pipeline) | ICPs, personas, positioning, channel strategy, 90-day playbook |
| 08 - Project Plan (this) | All milestones | Scope, RACI, dependencies, RAID, cadence |

---

*This document is the single source of truth for ADL project execution. All team members should reference this for scope, ownership, and timeline questions. Update the RAID log continuously. Review the milestone status at every sprint boundary.*
