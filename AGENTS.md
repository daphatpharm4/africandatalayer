## Design Context

### Users
African Data Layer serves three connected audiences with the field contributor experience as the primary product surface.

- Field agents use the app outdoors on mid-range Android phones, often one-handed, in bright sunlight, with intermittent connectivity and limited battery.
- Admin reviewers use the app to triage submissions, detect fraud, and coach contributors with fast, high-confidence review workflows.
- Clients and data consumers use the app to understand trustworthy deltas, monitor coverage, and export presentation-ready outputs.

The core job to be done is to help contributors quickly capture and enrich real-world infrastructure data while making the next useful action obvious, rewarding verified quality, and preserving trust.

### Brand Personality
Credible, immediate, motivating.

The interface should feel operational, map-native, and contribution-forward. It should create confidence, momentum, and clarity rather than novelty for its own sake. Reward and progression cues should stimulate contribution, but the product should never feel like a toy or a game skin pasted onto field operations.

Reference behavior and tone:

- Uber for decisiveness, hierarchy, and task momentum
- Google Maps for spatial clarity, familiarity, and grounded utility

Anti-direction:

- neon or crypto-style UI
- dark glossy dashboards as the default mood
- decorative game effects that compete with task completion
- low-contrast premium minimalism that fails outdoors

### Aesthetic Direction
Stay within the established ADL palette and documentation baseline from `design/`, `docs/`, and `research/`.

- Light-mode-first, with strong daylight readability
- High-contrast surfaces using ADL navy, gold, terracotta, and forest green
- Mobile-first layouts that feel fast and native to map/navigation products
- Motion should feel precise and informative, with selective delight around progress, rewards, and transitions
- Gamification should look operational and credible, not arcade-like

### Design Principles
1. Operational before ornamental. Every visual flourish must improve clarity, motivation, or trust.
2. Stimulate contribution through momentum. The interface should always suggest the next high-value action and make progress feel immediate.
3. Quality beats volume. Reward, hierarchy, and motion should reinforce verified value over raw activity.
4. Map-native familiarity wins. Prefer interaction patterns that feel as legible and inevitable as Uber and Google Maps.
5. Readability is non-negotiable. Design for bright sunlight, 48px touch targets, bilingual content, and reduced-motion accessibility from the start.
6. Motion must be purposeful. Use one coherent animation language with graceful fallbacks and respect for `prefers-reduced-motion`.
