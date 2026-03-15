# African Data Layer

## Design Context

### Users

**Field Agents** (primary): Community members in Cameroonian cities (starting with Bonamoussadi, Douala) who collect infrastructure and price data on foot. They work in variable conditions — bright sunlight, intermittent connectivity, low-end Android devices. They need the app to be fast, forgiving, and rewarding.

**Admins**: Review submissions for fraud, manage assignments, monitor data quality. Need information density and forensic detail without clutter.

**Clients/Investors**: Consume aggregated data through dashboards. Need clarity, trust signals, and exportable insights.

### Brand Personality

**Empowering, Grassroots, Resilient.**

- Voice: Direct, confident, locally rooted. Speaks to agents as capable professionals, not aid recipients.
- Tone: Warm but no-nonsense. Celebrates effort without being patronizing.
- Emotional goals: Agents should feel **pride** (building something important), **speed** (capture without friction), **calm** (it works offline, no stress), and **progress** (every action moves them forward).

### Aesthetic Direction

**Visual tone**: Utilitarian with soul. The interface should feel like a well-made tool — purpose-built, reliable, with moments of warmth. Think: field equipment with craft, not a polished SaaS pitch deck.

**Color palette** (established):
- Navy `#0f2b46` — authority, trust, primary actions
- Terracotta `#c86b4a` — energy, warmth, CTAs and accents
- Forest green `#4c7c59` — growth, success, verified states
- Gold `#f4c317` — achievement, brand mark accent
- Neutrals: tinted toward navy, never pure black/white

**Anti-references** (what this must NOT look like):
- Generic SaaS dashboards (Stripe/Linear soullessness)
- NGO/Aid aesthetic (charity vibes, poverty imagery, patronizing tone)
- Silicon Valley startup (gradient heroes, abstract illustrations, tech-bro energy)
- Government/Enterprise (bureaucratic, form-heavy, institutional dullness)

**Theme**: Light mode primary. Dark mode is a future goal, pending design token extraction.

### Design Principles

1. **Field-first**: Every decision prioritizes the agent in bright sunlight with a cracked-screen Android on 2G. Large touch targets, readable text, offline resilience, low battery awareness.

2. **Earned trust, not assumed**: Trust scores, verification badges, and fraud detection are core to the product. The UI should make data provenance visible and transparent — not hidden behind abstractions.

3. **Reward the work**: Gamification (XP, streaks, badges) is not decoration — it's compensation infrastructure. Treat it with the same seriousness as the data pipeline. Every capture should feel like it counted.

4. **African identity, not African trope**: The palette, iconography, and language should feel distinctly rooted in the Cameroonian context without resorting to stereotypical "African" imagery. Let the content and community speak for themselves.

5. **Progressive disclosure**: Start simple, reveal complexity through interaction. An agent's first day should feel approachable; their 100th day should feel powerful.

### Accessibility Standards

- **Target**: WCAG 2.1 AA compliance
- **Priority accommodations**: High contrast mode (exists), reduced motion support (needed), sunlight-readable contrast ratios, minimum 44x44px touch targets, bilingual EN/FR support
- **Known gaps**: See `issues/audit-2026-03-14.md` for current findings

### Tech Stack

- React 19 + TypeScript + Vite + Tailwind CSS 3
- Recharts (charts) + Leaflet (maps) + Lucide React (icons)
- Vercel serverless + PostgreSQL (Supabase)
- Offline-first with IndexedDB queue
- Sentry for error tracking
