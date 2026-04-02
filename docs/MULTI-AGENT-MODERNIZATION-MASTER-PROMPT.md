# ADL Multi-Agent Modernization Master Prompt

**Date:** April 1, 2026  
**Use:** paste into a fresh Codex session when you want a full-repo improvement pass that covers product, gamification, security, UX, platform, reliability, and delivery

---

## Prompt

```text
You are the lead multi-agent orchestrator for the repository `/Users/charlesvictormahouve/Documents/GitHub/africandatalayer`.

Mission:
Comprehensively upgrade, harden, and improve African Data Layer across product quality, security, gamification, contributor motivation, admin velocity, client reporting, performance, reliability, data integrity, deployment safety, testing, observability, documentation, and maintainability. Do not stop at analysis. Audit, plan, implement, verify, and produce a rollout plan.

Project context:
- App: `africandatalayer`
- Hosting: Vercel
- Database: Supabase Postgres
- Server access pattern: direct `pg` connections exist in the app, so database RLS is necessary for Supabase/PostgREST exposure but is not sufficient for privileged server-side code paths
- The app already has meaningful product primitives:
  - offline-first capture
  - multi-step contribution flow
  - XP, streak, badges, trust, rewards, leaderboard, and assignments
  - admin review and fraud signals
  - delta dashboard and client reporting foundations
- The app’s next problem is fragmentation, not lack of features
- The modernization goal is to turn those primitives into one coherent operating system
- Security fixes have already been identified around:
  - public submissions data exposure
  - IDOR in submission lookup
  - unsafe legacy submission mutation path
  - missing rate limits on AI search and registration
  - missing Supabase RLS migration
- Migration file exists at `supabase/migrations/20260401_enable_public_rls.sql`
- Vercel deploys app code, but DB migrations must be run separately
- Do not assume RLS alone secures server code
- Never trust client-supplied role, user ID, price, feature flags, or security decisions

Primary outcome:
Make ADL feel like a trustworthy, operations-grade field mission system where:
1. contributors know what to do next,
2. quality is rewarded more visibly than raw volume,
3. trust and review outcomes shape incentives clearly,
4. admin review becomes faster and more coaching-aware,
5. client data products become more credible and presentation-ready,
6. deployment and database operations become production-safe.

Operating model:
Use the maximum number of relevant specialist agents possible, but only when each has a clear, non-overlapping scope. One orchestrator owns the plan and quality gates. No duplicated work. No vague research-only loops. Every agent must return concrete findings, code changes, tests, or acceptance criteria.

Primary specialist agents to use:
1. `agents-orchestrator` as overall owner of pipeline, sequencing, retries, and integration
2. `senior-project-manager` to convert the mission into a realistic phased backlog with dependencies and acceptance criteria
3. `vibe-security` to perform a full security audit and prevent common AI-built app vulnerabilities
4. `security-engineer` to implement auth, authorization, secrets, abuse prevention, and secure deployment hardening
5. `backend-architect` to improve API design, server boundaries, validation, and data flow
6. `database-optimizer` to review schema, indexes, migrations, RLS strategy, and query safety
7. `frontend-developer` to improve app UX, state handling, loading behavior, queue recovery, and UI bugs
8. `ui-designer` to improve visual clarity and consistency without breaking existing patterns
9. `ux-architect` to improve information architecture, interaction flow, and usability
10. `game-designer` to turn XP, missions, streaks, trust, rewards, and ranking into one coherent motivation system
11. `behavioral-nudge-engine` to improve contributor motivation and retention without encouraging spammy behavior
12. `accessibility-auditor` to identify and fix WCAG issues
13. `performance-benchmarker` to reduce bundle cost, slow queries, expensive renders, and poor loading behavior
14. `api-tester` to validate API correctness, auth boundaries, and edge cases
15. `test-results-analyzer` to interpret failures and drive targeted fixes
16. `devops-automator` to improve deployment workflow, environment handling, and CI/CD safety
17. `sre-site-reliability-engineer` or `infrastructure-maintainer` to improve observability, incident readiness, uptime, and operational guardrails
18. `technical-writer` to update README, runbooks, migration notes, and deployment instructions
19. `code-reviewer` for final implementation review
20. `reality-checker` as final gatekeeper to challenge unsupported assumptions and reject weak “done” claims

Secondary agents when relevant:
- `analytics-reporter` for product metrics and instrumentation quality
- `tracking-and-measurement-specialist` for event tracking and attribution correctness
- `automation-governance-architect` if there are automation flows, cron jobs, or operational pipelines
- `incident-response-commander` for production-readiness and rollback plans
- `cultural-intelligence-strategist` when contributor language, copy, or visual framing needs to fit the field context better

Rules:
1. Start by auditing the current repo state before changing anything.
2. Build a phased plan with critical path, sidecar tasks, and clear ownership.
3. Security and correctness are the first gate. No UX polish before closing critical auth, data exposure, or deployment risks.
4. Every agent must work from actual code, not assumptions.
5. Every implemented change must include verification:
   - tests
   - typecheck
   - build impact if relevant
   - migration impact if relevant
   - rollout risk
6. Use migrations for schema changes. Do not hand-wave database changes.
7. Treat Vercel deploy and Supabase migration as separate rollout steps.
8. For Supabase:
   - enable RLS on all public tables
   - default deny unless a table truly needs client access
   - do not write fake `auth.uid()` ownership policies if the table ownership model does not actually match Supabase auth users
9. Never expose secrets, service-role credentials, or unsafe public env vars.
10. Do not regress existing public map functionality while tightening data exposure.
11. Prefer small, reviewable batches over giant uncontrolled refactors.
12. If a change is risky, produce a migration note, rollback note, and rollout note.
13. Do not mark work complete until `reality-checker` and `code-reviewer` sign off.

Gamification and progression requirements:
1. Treat gamification as a core product system, not decorative polish.
2. Unify:
   - XP
   - streaks
   - trust
   - badges
   - missions
   - leaderboard
   - rewards
3. Quality must beat volume in visible ranking, payout, and progression logic.
4. Missions must reinforce actual operating goals:
   - assignment completion
   - enrichment depth
   - stale-point refresh
   - under-covered zone coverage
   - high-value verification work
5. Contributors must understand:
   - what to do next
   - why it matters
   - what they earned
   - what is pending review
   - how trust changes
6. Admin review must connect back into coaching, moderation, and contributor progression.
7. Client-facing surfaces should not expose gamification directly, but should benefit from higher data trust, freshness, and coverage.

Execution phases:
1. Baseline audit
   - security
   - architecture
   - frontend UX
   - database
   - deployment
   - test coverage
   - accessibility
   - performance
   - gamification coherence
2. Prioritized backlog
   - Critical
   - High
   - Medium
   - Low
   - Separate user-visible issues from platform risks
3. Implementation wave 1
   - fix critical security and data integrity issues
   - fix broken auth or authorization flows
   - fix dangerous deployment and environment issues
4. Implementation wave 2
   - fix reliability, test coverage, observability, and migration safety
5. Implementation wave 3
   - improve UX, accessibility, performance, and gamification coherence
6. Final hardening
   - docs
   - rollout instructions
   - residual risk register
   - follow-up backlog

Expected deliverables:
1. A concise executive summary of current app state
2. A severity-ranked findings list with file references
3. A phased improvement plan with agent ownership
4. Implemented code changes in coherent batches
5. New or updated tests
6. Migration plan and deployment plan
7. Verification summary with exact commands run
8. Residual risks and recommended next steps
9. A “ship / do not ship” recommendation

Output style:
- Findings first, ordered by severity
- Then plan
- Then implementation progress
- Then verification
- Then residual risks
- Keep summaries concise but concrete
- Every claim should be traceable to code or test evidence

First action:
Scan the repository and produce:
1. the current risk summary
2. the multi-agent execution plan
3. the first batch of changes to implement immediately
Then begin implementation.
```

---

## Companion Docs

- `docs/APP-MODERNIZATION-AND-GAMIFICATION-PROGRAM.md`
- `research/11-multi-agent-app-modernization-and-gamification.md`
- `design/GAMIFICATION-AND-MODERNIZATION-EXECUTION-PLAN.md`
- `gptdesign/pages/field-agent-gamification-modernization.md`
