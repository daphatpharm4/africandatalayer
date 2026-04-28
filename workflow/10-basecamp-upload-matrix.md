# African Data Layer -- Basecamp Upload Matrix

**Purpose:** define the smallest clean document set to upload into Basecamp, with exact formats, filenames, and folder placement.

**Current repo snapshot:** `120` doc-like files (`.md`, `.pdf`, `.csv`, `.json`, `.txt`, office files).

---

## 1. Recommended Basecamp Folder Structure

| Folder | Purpose | Typical contents |
|---|---|---|
| `01 Overview` | project-level summary and direction | program overview, one-pagers |
| `02 Architecture` | system and data design | system design, cloud architecture |
| `03 Delivery` | execution and milestone tracking | project plan, sprint plans, release flow |
| `04 Compliance` | policy and operational risk docs | privacy, terms, incident response |
| `05 Design-Research` | UX and product rationale | redesign plans, research syntheses |
| `06 GTM-Pitch` | external positioning and commercial docs | pitch decks, buyer strategy |
| `07 Data-Templates` | structured templates and schemas | CSV templates, dashboard schemas |
| `08 Automation-Optional` | workflow payloads for operators | n8n workflow JSON files |

---

## 2. Phase 1 Upload Set -- Upload These 3 First

| Priority | Repo source | Basecamp file name | Format | Basecamp folder | Why this belongs in Basecamp |
|---|---|---|---|---|---|
| 1 | `docs/APP-MODERNIZATION-AND-GAMIFICATION-PROGRAM.md` | `01_ADL-Program-Overview.pdf` | PDF | `01 Overview` | best top-level product, delivery, and modernization summary |
| 2 | `docs/system-design-bonamoussadi.md` | `02_ADL-System-Design.pdf` | PDF | `02 Architecture` | strongest structural reference for data model, entity logic, and scaling baseline |
| 3 | `docs/team/08-service-delivery-project-plan.md` | `03_ADL-Execution-Plan.pdf` | PDF | `03 Delivery` | clearest milestone, ownership, dependency, and governance plan |

**Default rule:** upload these as `PDF`, not raw `Markdown`. Basecamp audience reads faster in exported narrative format.

---

## 3. Optional Wave 2 Uploads

Use only if the Basecamp project needs broader cross-functional access.

| Repo source | Basecamp file name | Format | Basecamp folder | Notes |
|---|---|---|---|---|
| `docs/pitch-one-pager-kasi-insight.md` | `04_ADL-Strategic-One-Pager.pdf` | PDF | `01 Overview` | good founder, advisor, or investor context |
| `docs/team/04-cybersecurity.md` | `05_ADL-Security-Assessment.pdf` | PDF | `04 Compliance` | useful if delivery includes security workstream review |
| `design/DEFINITIVE-UI-PLAN.md` | `06_ADL-UI-Plan.pdf` | PDF | `05 Design-Research` | use for design handoff visibility |
| `docs/vertical-delta-templates/01_unified_delta_dashboard_schema.csv` | `07_ADL-Delta-Dashboard-Schema.csv` | CSV | `07 Data-Templates` | keep as native CSV, not PDF |
| `docs/vertical-delta-templates/00_verticals_overview_matrix.csv` | `08_ADL-Verticals-Overview-Matrix.csv` | CSV | `07 Data-Templates` | structured planning asset |

---

## 4. Export Format Rules

| Source type | Export rule | Reason |
|---|---|---|
| Narrative `.md` docs | export to `PDF` | easiest Basecamp consumption, preserves ordering and headings |
| Data templates `.csv` | upload as `CSV` | should stay machine-readable |
| Workflow payloads `.json` | upload as `JSON` only if operators need importable automation files | avoid noise for non-technical readers |
| Existing `.pdf` docs | upload as-is | no conversion needed |

**Do not upload by default:**
- `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`
- `docs/superpowers/*`
- `issues/*`
- draft duplicates such as files ending with ` 2.md`

Those are internal process artifacts, not Basecamp-facing project docs.

---

## 5. Upload Order

1. Upload `01_ADL-Program-Overview.pdf`
2. Upload `02_ADL-System-Design.pdf`
3. Upload `03_ADL-Execution-Plan.pdf`
4. Add optional Wave 2 docs only if a stakeholder asks for deeper design, security, or data-template context

This order gives Basecamp a clean narrative:
- what ADL is doing
- how the system is designed
- how delivery is managed

---

## 6. Repo Documentation Map

| Area | Count | Notes |
|---|---|---|
| top-level docs | 9 | includes `README.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `novagarage.md` |
| `docs/` | 81 | main documentation library |
| `design/` | 3 | UI and redesign plans |
| `research/` | 11 | research and strategy synthesis |
| `workflow/` | 10 | operational project artifacts including this matrix |
| `gptdesign/` | 5 | prompt-driven design specs |
| `output/pdf/` | 1 | generated PDF summary |

---

## 7. Exact Repo Paths for Phase 1

- `docs/APP-MODERNIZATION-AND-GAMIFICATION-PROGRAM.md`
- `docs/system-design-bonamoussadi.md`
- `docs/team/08-service-delivery-project-plan.md`

These three are the cleanest first-pass Basecamp document pack.
