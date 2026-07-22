import Foundation

enum BuildChannel: String, Equatable, Sendable, Codable {
    case debug, staging, production
}

struct NetworkPolicy: Equatable, Sendable {
    let requestTimeout: TimeInterval
    let resourceTimeout: TimeInterval
}

enum AppEnvironmentError: Error, Equatable {
    case missing(String)
    case invalidChannel(String)
    case invalidURL(String)
    case insecureURL
    case unapprovedProductionHost
}

struct AppEnvironment: Equatable, Sendable {
    let channel: BuildChannel
    let apiBaseURL: URL
    let bundleIdentifier: String
    let marketingVersion: String
    let buildNumber: String
    let network: NetworkPolicy
    var telemetryPrefix: String { "com.africandatalayer.console.\(channel.rawValue)" }

    static func load(info: [String: Any] = Bundle.main.infoDictionary ?? [:]) throws -> AppEnvironment {
        func required(_ key: String) throws -> String {
            guard let value = info[key] as? String, !value.isEmpty else {
                throw AppEnvironmentError.missing(key)
            }
            return value
        }
        let rawChannel = try required("ADL_BUILD_CHANNEL")
        guard let channel = BuildChannel(rawValue: rawChannel) else {
            throw AppEnvironmentError.invalidChannel(rawChannel)
        }
        let rawURL = try required("ADL_API_BASE_URL")
        guard let url = URL(string: rawURL), let host = url.host else {
            throw AppEnvironmentError.invalidURL(rawURL)
        }
        let loopback = host == "localhost" || host == "127.0.0.1"
        if url.scheme != "https" && !(channel == .debug && loopback) {
            throw AppEnvironmentError.insecureURL
        }
        if channel == .production && host != "www.app.africandatalayer.com" {
            throw AppEnvironmentError.unapprovedProductionHost
        }
        return AppEnvironment(
            channel: channel,
            apiBaseURL: url,
            bundleIdentifier: try required("CFBundleIdentifier"),
            marketingVersion: try required("CFBundleShortVersionString"),
            buildNumber: try required("CFBundleVersion"),
            network: NetworkPolicy(requestTimeout: 30, resourceTimeout: 60)
        )
    }
}
