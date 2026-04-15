# Go-To-Market Brief — Mobile Launch

**Date:** 2026-04-15
**Owner:** Marketing Strategist (ADL Subagent)

---

## Core Message

**African Data Layer brings verified, ground-truth infrastructure data to your phone — capture, verify, and earn rewards from the field with native camera and GPS, even offline.**

---

## Audience-Specific Messaging

### For Clients (Data Consumers)

**Message:** "ADL mobile means more agents, more coverage, faster data. Our native app removes connectivity barriers and enables faster capture with built-in GPS verification and fraud detection. The same data quality you trust, now scaling faster."

**Proof points:**
- Native camera + GPS = richer metadata per submission
- Offline-first = agents can capture data anywhere, even without cell coverage
- Same fraud pipeline (EXIF analysis, GPS validation, trust tiers) regardless of platform
- 7 infrastructure verticals covering essential urban services

### For Field Agents

**Message (EN):** "Download ADL on your phone. Walk your neighborhood. Capture what you see. Earn XP and rewards for every verified submission. No need for perfect internet — your data syncs automatically when you're back online."

**Message (FR):** "Telechargez ADL sur votre telephone. Parcourez votre quartier. Capturez ce que vous voyez. Gagnez des XP et des recompenses pour chaque soumission verifiee. Pas besoin d'un internet parfait — vos donnees se synchronisent automatiquement."

**Proof points:**
- Native camera = faster photo capture than browser
- Offline queue = work without worrying about connectivity
- GPS auto-attached = no manual location entry
- Same gamification: XP, streaks, badges, levels, rewards catalog

### For Investors

**Message:** "ADL is now a three-platform product — web, iOS, and Android — from a single codebase. Mobile distribution removes the last adoption barrier for field agents: browser friction. This accelerates agent onboarding, data collection velocity, and coverage density."

**Proof points:**
- Single codebase (React + Capacitor) = efficient team, consistent behavior
- App Store + Play Store distribution = discoverability, trust, push notifications
- Offline-first architecture proven in low-connectivity environments
- Fraud detection pipeline is platform-independent (no quality compromise)
- Path to multi-city scaling (add collection zones, not codebases)

**Tie-in:** Africa Forward Summit, Nairobi, May 2026 — mobile launch strengthens the pitch for scalability and agent acquisition.

### For Partners

**Message:** "ADL's mobile app enables rapid deployment of field data collection in any neighborhood. Partner with us to extend coverage to your area of interest — we provide the platform, you provide the local network."

---

## Channel Strategy

### App Store Optimization (iOS)

| Element | Content |
|---------|---------|
| Title | African Data Layer |
| Subtitle | Verified Field Data Collection |
| Keywords | data collection, field survey, infrastructure mapping, Cameroon, GPS verification, crowd-source |
| Category | Business / Utilities |
| Description | "Capture and verify local infrastructure data in your neighborhood. ADL helps field agents map pharmacies, fuel stations, mobile money kiosks, and more — with GPS-verified photo submissions, offline syncing, and rewards for quality work. Built for Cameroon, expanding across Africa." |

### Play Store Optimization (Android)

| Element | Content |
|---------|---------|
| Title | African Data Layer |
| Short Description | Verified field data collection with GPS, camera, and offline syncing |
| Category | Business |
| Content Rating | Everyone |
| Full Description | Same as iOS, plus: "Designed for mid-range Android devices. Works on 2G/3G networks. Offline-first — your submissions sync automatically when you're back online." |

### Social Media (aligned with Social Media Marketer calendar)

- Pre-launch: teaser posts (2 weeks)
- Launch day: coordinated announcement across LinkedIn, Twitter/X, Instagram
- Post-launch: agent stories, data insights, recruitment

### Direct Client Outreach

- Update pitch deck with mobile capability slide
- Send email to existing client contacts with mobile launch announcement
- Offer mobile-collected data samples to prospects
- Highlight: "same data quality, accelerated collection"

### Agent Recruitment Channels

| Channel | Approach |
|---------|----------|
| WhatsApp Groups | Share download link + recruitment message in Douala community groups |
| University Campuses | Partner with student organizations in Douala (University of Douala) |
| Community Leaders | Brief neighborhood leaders in Bonamoussadi on agent opportunity |
| Social Media | Targeted recruitment posts (bilingual EN/FR) |
| Existing Agents | Referral bonus for inviting new agents |

---

## Launch Timeline

### Pre-Launch (2 weeks before)

