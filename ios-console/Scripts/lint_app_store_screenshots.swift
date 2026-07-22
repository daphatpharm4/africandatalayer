import Foundation

struct ScreenshotManifest: Decodable {
    struct Frame: Decodable { let id: String }
    let locales: [String]
    let frames: [Frame]
    let width: Int
    let height: Int
}

let path = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "docs/app-store/v1/screenshots/manifest.json"
let manifest = try JSONDecoder().decode(ScreenshotManifest.self, from: Data(contentsOf: URL(fileURLWithPath: path)))

assert(Set(manifest.locales) == Set(["en-US", "fr-FR"]), "Expected en-US and fr-FR locales")
assert(manifest.frames.map(\.id) == ["operation", "capture", "review", "manage", "recover", "bilingual"],
       "Frames must be in exact order")
assert(manifest.width == 1320 && manifest.height == 2868, "Expected 1320x2868 (6.9-inch)")

print("Screenshot manifest checks passed")
print("Frames: \(manifest.frames.map(\.id))")
print("Locales: \(manifest.locales)")
print("Dimensions: \(manifest.width)x\(manifest.height)")
