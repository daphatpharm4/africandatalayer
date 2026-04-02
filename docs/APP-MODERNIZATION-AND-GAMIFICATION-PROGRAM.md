# ADL App Modernization And Gamification Program

**Date:** April 1, 2026
**Scope:** product, security, UX, gamification, platform, reliability, and delivery
**Source base:** current codebase, existing `/research`, `/design`, and `/gptdesign` material, and the security hardening work completed on April 1, 2026

---

## Execution Prompt

Use `docs/MULTI-AGENT-MODERNIZATION-MASTER-PROMPT.md` as the operational entrypoint for a full-repo modernization pass. This program document defines the product and delivery thesis; the master prompt turns that thesis into an orchestrated multi-agent implementation workflow.

---

## 1. Executive Summary

African Data Layer already has stronger foundations than a typical early-stage field-data app:

- offline-first capture and sync recovery
- multi-step contribution flow
- trust, XP, and badge primitives
- admin review and fraud signals
- contributor leaderboard and profile history
- delta dashboard and client-facing reporting foundations

The next step is not “add more features.” The next step is to **tighten the product loop** so that:

1. contributors know what to do next,
2. high-quality work is rewarded faster and more visibly,
3. anti-fraud and trust systems shape incentives instead of only policing them after the fact,
4. admin review gets faster and safer,
5. client/reporting surfaces become presentation-ready,
6. deployment and database operations become production-safe.

This program adds the missing gamification layer explicitly. The app already contains XP, streak, rewards, trust, and badges, but those mechanics are still fragmented across Home, Profile, Contribution Flow, and Analytics. The modernization goal is to turn them into a **single progression system** rather than a set of disconnected widgets.

---

## 2. Current Product Truth

### What is already in the app

- `components/DailyProgressWidget.tsx` gives contributors daily volume, enrichment, quality, and streak status.
- `components/StreakTracker.tsx` already visualizes streak continuity.
- `components/BadgeSystem.tsx` and `components/Screens/Profile.tsx` already compute and display badges.
- `shared/submissionRewards.ts` and `shared/xp.ts` already define a reward model and XP logic.
- `components/XPPopup.tsx` and `components/Screens/ContributionFlow.tsx` already support reward feedback after submission.
- `api/leaderboard/index.ts` and `components/Screens/Analytics.tsx` already support contributor ranking.
- `lib/server/userTrust.ts` and submission review flows already support trust scoring and moderation consequences.

### What is still weak

- Gamification is present but **not orchestrated**.
- Motivation is still too profile-centric instead of workflow-centric.
- The leaderboard risks rewarding visible volume more than verified quality.
- Trust, fraud review, XP, and assignment progress are not yet one coherent loop.
- There is no “mission system” that tells contributors what high-value action to take next.
- There is no season/challenge structure to sustain retention.
- Security, RLS, abuse prevention, docs, and deployment hygiene must stay on the critical path, not be treated as background polish.

---

## 3. Modernization Principles

1. **Security before delight**
   - No new surface ships if it weakens auth, privacy, abuse controls, or trust boundaries.

2. **Quality beats volume**
   - Rewards, ranking, and progression must favor verified, useful, well-scored contributions over raw count.

3. **Assignments drive action**
   - Gamification should reinforce operational objectives, not distract from them.

4. **Offline-first progression**
   - Contributors should still see meaningful progress even when sync is delayed.

5. **One motivation system**
   - XP, streaks, trust, badges, rewards, leaderboard, and missions should feel like one system.

6. **Admin trust loop**
   - Review outcomes must feed contributor progression, coaching, and moderation clearly.

7. **Client confidence**
   - Every exported or demoed data view must visibly reflect trust, freshness, and completeness.

---

## 4. Multi-Agent Workstreams

| Workstream | Primary owner | Goal |
|---|---|---|
| Program orchestration | `agents-orchestrator` | sequence work, enforce gates, maintain phase state |
| Backlog and scope | `senior-project-manager` | convert strategy into realistic phased tasks with acceptance criteria |
| Security hardening | `vibe-security` + `security-engineer` | auth, authorization, RLS, rate limits, secrets, abuse prevention |
| API and domain cleanup | `backend-architect` | cleaner server boundaries, safer handlers, validation, data flow |
| Database safety and performance | `database-optimizer` | migration strategy, indexes, query review, RLS follow-up design |
| Field UX implementation | `frontend-developer` | Home, Capture, Impact, Profile, queue, feedback loops |
| Visual system refinement | `ui-designer` | consistent surfaces, visual hierarchy, component polish |
| Interaction architecture | `ux-architect` | screen flow, decision load, hierarchy, mobile ergonomics |
| Accessibility | `accessibility-auditor` | touch targets, contrast, focus, semantics, reduced motion |
| Performance | `performance-benchmarker` | render cost, bundle weight, map/list performance, loading behavior |
| API verification | `api-tester` | auth boundaries, payload integrity, failure modes |
| Delivery safety | `devops-automator` + `sre-site-reliability-engineer` | deploy flow, env handling, migration/runbook safety |
| Documentation | `technical-writer` | architecture notes, deployment notes, feature docs, rollout docs |
| Final review | `code-reviewer` + `reality-checker` | correctness, regression risk, residual risk register |

