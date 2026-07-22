import Foundation

struct AppStoreMetadata: Decodable {
    struct Localization: Decodable { let name: String; let subtitle: String; let keywords: String; let description: String }
    let localizations: [String: Localization]
}

let path = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "docs/app-store/v1/metadata.json"
let url = URL(fileURLWithPath: path)
let data = try Data(contentsOf: url)
let metadata = try JSONDecoder().decode(AppStoreMetadata.self, from: data)

let expectedLocales = ["en-US", "fr-FR"]
assert(Set(metadata.localizations.keys) == Set(expectedLocales), "Expected locales: \(expectedLocales), got: \(metadata.localizations.keys)")

for (locale, item) in metadata.localizations {
    assert((2...30).contains(item.name.count), "\(locale): name length \(item.name.count) not in 2-30")
    assert(item.subtitle.count <= 30, "\(locale): subtitle length \(item.subtitle.count) > 30")
    assert(item.keywords.count <= 100, "\(locale): keywords length \(item.keywords.count) > 100")
    assert(item.description.count <= 4_000, "\(locale): description length \(item.description.count) > 4000")
    assert(item.description.localizedCaseInsensitiveContains("invited") || item.description.localizedCaseInsensitiveContains("invités"),
           "\(locale): description must contain invitation-only language")
    print("\(locale): ✅ name=\(item.name.count) subtitle=\(item.subtitle.count) keywords=\(item.keywords.count) desc=\(item.description.count)")
}

print("All metadata checks passed")
