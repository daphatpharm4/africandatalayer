# ADL Gamification And Modernization Execution Plan

**Date:** April 1, 2026
**Purpose:** translate the modernization program into concrete product and UI work

---

## Execution Prompt Reference

Use `docs/MULTI-AGENT-MODERNIZATION-MASTER-PROMPT.md` when you want this plan executed by a multi-agent Codex workflow. This design file defines the UI backlog and interaction changes; the prompt defines the orchestration model and enforcement gates.

---

## 1. Design Goal

Turn ADL from a set of strong individual features into a coherent field-operations product where:

- contributors always know what to do next,
- quality is rewarded more visibly than raw volume,
- trust, review, and rewards are legible,
- admin review supports coaching and enforcement,
- client outputs look credible and exportable.

---

## 2. Product Principles

1. **Operational before ornamental**
   - every new game mechanic must support capture quality, assignment completion, enrichment depth, or retention

2. **Fast feedback**
   - the app must answer “was this worth doing?” immediately after a contribution

3. **Progress everywhere**
   - users should feel progression on Home, Capture, Impact, and Profile, not only in one screen

4. **Quality-first ranking**
   - leaderboards and missions must favor verified value over raw quantity

5. **Trust is visible**
   - contributors should understand that trust increases access and stability

---

## 3. Screen-Level Changes

### 3.1 Home becomes mission control

Replace the current “map first, motivation second” emphasis with:

1. sync and queue health
2. assignment card
3. mission strip
4. daily progress and streak
5. nearby capture / enrich opportunities
6. map or list

#### Add

- `MissionStrip`
- `AssignmentProgressCard`
- `QueueHealthBar`
- `NearbyOpportunityCard`

#### Keep

- existing daily progress and streak widgets
- map/list toggle
- vertical picker

### 3.2 Contribution Flow becomes value-aware

The capture wizard should expose:

- estimated XP
- quality-sensitive bonus logic
- mission progress impact
- evidence quality guidance
- pending-review or escrow language when relevant

#### Add

- `QualityHintPanel`
- `MissionImpactPreview`
- `VerificationStateBanner`

#### Interaction rule

- poor evidence should trigger coaching, not only silent lower reward

### 3.3 Impact becomes progression, not just ranking

The Impact screen should show:

- season rank
- rank movement
- weekly mission completion
- quality-weighted leaderboard
- badge progress highlights

#### Add

- `SeasonRankCard`
- `RankDeltaChip`
- `ChallengeSummaryCard`
- `LeaderboardFormulaExplainer`

### 3.4 Profile becomes the depth layer

Profile should remain the archive and identity surface:

- trust score and trust tier
- badge cabinet
- full history
- rewards catalog
- settings

#### Improve

- make badge categories clearer
- explain trust changes
- connect rewards to verified value

### 3.5 Admin review becomes incentive-aware

Admin should see:

- contributor trust trajectory
- repeated fraud patterns
- assignment completion quality
- which missions produce useful vs noisy data

This makes the admin experience part of the gamification control loop.

### 3.6 Client delta surfaces become trust-forward

Client surfaces should not show gamification, but they should benefit from its effects:

- higher verified coverage
- fresher data
- clearer trust and completeness indicators
- more export-ready storylines

---

## 4. Gamification System Design

### 4.1 XP model

Visible formula:

- base contribution XP
- enrichment bonus
- quality bonus
- streak bonus
- assignment bonus

Hidden guardrails:

- rejected or unresolved items do not inflate rank
- duplicate or low-signal updates have reduced value
- trust-sensitive moderation can gate rewards

### 4.2 Missions

Mission categories:

- new capture
- stale refresh
- missing-field enrichment
- assignment completion
- zone coverage

Mission behavior:

- always visible on Home
- referenced during Capture
- summarized in Impact

### 4.3 Streaks

Streaks should reward consistency without punishing offline-first behavior unfairly.

Design rule:

- queued submissions captured before end-of-day should preserve streak once synced and verified by the existing offline model

### 4.4 Badges

Badge families:

- explorer
- quality
- consistency
- assignment execution
- trust
- category mastery

### 4.5 Leaderboards

Replace “XP only” mental model with:

- verified contribution value
- quality-weighted standing
- seasonal context
- rank movement over time

### 4.6 Rewards

Rewards should reinforce the product economy:

- redemption tied to verified contribution value
- some rewards gated by trust tier
- inventory and availability treated as real, not decorative

---

## 5. Suggested Component Backlog

| Component | Purpose | Priority |
|---|---|---|
| `MissionStrip` | top-level “next best action” | P0 |
| `AssignmentProgressCard` | tie ops work to contributor motivation | P0 |
| `QueueHealthBar` | make offline state actionable | P0 |
| `QualityHintPanel` | explain quality-sensitive scoring | P1 |
| `MissionImpactPreview` | show what this contribution advances | P1 |
| `SeasonRankCard` | make ranking temporal and motivational | P1 |
| `ChallengeSummaryCard` | weekly challenge visibility | P1 |
| `BadgeCategorySection` | make badge system more legible | P1 |
| `TrustTrajectoryCard` | explain trust movement and unlocks | P2 |
| `LeaderboardFormulaExplainer` | stop users from optimizing for noise | P2 |

---

## 6. File Targets

### Existing files to revise

- `components/Screens/Home.tsx`
- `components/Screens/ContributionFlow.tsx`
- `components/Screens/Analytics.tsx`
- `components/Screens/Profile.tsx`
- `components/Screens/AdminQueue.tsx`
- `components/Screens/RewardsCatalog.tsx`
- `api/leaderboard/index.ts`
- `shared/submissionRewards.ts`

---

## 7. Agent Ownership Map

| Area | Primary agent(s) |
|---|---|
| progression and mission logic | `game-designer`, `behavioral-nudge-engine` |
| contributor surfaces | `frontend-developer`, `ui-designer`, `ux-architect` |
| leaderboard and reward integrity | `backend-architect`, `security-engineer`, `vibe-security` |
| trust and review coupling | `backend-architect`, `game-designer` |
| accessibility and low-end device fit | `accessibility-auditor`, `performance-benchmarker` |
- `shared/xp.ts`

### New likely components

- `components/MissionStrip.tsx`
- `components/AssignmentProgressCard.tsx`
- `components/QueueHealthBar.tsx`
- `components/QualityHintPanel.tsx`
- `components/SeasonRankCard.tsx`
- `components/ChallengeSummaryCard.tsx`

---

## 7. Acceptance Criteria

### Contributor experience

- Home clearly presents the next recommended action
- Capture clearly communicates reward and quality expectations
- Impact shows more than a flat leaderboard
- Profile feels like a progression archive, not the only motivation surface

### Quality protection

- the visible game system rewards verified value
- low-quality or rejected work does not look like success
- trust state has understandable consequences

### Delivery

- all new mechanics are mobile-readable in harsh field conditions
- accessibility floor is maintained
- performance remains acceptable on mid-range Android devices

---

## 8. Implementation Order

1. Security and platform hardening
2. Home mission control
3. Contribution-flow reward clarity
4. Quality-weighted Impact and leaderboard redesign
5. Profile and rewards refinement
6. Admin incentive-aware review improvements
7. Client/reporting polish

This keeps gamification aligned with platform safety and data integrity instead of shipping as isolated polish.
