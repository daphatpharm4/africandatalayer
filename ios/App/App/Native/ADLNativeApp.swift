import SwiftUI

@main
struct ADLNativeApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var appState = AppState()

    init() {
        // Tile + API response cache: 32MB memory / 256MB disk. CARTO tiles are
        // immutable per z/x/y so returnCacheDataElseLoad keeps the field map warm.
        URLCache.shared = URLCache(memoryCapacity: 32 * 1024 * 1024,
                                   diskCapacity: 256 * 1024 * 1024)
    }

    var body: some Scene {
        WindowGroup {
            // Light mode is the shipped appearance: surfaces are hardcoded to the
            // light palette, so following the system dark setting would mix
            // adaptive .secondary text into white cards and break legibility.
            if AppStoreCaptureConfiguration.isEnabled {
                AppStoreCaptureView(configuration: .current)
                    .environment(\.font, ADLFont.body)
                    .preferredColorScheme(.light)
            } else {
                RootView()
                    .environmentObject(appState)
                    .environment(\.font, ADLFont.body)
                    .tint(ADLColor.navy)
                    .preferredColorScheme(.light)
            }
        }
    }
}
