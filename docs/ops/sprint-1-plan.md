# Sprint 1 Plan — Subagent Team Rollout

**Date:** 2026-04-15
**Owner:** Service Delivery Manager
**Duration:** 5 working days (April 15-21, 2026)

---

## Sprint Goal

Merge the Capacitor foundation to main, verify all quality gates, and prepare platform branches for App Store and Play Store submission.

---

## Quality Gate Status

| Gate | Status | Owner | Notes |
|------|--------|-------|-------|
| Architecture | PASS | Architect | All guards verified, no circular deps, bundle clean |
| Security | CONDITIONAL PASS | Cybersecurity Lead | 3 verification tasks before store submission |
| Fraud | CONDITIONAL PASS | Fraud Lead | EXIF pipeline test with native camera needed |
| Data Quality | NOT YET ASSESSED | Data Analyst | Baseline metrics framework needed |
| Delivery | IN PROGRESS | SDM | Branches not yet pushed, no PRs open |
| Marketing Truthfulness | NOT YET ASSESSED | Marketing Strategist | No public claims made yet |

---

## Task List (Priority Ordered)

Priority Score = Impact (1-5) x Risk (1-5) x (6 - Effort (1-5))

### P1 — Critical Path (Must complete this sprint)

| # | Task | Owner | Priority | DoD | Day |
|---|------|-------|----------|-----|-----|
| 1.1 | Push `feature/capacitor-base` to remote | SDM | 5x5x5=125 | Branch on GitHub, CI green | 1 |
| 1.2 | Open PR: `capacitor-base` -> `main` | SDM | 5x5x5=125 | PR created with description + test plan | 1 |
| 1.3 | Commit pending changes (README.md, eslint.config.js, charter, reports) | SDM | 5x4x5=100 | Changes committed on capacitor-base | 1 |
| 1.4 | Push `feature/ios-distribution` to remote | iOS Dev | 4x4x5=80 | Branch on GitHub, CI triggered | 1 |
| 1.5 | Push `feature/android-distribution` to remote | Android Dev | 4x4x5=80 | Branch on GitHub, CI triggered | 1 |
| 1.6 | Fix CI failures (if any) on all branches | Architect | 5x4x4=80 | All 3 branches green | 1-2 |
| 1.7 | Verify web app unchanged after merge | Architect | 5x5x4=100 | `npm run dev` shows identical behavior | 2 |

### P2 — Quality Verification (Must complete before merge)

| # | Task | Owner | Priority | DoD | Day |
|---|------|-------|----------|-----|-----|
| 2.1 | Test native camera EXIF through fraud pipeline | Fraud Lead | 4x4x4=64 | 5 test submissions, EXIF fields present | 2-3 |
| 2.2 | Test Google OAuth in native WebView | Cybersecurity Lead | 3x3x4=36 | OAuth flow completes or workaround documented | 3 |
| 2.3 | Test remote wipe end-to-end | Cybersecurity Lead | 3x3x4=36 | Wipe clears IndexedDB queue | 3 |
| 2.4 | Verify device profile capture in native WebView | Fraud Lead | 3x3x4=36 | Device fingerprint present on native submissions | 3 |
| 2.5 | Run full test suite on all branches | Code Reviewer | 5x4x5=100 | `npm run test:ci` passes everywhere | 2 |

### P3 — Platform Preparation (Complete by end of sprint)

| # | Task | Owner | Priority | DoD | Day |
|---|------|-------|----------|-----|-----|
| 3.1 | iOS Simulator smoke test (camera, GPS, offline, back nav) | iOS Dev | 4x3x3=36 | All features functional in simulator | 3-4 |
| 3.2 | Android emulator smoke test (API 24 + API 34) | Android Dev | 4x3x3=36 | All features functional, no ANR | 3-4 |
| 3.3 | Generate app icons and splash assets (iOS) | iOS Dev | 3x2x4=24 | Assets in ios/App/App/Assets.xcassets | 4 |
| 3.4 | Generate app icons and splash assets (Android) | Android Dev | 3x2x4=24 | Adaptive icons configured | 4 |
| 3.5 | Draft privacy policy (camera, location, data storage) | Cybersecurity Lead | 4x4x3=48 | Privacy policy URL live | 4-5 |

### P4 — Foundation (Needed for operations)

