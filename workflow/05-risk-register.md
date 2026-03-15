# ADL Risk Register -- Bonamoussadi Pilot

**Purpose:** Operational risk tracker for the 6-week Bonamoussadi pilot (April 14 -- May 22, 2026). Contains a risk heat map, categorized risk table with mitigations, and a weekly review checklist. Update the Status column at every Friday review meeting.

**Risk Scoring:** Probability (1--5) x Impact (1--5) = Score (1--25)
- Probability: 1 = Very Low, 2 = Low, 3 = Medium, 4 = High, 5 = Very High
- Impact: 1 = Negligible, 2 = Low, 3 = Medium, 4 = High, 5 = Critical

---

## 1. Risk Heat Map

```
                          I M P A C T
                 1          2          3          4          5
              Negligible   Low      Medium     High     Critical
           +----------+----------+----------+----------+----------+
     5     |          |          |          |          |          |
  Very     |          |          |          |          |          |
  High     |          |          |          |          |          |
           +----------+----------+----------+----------+----------+
     4     |          |          |  R06,R09 |  R10     |  R01,R02 |
  High     |          |          |          |          |          |
           |          |          |          |          |          |
           +----------+----------+----------+----------+----------+
P    3     |          |          |  R04,R12 |  R03,R05 |          |
R Medium   |          |          |  R13     |  R08,R11 |          |
O          |          |          |          |  R14,R15 |          |
B  +-------+----------+----------+----------+----------+----------+
     2     |          |  R17     |  R19,R20 |  R16     |  R07,R09 |
  Low      |          |          |          |          |  R18     |
           |          |          |          |          |          |
           +----------+----------+----------+----------+----------+
     1     |          |          |          |  R21     |          |
  Very     |          |          |          |          |          |
  Low      |          |          |          |          |          |
           +----------+----------+----------+----------+----------+

LEGEND:  Score 1-4 = LOW (monitor)
         Score 5-9 = MODERATE (mitigate and track)
         Score 10-15 = HIGH (active mitigation required)
         Score 16-25 = CRITICAL (immediate action required)
```

**Critical Zone (score >= 16):** R01 (GPS spoofing), R02 (fabricated submissions)
**High Zone (score 10--15):** R03--R05, R07--R11, R14--R15
**Moderate Zone (score 5--9):** R04, R06, R12--R13, R16--R17, R19--R20
**Low Zone (score 1--4):** R17, R19--R21

---

## 2. Risk Register

### 2.1 Fraud Risks

| ID | Risk | Prob | Impact | Score | Mitigation | Owner | Trigger | Escalation | Status |
|---|---|---|---|---|---|---|---|---|---|
| R01 | **GPS spoofing by agents** -- fabricated submissions from home using mock location apps | 4-High | 5-Critical | **20** | Multi-layered detection: client-side mock location API check, EXIF GPS cross-validation (1km threshold, 2km for low-end devices), IP geolocation (50km), velocity analysis (>200km/h = block, >80km/h = flag), accelerometer sensor data, batch statistical anomaly detection | Charles | >5% of submissions flagged for GPS anomalies in a single week; any agent with >3 GPS flags in one day | Immediate: suspend agent pending investigation; review all agent submissions for the day; escalate to Team Lead for field verification |
| R02 | **Fabricated / ghost entity submissions** -- phantom POIs with random storefront photos | 4-High | 5-Critical | **20** | Photo evidence required for all submissions; perceptual hash (aHash) deduplication (Hamming distance <=5 = flag); entity proximity thresholds per vertical (e.g., 10m for mobile_money); spot-check audits (10--50 POIs/week); XP escrowed until admin review | Charles | Audit reveals >20% of sampled POIs do not exist at stated location; photo hashing flags >3 near-identical photos from same agent | Immediate: halt agent submissions; conduct field verification of all agent's recent POIs; if confirmed, terminate agent |
| R10 | **Recycled / stock photos** -- reusing one trip's photos for multiple submissions | 4-High | 4-High | **16** | SHA-256 exact hash matching; perceptual hash with Hamming distance threshold; EXIF fingerprint matching (same device + time + GPS = flag); screenshot detection (no EXIF + specific resolution patterns) | Charles | Photo hash system flags >2 near-identical photos from same agent in one day | Review agent's submission batch; if confirmed recycling, reject all and issue warning; second offense = termination |
| R11 | **Agent collusion to inflate XP** -- circular enrichment between agents | 3-Medium | 4-High | **12** | Graph analysis of user-to-user and user-to-point relationships; detect circular enrichment patterns (Agent A creates, Agent B enriches, reverse); monitor cross-agent duplicate submissions within proximity thresholds | Charles | >5 instances of Agent X enriching Agent Y's POIs AND Agent Y enriching Agent X's POIs in one week | Freeze XP for involved agents; conduct field audit of the specific POIs; if confirmed, restructure zone assignments to prevent contact |
| R14 | **Alt account farming** -- agents registering multiple accounts to multiply XP | 3-Medium | 4-High | **12** | Device fingerprint binding (deviceId in localStorage); same IP + device fingerprint across multiple userIds = flag; phone verification requirement; limit one account per SIM | Charles | DeviceId or IP appears linked to >1 active user account | Suspend secondary accounts immediately; investigate primary account; if confirmed, terminate all accounts for that individual |
| R12 | **Fraud detection false positives frustrate agents** -- legitimate submissions wrongly flagged | 3-Medium | 3-Medium | **9** | Low-end device exceptions for GPS accuracy thresholds (2km EXIF vs 1km standard); gradual threshold tuning based on W2 data; transparent quality feedback to agents; trust tiers (new/established/veteran) with escalating autonomy | Charles | Agent complaints about false flags exceed 3 per week; agent morale visibly declining due to rejections | Adjust thresholds based on device-specific analysis; communicate changes to agents; consider promoting high-trust agents to "established" tier earlier |

