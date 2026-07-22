import Foundation

enum UITestSeed {
    static let roleKey = "-uiTestRole"
    static let localeKey = "-uiTestLocale"
    static let connectivityKey = "-uiTestConnectivity"

    static func isUITesting() -> Bool {
        ProcessInfo.processInfo.arguments.contains("-uiTesting")
    }
}