| # | Task | Owner | Priority | DoD | Day |
|---|------|-------|----------|-----|-----|
| 4.1 | Design baseline metrics framework | Data Analyst | 3x3x3=27 | Metrics doc in docs/ops/ | 2-3 |
| 4.2 | Verify CLAUDE.md reflects Capacitor integration | Doc Updater | 3x2x4=24 | CLAUDE.md updated | 3 |
| 4.3 | Verify .env.example completeness | Doc Updater | 3x2x5=30 | All env vars documented | 2 |
| 4.4 | Draft mobile launch content calendar | Social Media | 2x2x3=12 | Content plan in docs/marketing/ | 4-5 |
| 4.5 | Draft GTM brief for mobile launch | Marketing | 2x2x3=12 | GTM doc in docs/marketing/ | 4-5 |

---

## Dependencies

```
1.3 (commit) → 1.1 (push) → 1.2 (PR) → 1.6 (CI fix) → 2.5 (test suite)
                                                       → 1.7 (verify web)
1.4 (push ios) → 3.1 (simulator test) → 3.3 (assets)
1.5 (push android) → 3.2 (emulator test) → 3.4 (assets)
2.1 + 2.4 (fraud tests) → Fraud gate FULL PASS
2.2 + 2.3 (security tests) → Security gate FULL PASS
3.5 (privacy policy) → App Store / Play Store submission (Sprint 2)
```

---

## Day-by-Day Schedule

### Day 1 (April 15) — Push & PR
- [ ] Commit all pending changes on capacitor-base (README, eslint, docs)
- [ ] Push all 3 feature branches to remote
- [ ] Open PR: capacitor-base -> main
- [ ] Monitor CI builds

### Day 2 (April 16) — Verify & Test
- [ ] Fix any CI failures
- [ ] Verify web app unchanged after merge (npm run dev)
- [ ] Run full test suite on all branches
- [ ] Start fraud pipeline EXIF test
- [ ] Start metrics framework design
- [ ] Verify .env.example completeness

### Day 3 (April 17) — Quality Gates
- [ ] Complete fraud EXIF test (5 submissions)
- [ ] Test Google OAuth in native WebView
- [ ] Test remote wipe
- [ ] Verify device profiles in native
- [ ] Start simulator/emulator smoke tests
- [ ] Update CLAUDE.md for Capacitor

### Day 4 (April 18) — Platform Prep
- [ ] Complete iOS simulator smoke test
- [ ] Complete Android emulator smoke test
- [ ] Generate app icons and splash assets (both platforms)
- [ ] Start privacy policy draft
- [ ] Start content calendar and GTM brief

### Day 5 (April 21) — Gate Roll-Call
- [ ] All quality gates assessed
- [ ] Privacy policy complete
- [ ] Content calendar and GTM brief complete
- [ ] Sprint retrospective
- [ ] Sprint 2 planning (App Store + Play Store submission)

---

## Blockers

| # | Blocker | Impact | Resolution |
|---|---------|--------|------------|
| B1 | Branches not pushed to remote | Blocks all CI and collaboration | Push today (Task 1.1, 1.4, 1.5) |
| B2 | No local iOS/Android device for real testing | Limits smoke testing to simulators | Acceptable for Sprint 1; real devices needed for Sprint 2 |
| B3 | Privacy policy not written | Blocks App Store / Play Store submission | Cybersecurity Lead drafts by Day 4-5 |
| B4 | App icons not generated from ADL brand assets | Blocks store listings | Use ADL logo source file with `@capacitor/assets generate` |

---

## Risk Items

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | CI fails on platform branches (missing ios/android dirs on clean checkout) | Medium | Medium | Ensure ios/ and android/ are committed on their respective branches |
| R2 | Native EXIF differs enough to trigger false fraud flags | Low | High | Test before merge; adjustable thresholds via FRAUD_* env vars |
| R3 | Google OAuth broken in WebView | Medium | Low | Credentials auth is primary; OAuth is optional |
| R4 | macOS CI runner unavailable/slow | Low | Medium | ios-build.yml runs on macos-latest; fallback to local Xcode |
| R5 | Architect agent made unauthorized changes on ios-distribution | Already happened | Low | Changes stashed safely; will review before applying |

---

## Success Criteria for Sprint 1

1. [ ] All 3 feature branches pushed and CI green
2. [ ] PR `capacitor-base -> main` approved by Code Reviewer
3. [ ] Architecture gate: PASS
4. [ ] Security gate: PASS (3 verification tasks complete)
5. [ ] Fraud gate: PASS (EXIF test complete)
6. [ ] Web app demonstrably unchanged (verified in browser)
7. [ ] iOS simulator and Android emulator smoke tests pass
8. [ ] Privacy policy draft complete
9. [ ] Baseline metrics framework documented