### 2.2 Operational Risks

| ID | Risk | Prob | Impact | Score | Mitigation | Owner | Trigger | Escalation | Status |
|---|---|---|---|---|---|---|---|---|---|
| R03 | **Cannot hire qualified Team Lead by W1D3** | 3-Medium | 4-High | **12** | Pre-screen candidates before pilot start; have backup candidate identified; Charles can remotely manage W1 if needed via daily WhatsApp video calls | Charles | No confirmed candidate by W1D2 (April 15) | Activate backup candidate; if no backup, Charles takes direct field management role for W1 and intensifies search; delay agent hiring by 1 day max |
| R04 | **Field agents produce low-quality data** (blurry photos, wrong GPS, missing fields) | 3-Medium | 3-Medium | **9** | Structured 3-hour training (W1D4); supervised test day with quality gate (W1D5); progressive disclosure UI (3-tap capture); daily Team Lead coaching; performance bonuses tied to quality not volume | Team Lead | Submission quality score drops below 70% for any agent for 2 consecutive days | Team Lead provides 1-on-1 coaching session; review specific failure patterns; if no improvement in 3 days, consider agent replacement |
| R05 | **Zero client meetings by end of W6** | 3-Medium | 4-High | **12** | Start outreach W5D1 (not later); free data samples as hook; 10+ outreach messages; leverage advisor network (Yannick Lefang); target Yango (fastest close) and SABC (highest value) simultaneously | Charles | Fewer than 3 outreach messages sent by W5D3; zero positive replies by W5D5 | Broaden outreach to Tier 2 targets immediately; offer more generous free pilot terms; leverage any personal network connections; accept that CONDITIONAL GO is acceptable outcome |
| R08 | **Admin review bottleneck** -- Charles is sole reviewer, queue backs up | 4-High | 3-Medium | **12** | Auto-approve submissions with fraud score <20 and confidence >70; batch approval for low-risk items; prioritize fraud-flagged submissions only for manual review; train Team Lead as secondary reviewer by W3 | Charles | Review backlog exceeds 100 submissions; turnaround exceeds 72 hours | Raise auto-approve threshold temporarily; enable Team Lead as reviewer for low-risk items; batch-approve all submissions from veteran-tier agents |
| R13 | **Agent attrition during pilot** -- agent quits or stops showing up | 3-Medium | 3-Medium | **9** | Competitive pay (CFA 120--150K/month total); performance bonuses (up to CFA 30K); gamification (XP, leaderboard); community building; branded identity and sense of mission | Team Lead | Agent misses 2 consecutive days without notice; agent productivity drops below 15 submissions/day for 3+ days | Team Lead conducts retention conversation; address specific grievance; if agent departs, redistribute zones among remaining agents and Team Lead absorbs extra coverage |
| R16 | **Phone theft or damage in field** | 2-Low | 2-Low | **4** | Phone cases + screen protectors budgeted; equipment agreement signed by agents; 15% contingency covers replacement; agents carry equipment home (not stored centrally) | Team Lead | Agent reports phone lost, stolen, or broken | Replace from contingency budget (CFA 75,000); file police report if stolen; reassign agent to partner with another agent while replacement procured (1--2 day turnaround) |
| R17 | **Community resistance to data collectors** | 2-Low | 3-Medium | **6** | Branded ADL ID badges and T-shirts; agents explain ADL mission (mapping businesses, not collecting personal data); no personal data collected; photos of public storefronts only; Team Lead handles all escalations; community chief engagement | Team Lead | Agent reports verbal confrontation or refusal to be photographed; community leader raises complaint | Team Lead visits area personally; explains project to concerned parties; avoid photographing the specific business if owner objects; escalate to Charles if formal complaint received |
| R18 | **Charles unavailable due to personal emergency** | 2-Low | 5-Critical | **10** | Document all platform access credentials in secure vault; Team Lead trained to manage field ops independently for 1 week; weekly snapshot cron is automated; emergency escalation path: Team Lead continues field ops, admin review pauses | Charles | Charles unreachable for >24 hours during pilot | Team Lead takes full operational command; field collection continues; admin review pauses (auto-approve threshold raised); Charles designates emergency contact for platform issues |
| R20 | **Rainy season early onset disrupts W5--W6 fieldwork** | 2-Low | 3-Medium | **6** | Pilot starts April (dry season); typical rain onset June; if early rain, pivot to transport_road condition data (highest value during rain); equip agents with umbrellas and raincoats | Team Lead | Sustained rainfall disrupts >50% of planned field hours in a single week | Shift all agents to transport_road data collection (flooding events are highest-value data); accept reduced coverage on other verticals; document road conditions as proof-of-concept for rainy-season product |

