# Submission Gate — Native iOS

| Gate | Current state | Required evidence |
|---|---|---|
| Device scope | Ready | iPhone-only build setting and portrait/landscape phone orientations |
| App icon | Ready | Opaque 1024×1024 PNG |
| EN/FR screenshots | Automated | 6 per locale, opaque PNG, 1320×2868, manifest linter |
| Release build | Ready | `xcodebuild` Release simulator build |
| Metadata | Automated | `metadata.json` plus metadata linter |
| Privacy answers | Needs owner confirmation | Compare matrix with production backend and SDKs |
| Review account | Needs owner action | Active credentials entered privately in App Store Connect |
| URLs | Needs live check | Support, privacy, and marketing endpoints return production content |
| Archive/upload | Needs Apple account access | Signed archive validation and App Store Connect upload |
| Product page creative | Optional | Prepare header/search creative in Apple's current iOS 27 templates if enabled |

Release remains manual until reviewer credentials, URLs, privacy answers, and signed archive are confirmed.