- [ ] App Store and Play Store listings submitted (screenshots, descriptions, privacy policy)
- [ ] Social media teaser campaign begins (Week 1 of content calendar)
- [ ] Pitch deck updated with mobile capability
- [ ] Agent recruitment materials prepared (bilingual)
- [ ] TestFlight / internal APK distributed to 5-10 beta testers
- [ ] Beta feedback collected and critical issues fixed

### Launch Day

- [ ] App Store and Play Store listings live
- [ ] Coordinated social media announcement (all platforms, 8am WAT)
- [ ] Email announcement to client contacts
- [ ] WhatsApp broadcast to agent network
- [ ] SDM monitors downloads and first submissions
- [ ] On-call for critical bugs (Architect + iOS Dev + Android Dev)

### Post-Launch (2 weeks after)

- [ ] Daily download and activation monitoring
- [ ] Agent onboarding funnel analysis (download -> first submission -> first reward)
- [ ] Social media engagement analysis and content adjustment
- [ ] First agent spotlight post (with consent)
- [ ] Client report with mobile-sourced data sample
- [ ] App Store / Play Store review monitoring and response
- [ ] Bug fix releases if needed

---

## Agent Acquisition Strategy

### Onboarding Funnel

```
Download App (App Store / Play Store)
  ↓
Create Account (credentials or Google OAuth)
  ↓
View Bonamoussadi Map (see existing data points + gaps)
  ↓
First Submission (guided by mission card or nearest gap)
  ↓
First XP Award (immediate feedback, celebration animation)
  ↓
Streak Started (return tomorrow for 2x bonus)
  ↓
First Badge Earned (after 5 submissions)
  ↓
First Reward Redeemable (after reaching Level 3)
```

**Target:** >80% of downloads complete first submission within 24h.

### Retention Hooks

1. **Daily missions** — specific capture targets that refresh daily
2. **Streak mechanics** — consecutive-day bonuses with visible streak counter
3. **Badge collection** — category-specific and milestone badges
4. **Leaderboard** — community competition (weekly + all-time)
5. **Reward catalog** — tangible rewards redeemable with XP
6. **Push notifications** (future) — mission reminders, streak-at-risk alerts

### Referral Mechanics (future sprint)

- "Invite a friend" generates a unique referral link
- Referrer gets XP bonus when invitee completes first verified submission
- Invitee gets welcome bonus XP
- Both parties see a referral badge

---

## Client Acquisition Strategy

### Pitch Deck Updates Needed

Add a slide after the current product demo:

**"Now on Mobile"**
- Same verified data quality (GPS + photo + EXIF + fraud detection)
- Faster capture with native camera and GPS
- Offline-first for complete coverage (no connectivity gaps)
- App Store + Play Store distribution = agent scale

### Data Sample Preparation

For client prospects, prepare a sample dataset with:
- Coverage map of Bonamoussadi (7 verticals)
- Confidence scores per data point
- Snapshot deltas (week-over-week changes)
- Metadata richness comparison (web vs native submissions)

### Pilot Program Structure

| Phase | Duration | Deliverable |
|-------|----------|------------|
| Discovery | 1 week | Client defines data needs (verticals, zones, frequency) |
| Collection | 2-4 weeks | Agents capture data in target area |
| Delivery | 1 week | Cleaned dataset with confidence scores + coverage report |
| Review | 1 week | Client validates against ground truth, feedback |

---

## Success Metrics

| Metric | Target (30 days) | Measurement |
|--------|-----------------|-------------|
| App downloads (iOS + Android) | 100+ | App Store + Play Store analytics |
| Agent activations (first submission) | 50+ | Database: users with >=1 submission from native |
| Agent 7-day retention | >40% | Cohort analysis: agents active on day 7 |
| Agent 30-day retention | >20% | Cohort analysis: agents active on day 30 |
| Submissions from mobile | 500+ | Database: submissions where platform = ios/android |
| Client conversations generated | 3+ | SDM pipeline tracking |
| App Store rating | >4.0 | Store analytics |
| Play Store rating | >4.0 | Store analytics |
| Critical bugs reported | <5 | Sentry + store reviews |

---

## Claims That Need Data Analyst Verification

Before publishing any of the following, Data Analyst must provide verified numbers:

- [ ] Total submission count
- [ ] Total agent count
- [ ] Coverage area (neighborhoods mapped)
- [ ] Data quality metrics (confidence score average)
- [ ] Fraud detection effectiveness (detection rate)
- [ ] Any "X% improvement" claims

Use placeholder language ("hundreds of verified data points", "growing network of agents") until verified.
