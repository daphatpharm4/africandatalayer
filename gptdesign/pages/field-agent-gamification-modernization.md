# ADL GPTDesign Override: Field Agent Gamification Modernization

> This file overrides `gptdesign/MASTER.md` for contributor motivation, progression, and gamification surfaces.
>
> Execution companion: `docs/MULTI-AGENT-MODERNIZATION-MASTER-PROMPT.md`

---

## Current State

- `Home.tsx` already includes `DailyProgressWidget` and `StreakTracker`.
- `ContributionFlow.tsx` already exposes estimated XP and post-submit reward feedback.
- `Profile.tsx` already contains XP balance, trust, badge grid, and history.
- `Analytics.tsx` already contains a contributor leaderboard.
- `RewardsCatalog.tsx` already exposes a rewards surface.

The product already has gamification primitives. The issue is not absence. The issue is orchestration.

---

## Pain Points

- Progress is visible, but too fragmented across screens.
- The app does not consistently answer “what should I do next?”
- Quality, trust, and reward outcomes are not legible enough.
- Leaderboard energy is stronger than mission energy.
- Profile still carries too much of the motivation load.

---

## Design Goal

Make ADL feel like a field mission system where contributors:

- understand the next useful action,
- see why it matters,
- feel progress immediately,
- understand how quality changes reward,
- build trust and status over time.

---

## Surface Rules

### Home

Home is the command center, not just the explorer.

Top-to-bottom order:

1. sync and queue state
2. assignment card
3. mission strip
4. daily progress
5. streak
6. nearby opportunities
7. map/list content

Rules:

- the next action must appear before the map fold
- assignment and mission blocks must be tappable, compact, and readable outdoors
- a contributor should be able to decide their next action in under 5 seconds

### Contribution Flow

Contribution Flow must show:

- estimated reward
- mission impact
- evidence-quality guidance
- post-submit result state

Rules:

- poor quality should show corrective guidance, not only failure
- pending-review outcomes should be visually distinct from verified success
- reward language must reinforce quality and trust, not speed alone

### Impact

Impact should become the progression dashboard:

- current rank
- rank movement
- mission progress
- season context
- quality-weighted leaderboard

Rules:

- users should understand why they are ranked where they are
- avoid making the leaderboard the only source of motivation

### Profile

Profile remains the archive and identity layer:

- trust
- badges
- rewards
- history
- deeper settings

Rules:

- do not move all gamification here
- Profile should explain progression, not exclusively carry it

---

## Required Components

### `MissionStrip`

- horizontal or stacked mission cards
- each card includes:
  - mission title
  - progress
  - reward
  - why it matters

### `QueueHealthBar`

- visible on Home and Capture entry
- shows:
  - queued
  - syncing
  - failed
  - last sync

### `MissionImpactPreview`

- appears in Contribution Flow before submit
- explains:
  - what mission advances
  - estimated reward
  - quality or trust caveats

### `SeasonRankCard`

- appears in Impact
- shows:
  - current rank
  - delta since last week
  - season cutoff or target

### `TrustTrajectoryCard`

- appears in Profile
- explains:
  - current trust tier
  - how trust changes
  - what unlocks next

---

## Gamification Rules

### Reward philosophy

- quality beats quantity
- verified beats provisional
- assignment work should pay visibly better than noise
- enrichment with meaningful completion value should be celebrated more than trivial repetition

### Streak philosophy

- consistency matters
- offline capture should not feel unfairly punished
- streak UI must be simple, legible, and emotionally positive

### Badge philosophy

- badges should represent real behavior:
  - consistency
  - quality
  - trust
  - category mastery
  - assignment execution

### Trust philosophy

- trust is a progression dimension, not only an admin metric
- the UI should communicate that better work increases trust
- restricted or rejected states need corrective clarity, not vague punishment

---

## Accessibility And Performance Rules

- all mission and reward surfaces must remain readable in sunlight
- do not use low-contrast gold on white for key information
- every status chip must include text, not color only
- touch targets remain at least `48x48px`
- avoid animation-heavy celebration effects on low-end devices
- reduced motion must disable non-essential reward animation

---

## Acceptance Criteria

- Home communicates next best action immediately
- Capture makes reward and quality logic legible
- Impact explains rank, not only displays it
- Profile deepens identity and progression instead of hoarding all motivation
- the app visibly rewards verified value more than raw volume
- trust, missions, and rewards feel like one system

---

## Agent Handoff Note

When this override is used inside a multi-agent implementation pass, the UI work should be coordinated with:

- `game-designer` for progression rules
- `behavioral-nudge-engine` for contributor motivation
- `vibe-security` and `security-engineer` so reward loops do not create abuse paths
