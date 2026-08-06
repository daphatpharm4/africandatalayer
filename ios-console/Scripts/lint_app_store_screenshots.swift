import Foundation
import ImageIO

struct ScreenshotManifest: Decodable {
    struct Frame: Decodable { let id: String; let file: String }
    let locales: [String]
    let frames: [Frame]
    let width: Int
    let height: Int
}

let path = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "docs/app-store/v1/screenshots/manifest.json"
let manifest = try JSONDecoder().decode(ScreenshotManifest.self, from: Data(contentsOf: URL(fileURLWithPath: path)))

guard Set(manifest.locales) == Set(["en-US", "fr-FR"]) else { fatalError("Expected en-US and fr-FR locales") }
guard manifest.frames.count >= 3 && manifest.frames.count <= 10 else { fatalError("Expected 3–10 frames") }
guard Set(manifest.frames.map(\.id)).count == manifest.frames.count else { fatalError("Frame IDs must be unique") }
assert(manifest.width == 1320 && manifest.height == 2868, "Expected 1320x2868 (6.9-inch)")

let root = URL(fileURLWithPath: path).deletingLastPathComponent()
for locale in manifest.locales {
    for frame in manifest.frames {
        let file = root.appendingPathComponent(locale).appendingPathComponent(frame.file)
        guard let source = CGImageSourceCreateWithURL(file as CFURL, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int else {
            fatalError("Missing or unreadable screenshot: \(file.path)")
        }
        guard width == manifest.width && height == manifest.height else {
            fatalError("Wrong size for \(file.lastPathComponent): \(width)x\(height)")
        }
        if let hasAlpha = properties[kCGImagePropertyHasAlpha] as? Bool, hasAlpha {
            fatalError("Alpha channel is not allowed: \(file.lastPathComponent)")
        }
    }
}

print("Screenshot manifest checks passed")
print("Frames: \(manifest.frames.map(\.id))")
print("Locales: \(manifest.locales)")
print("Dimensions: \(manifest.width)x\(manifest.height)")
