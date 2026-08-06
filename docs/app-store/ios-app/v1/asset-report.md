# App Store Asset Report — African Data Layer iOS v1

Accessed: 2026-08-06. Sources: [asset best practices](https://developer.apple.com/app-store/asset-best-practices/), [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications), [product page details](https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/), [review guidelines](https://developer.apple.com/app-store/review/guidelines/).

## Asset inventory

- Opaque ADL app icon: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png`.
- Twelve localized screenshots: six `en-US`, six `fr-FR`, ordered by `screenshots/manifest.json`.
- Localized name, subtitle, keywords, description, release notes, support/privacy/marketing URLs.
- Privacy matrix, review notes, release gate, and post-launch measurement baseline.

## Source truth and spec matrix

Screens use deterministic fictional Bonamoussadi fixture data rendered by production SwiftUI and ADL design tokens. They demonstrate shipped map, evidence capture, offline queue, sync, progress, and bilingual capabilities. Target is explicitly iPhone-only, so no iPad set is required. Export is portrait 1320×2868 PNG with no alpha. Six images per locale stays within Apple's 1–10 limit.

## Creative system and production briefs

First three frames communicate discovery, verified capture, and offline resilience. Remaining frames cover sync control, quality-led progress, and bilingual field use. Navy provides operational hierarchy; gold, terracotta, and forest signal status without arcade styling. App previews remain optional; any future preview must use captured app footage, readable without sound, with a poster frame that matches the first benefit.

iOS 27 product page header/search creative should reuse these truthful scenes only inside Apple's current downloadable templates. Final template exports require App Store Connect campaign intent and are not fabricated in this package.

## QA report

Automated capture builds Release, launches each fixture, normalizes to 1320×2868, removes alpha, and runs dimension/file validation. Metadata linter enforces Apple character limits. Human QA must still inspect safe-area cropping, typography, truthful parity, privacy answers, live URLs, and signed archive behavior.

## Blockers and next actions

Owner-controlled blockers: live review credentials, production URL checks, final privacy answers, signing/archive validation, and App Store Connect upload. After those pass, upload the EN/FR sets in manifest order and keep manual release enabled for final storefront verification.
