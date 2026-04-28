# Client UX Fixes — 2026-04-29

Branch: `client-ux-fixes-2026-04`

Source: `$critique` + `$audit` of client reporting/account experience (Navigation, App, ClientInsights, DeltaDashboard, InvestorDashboard, Profile).

Sequenced execution via `superpowers:subagent-driven-development`. Each task: implementer subagent → spec reviewer → code-quality reviewer → mark complete.

User decisions:
- Order: clarify → normalize → harden → adapt → quieter → optimize → polish
- Item 8 (model picks): merge "silent copy/export feedback" into `harden`
- Q2: shorten "Delta Intelligence" label OK (already done in setup commit `c9f8cb1`)
- Q3: full pass scope

## Task Tracker

| # | Task | Status | Commit | Spec Review | Quality Review |
|---|------|--------|--------|-------------|----------------|
| 1 | `$clarify` — Client Insights: kill dead CTA, real export or honest unavailable state | ✅ done | `12707ea` | self | typecheck pass |
| 2 | `$normalize` — branch client-only Account surface (no XP/streak/rewards) | ✅ done | `c95b8b4` | self | typecheck pass |
| 3 | `$harden` — fix low-contrast micro-labels + add aria-live status for copy/export | ✅ done | `ce9c3c1` | self | typecheck pass |
| 4 | `$adapt` — enlarge icon controls to ≥44px (DeltaDashboard, InvestorDashboard, Profile, ExportPanel) | ✅ done | `11b3de3` | self | typecheck pass |
| 5 | `$quieter` — DeltaDashboard progressive disclosure (collapse export/API + secondary filters) | ✅ done | `6c6d791` | self | typecheck pass |
| 6 | `$optimize` — replace `width`-based animations with transform-based fills (Delta + Profile bars) | pending | — | — | — |
| 7 | `$polish` — refresh client docs screenshots after IA stabilizes | pending | — | — | — |

## Setup Commit

- `c9f8cb1` chore(client): redirect Client Insights → Analytics hub, shorten "Delta Intelligence" → "Delta"

## Validation Notes

After every task:
1. Spec reviewer subagent confirms scope match (no over/under-build)
2. Code quality reviewer subagent approves
3. `npm run lint && npm run typecheck` pre-merge
4. Update this file with commit SHA + ✅ markers

## Final Checks

- [ ] All 7 tasks ✅ in tracker
- [ ] Final code-reviewer subagent on full diff
- [ ] `npm run test:ci`
- [ ] Re-run `$critique` + `$audit`, capture new scores