### 2.3 Commercial Risks

| ID | Risk | Prob | Impact | Score | Mitigation | Owner | Trigger | Escalation | Status |
|---|---|---|---|---|---|---|---|---|---|
| R05 | See Operational Risks (R05 -- zero client meetings) | -- | -- | -- | -- | -- | -- | -- | -- |
| R19 | **Budget overrun** | 2-Low | 3-Medium | **6** | 15% contingency (CFA 272,893) budgeted; weekly expense tracking; no variable costs beyond personnel and data plans; W1 front-loaded spend (CFA 948K), W2--6 steady state (CFA 174K/week) | Charles | Cumulative spend exceeds plan by >10% at any weekly checkpoint | Identify overspend source; cut optional operations costs (e.g., defer CEO travel, reduce meeting refreshments); draw from contingency; if contingency exhausted, evaluate scope reduction |
| R21 | **Competitor launches similar product in Douala** | 1-Very Low | 4-High | **4** | ADL's head start with ground-truth data is the moat; 6-week pilot creates a dataset no competitor has; focus on execution speed and data quality over feature breadth | Charles | Discovery of a competing ground-truth data product operating in Douala | Accelerate outreach; emphasize ADL's existing dataset and delta history; lock in early customers; do not engage in price war |

### 2.4 Technical Risks

| ID | Risk | Prob | Impact | Score | Mitigation | Owner | Trigger | Escalation | Status |
|---|---|---|---|---|---|---|---|---|---|
| R06 | **Connectivity issues during field capture** | 4-High | 3-Medium | **12** | Offline-first architecture (IndexedDB queue with idempotency keys); exponential backoff sync; no data loss by design; agents trained to sync on WiFi at end of day; sync status bar always visible in app | Charles | >5% sync failure rate for any agent over 2 consecutive days | Investigate: network issue vs. app bug; if network, advise agents on WiFi sync points; if app bug, deploy fix; verify IndexedDB queue is retaining submissions |
| R07 | **Platform downtime during field hours (7 AM -- 6 PM WAT)** | 2-Low | 5-Critical | **10** | Offline-first design means agents can work without server; Vercel 99.9% SLA; Neon monitoring alerts (>80% disk, >50 connections, queries >5s); automated snapshot cron | Charles | Platform unreachable for >30 minutes during field hours; Neon alert triggers | Check Vercel status page; check Neon dashboard; if provider outage, notify Team Lead that agents should continue offline; if ADL-side issue, diagnose and deploy fix |
| R15 | **Unauthorized bulk data export** | 3-Medium | 4-High | **12** | Rate limiting on API endpoints; per-user export throttling; audit logging of all data access; role-based access control (field agents cannot export); API keys scoped to role | Charles | Unusual spike in API read requests from a single user; export volume exceeding normal patterns | Temporarily revoke access token; investigate user and request pattern; if malicious, block account; review RBAC permissions |

