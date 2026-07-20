import Foundation

/// Parses a location-hash-shaped string into a `ConsoleRoute`.
///
/// Total function: never throws, always falls back to `.overview` for
/// unknown/garbage input. Tolerates a missing "#/" prefix. Direct port of
/// `parseConsoleHash` in `lib/client/consoleState.ts` — branch-for-branch.
public func parseConsoleHash(_ hash: String) -> ConsoleRoute {
    // Strip a leading "#/" or "#" or "/" if present, so we're tolerant of
    // callers passing the browser hash, a bare path, or nothing at all.
    var path = hash
    if path.hasPrefix("#/") {
        path = String(path.dropFirst(2))
    } else if path.hasPrefix("#") {
        path = String(path.dropFirst(1))
    } else if path.hasPrefix("/") {
        path = String(path.dropFirst(1))
    }

    if path.isEmpty {
        return ConsoleRoute(screen: .overview)
    }

    let parts = path.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false)
    let pathPart = String(parts[0])
    let queryPart: String? = parts.count > 1 ? String(parts[1]) : nil

    let segments = pathPart
        .split(separator: "/", omittingEmptySubsequences: true)
        .map(String.init)

    if segments.isEmpty {
        return ConsoleRoute(screen: .overview)
    }

    let first = segments[0]
    let second: String? = segments.count > 1 ? segments[1] : nil
    let third: String? = segments.count > 2 ? segments[2] : nil

    if first == "join" {
        let token = queryStringValue(queryPart, key: "token")
        if let token, !token.isEmpty {
            return ConsoleRoute(screen: .join, joinToken: token)
        }
        return ConsoleRoute(screen: .join)
    }

    switch first {
    case "overview":
        return ConsoleRoute(screen: .overview)
    case "data":
        return ConsoleRoute(screen: .data)
    case "review":
        return ConsoleRoute(screen: .review)
    case "projects":
        if let second, third == "schema" {
            return ConsoleRoute(screen: .schemaBuilder, projectId: second)
        }
        return ConsoleRoute(screen: .projects)
    case "members":
        return ConsoleRoute(screen: .members)
    case "settings":
        return ConsoleRoute(screen: .settings)
    case "onboarding":
        return ConsoleRoute(screen: .onboarding)
    default:
        return ConsoleRoute(screen: .overview)
    }
}

/// Inverse of `parseConsoleHash` for every screen shape it can produce.
/// Direct port of `consoleRouteToHash` in `lib/client/consoleState.ts`.
public func consoleRouteToHash(_ route: ConsoleRoute) -> String {
    switch route.screen {
    case .join:
        if let token = route.joinToken, !token.isEmpty {
            return "#/join?token=\(percentEncodeLikeJS(token))"
        }
        return "#/join"
    case .schemaBuilder:
        if let projectId = route.projectId, !projectId.isEmpty {
            return "#/projects/\(projectId)/schema"
        }
        return "#/projects"
    case .projects:
        return "#/projects"
    case .overview:
        return "#/overview"
    case .data:
        return "#/data"
    case .review:
        return "#/review"
    case .members:
        return "#/members"
    case .settings:
        return "#/settings"
    case .onboarding:
        return "#/onboarding"
    case .loading, .authRequired:
        return ""
    }
}

// MARK: - Query string helpers (mirrors URLSearchParams semantics for our
// single-key "token" lookup)

private func queryStringValue(_ queryPart: String?, key: String) -> String? {
    guard let queryPart, !queryPart.isEmpty else { return nil }
    for pair in queryPart.split(separator: "&", omittingEmptySubsequences: true) {
        let kv = pair.split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)
        guard !kv.isEmpty else { continue }
        let rawKey = decodeURIComponentLike(String(kv[0]))
        guard rawKey == key else { continue }
        return kv.count > 1 ? decodeURIComponentLike(String(kv[1])) : ""
    }
    return nil
}

/// application/x-www-form-urlencoded decoding: "+" is a space, then
/// percent-decode — matches `URLSearchParams.get` semantics closely enough
/// for our single "token" parameter.
private func decodeURIComponentLike(_ value: String) -> String {
    let plusReplaced = value.replacingOccurrences(of: "+", with: " ")
    return plusReplaced.removingPercentEncoding ?? plusReplaced
}

/// Matches JS `encodeURIComponent`'s unreserved character set:
/// `A-Z a-z 0-9 - _ . ! ~ * ' ( )`.
private let encodeURIComponentAllowedCharacters: CharacterSet = CharacterSet(
    charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()"
)

private func percentEncodeLikeJS(_ value: String) -> String {
    value.addingPercentEncoding(withAllowedCharacters: encodeURIComponentAllowedCharacters) ?? value
}
