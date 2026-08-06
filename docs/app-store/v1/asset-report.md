# App Store Asset Report — ADL Console v1

Accessed: 2026-08-06. Sources: [asset best practices](https://developer.apple.com/app-store/asset-best-practices/), [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications), [product page details](https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/), [review guidelines](https://developer.apple.com/app-store/review/guidelines/).

Inventory: opaque 1024×1024 icon; six English and six French iPhone screenshots; localized metadata; privacy matrix; review notes; TestFlight and submission gates; post-launch baseline.

Source truth: screenshots use deterministic fictional operational records rendered with production SwiftUI and ADL design tokens. Frames cover operations, capture visibility, review, project management, sync recovery, and bilingual use. Console remains iPhone-only and invitation-only.

Spec matrix: 1320×2868 portrait PNG, no alpha, six images per locale. First three prioritize operations, evidence, and review. Automation builds Release, captures each state, flattens alpha, and validates every file against the manifest.

Creative direction: credible operational clarity using navy hierarchy and restrained status colors. No claims about unshipped analytics, public signup, pricing, or unsupported automation. Optional iOS 27 header/search creative requires Apple's current templates and an App Store Connect campaign decision.

Owner-controlled blockers: reviewer accounts for each relevant role, live URL confirmation, final privacy answers, signed archive validation, and App Store Connect upload. Human QA must inspect crop, language, role accuracy, and every reviewer path before submission.
