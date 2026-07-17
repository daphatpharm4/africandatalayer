# Native screen-reader release protocol

Run this protocol on a physical mid-range Android device with TalkBack and on a supported iPhone with VoiceOver before each native release candidate.

## Field contributor journey

1. Launch the app with the screen reader enabled and confirm the first actionable control receives focus.
2. Traverse onboarding, sign in, the map summary, category filters, contribution entry, camera/GPS confirmation, offline queue, rewards, and sign out.
3. Confirm every control has a concise bilingual name, role, state, and hint where the outcome is not obvious.
4. Confirm focus follows sheets, dialogs, validation errors, completion messages, and back navigation without escaping behind overlays.
5. Increase system text to the largest accessibility size and repeat the contribution flow in portrait and landscape; text may wrap but must not clip or hide actions.
6. Enable reduced motion, low-power mode, and offline mode; confirm progress and sync state remain understandable without animation or color alone.

## Organization and reviewer journey

1. Open the organization console, switch organizations, inspect projects, invite and revoke a collector, and sign out.
2. Open the review queue, move through risk summaries, select submissions, and perform a decision without relying on visual border color.
3. Confirm table/card content has a useful reading order and that status changes are announced once.

Record the device, OS version, app build, language, journey completed, and any blocker in the release issue in `bd`.