---

## 4.1 Prompt Alignment

The master prompt must preserve four priorities in this order:

1. security and data protection
2. contributor workflow clarity
3. quality-weighted gamification
4. deployment and migration safety

That ordering matters because ADL is already feature-rich enough that the main risk is incoherent execution, not feature scarcity.

---

## 5. Product Roadmap

### Phase 0: Stabilize And Protect

- ship the security fixes already identified
- deploy the route hardening to Vercel
- run the Supabase RLS migration through the repo migration system
- document the Vercel + Supabase operational sequence

### Phase 1: Progression Core

- define one canonical contributor progression model:
  - XP
  - streak
  - trust
  - badges
  - mission progress
  - reward unlocks
- move visible progression to Home and Capture, not only Profile
- clarify pending-review vs verified-reward states

### Phase 2: Gamification That Supports Operations

- add mission cards tied to business goals:
  - complete assignment
  - verify stale points
  - enrich missing fields
  - contribute in under-covered areas
- add a contributor “next best action” strip
- make challenge progress visible before and after each submission
- redesign leaderboard toward verified quality-weighted contribution

### Phase 3: Contributor Retention And Reward Economy

- season-based leaderboard and challenge cadence
- badge taxonomy expansion with meaningful unlock logic
- reward catalog tied to verified contribution value
- trust-aware reward gating

### Phase 4: Admin Velocity And Coaching

- faster review queue triage
- explicit reviewer feedback states that drive contributor coaching
- better visibility into agent quality, trust trajectory, and rejected-pattern causes

### Phase 5: Client And Reporting Maturity

- make delta intelligence more presentation-ready
- first-class export and API flows
- visible trust and completeness inline with reports

### Phase 6: Production Readiness

- observability
- deployment runbooks
- migration rollback guidance
- performance budgets
- regression test expansion

---

## 6. Gamification System To Build Explicitly

### Core loops

#### Capture loop

- contributor sees assignment or mission
- completes capture
- gets immediate quality-aware feedback
- sees XP, streak, and mission progress update

#### Quality loop

- verified quality yields more value than raw quantity
- missing fields, weak evidence, or review holds create coaching feedback rather than opaque failure

#### Trust loop

- trust tier affects access, credibility, and reward unlocks
- review outcomes and repeated quality issues adjust trust visibly and predictably

#### Retention loop

- daily streak
- weekly mission set
- seasonal leaderboard
- badge unlocks

#### Reward loop

- rewards should be redeemable against **verified** contribution value, not inflated activity count
- pending-review contributions may show escrowed or provisional value

### Required gamification surfaces

- Home:
  - next mission
  - daily progress
  - streak
  - queue health
  - assignment progress
- Contribution Flow:
  - estimated reward
  - quality hints
  - challenge progress
  - post-submit reward state
- Impact:
  - leaderboard
  - rank movement
  - season score
  - team/community challenge state
- Profile:
  - depth view for trust, badges, history, rewards, and redemption

### Anti-gaming rules

- rejected or unresolved low-quality submissions cannot inflate ranking
- trust-sensitive multiplier applies after review logic, not before
- duplicated or low-signal enrichments should not outscore meaningful verified updates
- assignment completion and stale-point refresh should pay better than spammy low-value creates

---

## 7. Success Metrics

### Contributor metrics

- D1, D7, and D30 retention
- weekly active contributors
- average verified contributions per active contributor
- streak continuation rate
- assignment completion rate

### Quality metrics

- percentage of contributions approved without manual intervention
- pending-review rate
- rejection rate
- average confidence score
- rework rate on the same point

### Product metrics

- time-to-first-successful-contribution
- time from capture to visible reward feedback
- contribution flow completion rate
- queue retry recovery rate

### Business metrics

- verified point growth
- enrichment depth per point
- report/export usage
- client confidence and demo-readiness of delta outputs

---

## 8. Rollout Order

For production, use this order:

1. merge and deploy app code to Vercel
2. run `npm run migrate:dry`
3. run `npm run migrate`
4. verify contributor and admin core flows
5. release gamification and UX changes in phased batches behind clear acceptance criteria

This keeps app deployment and Supabase migration as separate, auditable steps.

---

## 9. Deliverables Expected From The Modernization Prompt

- severity-ranked findings
- phased backlog
- implementation batches
- tests and verification
- migration and deploy plan
- updated design and product docs
- residual risk register
- explicit ship / do-not-ship recommendation

This document is the top-level program brief. See `/research`, `/design`, and `/gptdesign` for the deeper synthesis and UI execution detail.
