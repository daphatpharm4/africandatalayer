# ADL Pitch Pack

This folder contains a comprehensive multi-audience pitch package grounded in `docs/team/` and `research/`.

## Files
- `00-deck-source-matrix.md`: quantitative claim inventory and source tags.
- `01-investor-pitch-deck.md`: investor-focused narrative and fundraising framing.
- `02-b2b-buyer-pitch-deck.md`: commercial buyer narrative and conversion flow.
- `03-contributor-pitch-deck.md`: contributor recruitment, trust, and activation deck.
- `04-general-public-pitch-deck.md`: public-awareness and transparency deck.
- `05-community-partner-pitch-deck.md`: institutional partnership and execution deck.

## Audience Mapping
- Investors: `01-investor-pitch-deck.md`
- B2B buyers: `02-b2b-buyer-pitch-deck.md`
- Contributors: `03-contributor-pitch-deck.md`
- General public: `04-general-public-pitch-deck.md`
- Community partners (universities/churches/local associations): `05-community-partner-pitch-deck.md`

## Slide Format Standard
Every slide in every deck contains these fields:
- `Slide #`
- `Title`
- `Core message`
- `Slide copy`
- `Proof points`
- `Suggested visual`
- `Audience-specific CTA`

## Source and Claim Governance
- All quantitative claims use inline tags (for example `SM-12`) tied to `00-deck-source-matrix.md`.
- Source hierarchy: `docs/team/*` first, then `research/*`, then `docs/pitch-one-pager-kasi-insight.md` context.
- Conflicting numeric values are resolved in the source matrix notes and standardized across decks.
- Unconfirmed live values are intentionally marked as placeholders: `[[TO VALIDATE_*]]`.

## Recommended Usage Flow
1. Start with `00-deck-source-matrix.md` to review claim provenance.
2. Pick the audience-specific deck and adapt only placeholders.
3. Keep source tags in place while editing numeric claims.
4. If a number changes, update `00-deck-source-matrix.md` first, then all affected deck slides.

## Quality Checklist
- All seven files exist in `docs/pitch/`.
- Each deck ends with an audience-specific CTA.
- Each deck includes problem, solution, proof, and action/ask.
- Each quantitative claim maps to a source tag.
- Placeholder values are clearly marked and easy to replace.
