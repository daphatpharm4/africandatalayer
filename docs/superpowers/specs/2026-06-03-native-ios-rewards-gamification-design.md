# Native iOS — Rewards, Gamification & Visual Polish

Date: 2026-06-03
Branch: `ios`
Status: Approved (build authorized)

## Problem

The native Swift app has thin/placeholder screens. Rewards redemption was never
real (the React `RewardsCatalog` is client-only fake state, a Vercel free-tier
limitation). Gamification surfaces (badges, missions, streak, level-up) and a
rich profile do not exist natively. The app needs to feel rewarding and visually
appealing for field agents — pride, speed, progress (per `CLAUDE.md`).

## Goal

Fill the empty agent surfaces with working, good-looking native SwiftUI:
real XP balance, a functioning local redemption wallet, gamification screens,
and a visual polish pass — all on the existing ADL palette, light mode,
reduced-motion aware. No backend, DB, or Vercel changes this iteration.

## Key Constraint

XP is **server-canonical**: `computeCanonicalUserXp` derives `UserProfile.XP`
from submission events (`api/user`). There is no redemption ledger. Therefore
spendable balance is computed client-side as `serverXP − locallySpent`, and
redemption is recorded in a local wallet. A `RewardsService` protocol seam keeps
a future backend ledger a drop-in replacement.

## Decision

Native-local redemption now, backend-ready. Chosen over a real backend ledger
because the app is not yet runtime-verified on device (iOS 26.5 runtime blocker),
so a backend + deploy is premature risk. Local wallet ships this iteration.

## Architecture

### Data (`ADLModels.swift`)
- `RewardCategory` enum (mobileCredit, fuelDiscount, giftCard, recognition) with
  title + SF Symbol + tint.
- `Reward` — id, name, category, costXP, stock (`RewardStock`: inStock/lowStock/outOfStock).
- `Voucher` — id, rewardName, costXP, code (generated), redeemedAt. `Codable` for
  UserDefaults persistence.
- `Badge` — id, title, detail, systemImage, tint, `unlocked: Bool`, `progress: Double`.
- `Mission` — id, title, detail, period (`MissionPeriod`: daily/weekly), goal,
  current, reward XP; `progress` computed.
- `TierProgress` — current tier, next tier, XP into tier, XP to next (derived from
  XP thresholds).
- `DailyGoal` — target captures, completed; `progress` computed.

Badges/missions/streak are **derived from real data the app has** (XP, trustTier,
trustScore, queued/synced draft counts) plus local state. Not fabricated as
server truth — labeled as locally tracked.

### Services (`ADLServices.swift`)
- `ADLAPIClient.fetchUserProfile() -> UserProfile` (`GET /api/user`), new
  lenient `UserProfile` Decodable (id, name, XP, role, trustTier, trustScore).
- `RewardsService` protocol: `catalog() -> [Reward]`, `wallet() -> [Voucher]`,
  `redeem(_ reward:) throws -> Voucher`. `LocalRewardsService` impl persists
  spent XP + vouchers in UserDefaults; computes affordability against balance.
- `AppState` additions: `serverXP`, `spentXP`, `spendableXP` (computed),
  `vouchers`, `badges`, `missions`, `dailyGoal`, `tierProgress`,
  `levelUpEvent` (for celebration), `isLoadingProfile`, `profileError`.
  Methods: `loadProfile()`, `redeem(_:)`, `refreshGamification()`.

### Design primitives (`ADLDesignSystem.swift`)
- `GradientHero` (navy→navySoft, optional terra accent) — balance/profile heroes.
- `ProgressBar` (track + fill, tint param, optional label).
- `SectionHeader` (micro-label uppercase + optional trailing action).
- `IdentityCircle` (letter initial on navy→terra gradient — per CLAUDE identity rule).
- `BadgeTile`, `MissionRow`, `StatTile`, `RewardCard` — composed from above.

### Screens (`ADLViews.swift`)
- `RewardsView` (full): GradientHero balance → catalog (RewardCard grid) →
  redeem confirm sheet (voucher code reveal) → Voucher Wallet section. Reachable
  from Profile + Home.
- `BadgesView`: tiered grid, locked/unlocked, progress rings.
- `MissionsView`: daily/weekly mission cards with ProgressBar.
- `ProfileView` (rewrite): IdentityCircle hero, StatTile row
  (XP/tier/streak/badges), TierProgress bar, navigation rows to
  Rewards/Badges/Missions, sign out, debug role switch (gated).
- `AgentHomeView`: add top widget strip — `DailyProgressWidget` (capture-goal
  ring) + a mission nudge — above the existing map.
- `LevelUpCelebration`: overlay (scale-in + lightweight confetti) shown when
  `levelUpEvent` set; dismiss clears it. Gated by `reduceMotion`.

### Navigation
Rewards/Badges/Missions are pushed via `NavigationLink` from Profile and Home.
Agent tab bar stays 4 tabs (home, contribute, queue, profile). No `AppReleaseMode`
gate changes.

## Error / edge handling
- Profile fetch failure → keep last balance, show inline note; redemption still
  works against cached balance.
- Redeem when `costXP > spendableXP` → throws, surfaced as inline message; button
  disabled when unaffordable or out of stock.
- Voucher code: `ADL-XXXX-XXXX` random; uniqueness best-effort (local).
- All animations gated by `@Environment(\.accessibilityReduceMotion)`.

## Testing / verification
- Whole-module `swiftc -c -wmo` against `iphonesimulator26.5` must stay clean
  (the device archive remains blocked by the runtime install — issue 723).
- `plutil -lint` unaffected (no plist changes).
- Manual logic check of balance math + redemption affordability in code review.

## Out of scope (deferred)
- Backend redemption ledger, `/api/rewards`, DB migration, web parity.
- Server-side badge/mission/streak persistence.
- Admin/client visual work (agent-first release).
- Real submission-count fetch for profile (derive from XP/local for now).