### 2.5 Regulatory Risks

| ID | Risk | Prob | Impact | Score | Mitigation | Owner | Trigger | Escalation | Status |
|---|---|---|---|---|---|---|---|---|---|
| R09 | **Data protection compliance risk** -- Cameroon Law No. 2024/017 (deadline June 23, 2026) | 2-Low | 5-Critical | **10** | Consent collection flow deployed in PWA by W1D4; no PII collected beyond business names; photos of public storefronts only (not individuals); begin data controller registration before pilot end; international data transfer safeguards for Lyon-Douala flow | Charles | Regulatory inquiry or complaint about ADL data collection; June 2026 deadline approaching without registration | Engage local legal counsel for data controller registration; review all collected data for PII compliance; prepare compliance documentation; if complaint received, pause collection pending legal review |

### 2.6 Security Risks

| ID | Risk | Prob | Impact | Score | Mitigation | Owner | Trigger | Escalation | Status |
|---|---|---|---|---|---|---|---|---|---|
| R07 | See Technical Risks (R07 -- platform downtime) | -- | -- | -- | -- | -- | -- | -- | -- |
| R15 | See Technical Risks (R15 -- unauthorized export) | -- | -- | -- | -- | -- | -- | -- | -- |
| R22 | **Insider data manipulation** -- direct database modification bypassing event-sourced model | 2-Low | 5-Critical | **10** | Event-sourced append-only model creates audit trail; dedicated fraud_audit_log table; admin action logging in admin_reviews table; principle of least privilege for database access; only Charles has direct DB access during pilot | Charles | Discrepancy between point_events log and projected point state; unexplained data changes in audit trail | Forensic review of database logs; compare point_events history with current state; if manipulation confirmed, restore from event log; revoke compromised access |

---

## 3. Weekly Risk Review Checklist

Complete every Friday during the weekly review meeting (4:00 PM WAT). The Team Lead and CEO review each question together.

### Friday Risk Review Questions

- [ ] **1. Fraud signals:** Did any agent trigger >3 fraud flags this week? Are there new patterns (GPS clustering, photo reuse, velocity anomalies) that suggest systematic fraud?

- [ ] **2. Data quality trend:** Is the submission quality score (GPS <50m + photo + required fields) trending up, stable, or down compared to last week? If down, which agent or vertical is responsible?

- [ ] **3. Agent health:** Are all agents active and meeting productivity targets (30--50 submissions/day)? Has any agent expressed intent to leave, shown declining motivation, or missed days?

- [ ] **4. Technical stability:** Were there any sync failures >5%, platform outages, data loss events, or database alerts this week? Is the review backlog under 100?

- [ ] **5. Budget tracking:** What is cumulative spend vs. plan? Are we within the 15% contingency, or approaching the ceiling? Any unexpected costs?

- [ ] **6. New or escalated risks:** Has any risk materialized that was not on this register? Has any existing risk changed in probability or impact since last week? Update the Status column for any changed risks.

### After the Review

- Update risk Status column (Open / Mitigated / Materialized / Closed)
- Log any new risks with ID, scoring, and mitigation
- Assign action items for risks that need immediate attention
- Carry forward unresolved items to next Friday

---

## Sources

- `research/06-fraud-specialist-anti-fraud.md` -- Section 1 (fraud threat landscape, risk heat map, threat categorization matrix), detection pipelines, scoring models
- `research/10-FINAL-STRATEGY-synthesis.md` -- Section 5 (risk register, top 20 risks with mitigations)
- `research/09-project-leader-execution-plan.md` -- Section 6 (RAID log: risks, actions, issues, decisions), escalation procedures, governance cadence
- `research/05-cybersecurity-security-privacy.md` -- Threat model (GPS spoofing T4, agent impersonation T2), privacy framework for Law 2024/017
