# Discovery Deck — Configurable Data Operations Platform

**Date:** 2026-07-20  
**Audience:** Prospective pilot buyers (municipal operators, utilities, ESG / field ops leads)  
**Status:** Sellable companion to Stage 3 platform outputs  
**Demo org:** Urban Waste Mapping — Douala (synthetic, no brand partnership)

---

## 1. Opening problem (30 seconds)

Field data about African cities still arrives as spreadsheets, WhatsApp photos, and one-off GIS dumps. Operators cannot answer:

- Where are the bins / outlets / assets **today**?
- What changed this week?
- Which submissions are trustworthy enough to act on?

Buying a custom app for every vertical is slow and expensive. Buying generic forms tools leaves fraud, offline capture, and map-native review unsolved.

---

## 2. Product thesis

**African Data Layer Data Operations Platform** lets an organization:

1. Create an isolated company workspace  
2. Define its own record types (schema) without code  
3. Collect offline on mid-range Android phones  
4. Review evidence with a forensic queue  
5. Export approved CSV / GeoJSON and monitor coverage  

Configurability is the product. Clients do not pick from ADL’s seven hard-coded verticals — they publish their own.

---

## 3. Live demo path (8–12 minutes)

Use the seeded demo org **Urban Waste Mapping — Douala** (`slug: urban-waste-douala-demo`).

| Step | Surface | Show |
|------|---------|------|
| 1 | Console login | Company-only access; invite-gated onboarding |
| 2 | Workspace | Role-aware actions (owner / reviewer / collector) |
| 3 | Projects + schema | Waste bin + dumping point types, bilingual labels, GPS + photo rules |
| 4 | Field capture | Dynamic form, GPS lock, photo evidence, offline queue |
| 5 | Review queue | Approve / reject with reasons; evidence panel |
| 6 | Company data | Approved records list + map |
| 7 | Export | CSV + GeoJSON download (audit-logged) |

**Do not claim:** HYSACAM partnership, real municipal data, or production coverage outside the synthetic seed.

---

## 4. Trust plane (why buyers care)

- Append-only capture history; reviews are auditable  
- GPS accuracy thresholds and photo minimums per record type  
- Tenant isolation: org A never reads org B  
- Exports write `record_exported` audit events  
- Offline-first queue with idempotent sync  

---

## 5. Pilot proposal structure (leave-behind)

| Field | Example |
|-------|---------|
| Geography | One commune / corridor (e.g. Akwa–Bonanjo–Deido) |
| Record target | 2 record types, 500–2 000 approved points |
| Outputs | Weekly CSV + GeoJSON + coverage snapshot |
| Roles | 1 owner, 1–2 reviewers, 5–15 collectors |
| Duration | 6–8 weeks fixed-price pilot |
| Success | Schema published without code; ≥90% offline sync success; zero cross-tenant incidents |

Billing for MVP is manual fixed-price invoicing (Stripe later).

---

## 6. Competitive contrast (honest)

| Approach | Gap vs ADL platform |
|----------|---------------------|
| Generic forms (Kobo, ODK) | Weak multi-tenant SaaS shell, weak fraud/review UX |
| Custom mobile build | Months to first schema change |
| Pure GIS desk tools | No field offline + collector economy |

ADL reuses a production field engine (queue, maps, review patterns) under a tenant console.

---

## 7. Call to action

1. Walk the Douala synthetic demo end-to-end  
2. Map one buyer vertical onto a draft schema in the wizard  
3. Scope a fixed geography pilot with completion date and output pack  

---

## 8. Claim guardrails (content)

Allowed:

- “Synthetic demonstration on the real configuration engine”  
- “Isolated company workspace”  
- “CSV and GeoJSON export of approved records”  

Forbidden:

- Named brand partnerships without contract  
- Inflated coverage or revenue claims  
- Implying demo points are live municipal ground truth  

---

## 9. Assets checklist

- [ ] Demo org seed applied (`20260720_platform_demo_urban_waste_douala.sql`)  
- [ ] Console DATA screen: table / map / CSV / GeoJSON  
- [ ] iOS Console chrome aligned to web console  
- [ ] One bilingual one-pager derived from this deck for email follow-up  
