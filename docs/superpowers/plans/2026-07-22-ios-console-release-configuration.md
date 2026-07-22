# ADL Console Release Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make endpoint selection, signing intent, iPhone targeting, versioning, schemes, and generated Xcode files deterministic for Debug, Staging, and Release.

**Architecture:** `project.yml` and three checked-in `.xcconfig` files become source of truth. A typed `AppEnvironment` validates compiled Info.plist values before constructing the two existing clients, and CI regenerates XcodeGen output to detect drift.

**Tech Stack:** Swift 6, SwiftUI, XcodeGen, XCTest, xcconfig, GitHub Actions, Greenlight.

**Spec:** `docs/superpowers/specs/2026-07-22-ios-console-release-configuration-design.md`

## Global Constraints

- Deployment target remains iOS 17.0; Release targets iPhone only with `TARGETED_DEVICE_FAMILY = 1` and portrait orientation.
- Production host remains `www.app.africandatalayer.com`; Staging and Release require HTTPS.
- Debug localhost is allowed only when channel is `debug`.
- Signing certificates, profiles, API keys, and passwords never enter the repository.
- `NetworkAuthService` and `PlatformAPIClient` receive the same base URL and timeout policy.
- Preserve user-owned edits in `project.pbxproj`, `ADLConsoleApp.swift`, auth files, `AppState.swift`, and tests by inspecting their diffs before modification.
- Tracking issue: `africandatalayer-61m`.

---

### Task 1: Add typed environment validation

**Files:**
- Create: `ios-console/ADLConsole/Configuration/AppEnvironment.swift`
- Create: `ios-console/ADLConsoleTests/AppEnvironmentTests.swift`

**Interfaces:**
- Produces: `AppEnvironment.load(info:) throws -> AppEnvironment`, `BuildChannel`, `NetworkPolicy`, and `AppEnvironmentError`.

- [ ] **Step 1: Write the failing tests**

```swift
import XCTest
@testable import ADLConsole

final class AppEnvironmentTests: XCTestCase {
    func testReleaseAcceptsOnlyApprovedHTTPSHost() throws {
        let environment = try AppEnvironment.load(info: [
            "ADL_BUILD_CHANNEL": "production",
            "ADL_API_BASE_URL": "https://www.app.africandatalayer.com",
            "CFBundleIdentifier": "com.africandatalayer.console",
            "CFBundleShortVersionString": "1.0.0",
            "CFBundleVersion": "42"
        ])
        XCTAssertEqual(environment.channel, .production)
        XCTAssertEqual(environment.apiBaseURL.host, "www.app.africandatalayer.com")
        XCTAssertEqual(environment.network.requestTimeout, 30)
    }

    func testProductionRejectsHTTPAndUnapprovedHost() {
        XCTAssertThrowsError(try AppEnvironment.load(info: [
            "ADL_BUILD_CHANNEL": "production",
            "ADL_API_BASE_URL": "http://preview.example.com",
            "CFBundleIdentifier": "com.africandatalayer.console",
            "CFBundleShortVersionString": "1.0.0",
            "CFBundleVersion": "42"
        ]))
    }

    func testDebugAllowsLoopbackHTTP() throws {
        let environment = try AppEnvironment.load(info: [
            "ADL_BUILD_CHANNEL": "debug",
            "ADL_API_BASE_URL": "http://127.0.0.1:4173",
            "CFBundleIdentifier": "com.africandatalayer.console.debug",
            "CFBundleShortVersionString": "1.0.0",
            "CFBundleVersion": "1"
        ])
        XCTAssertEqual(environment.channel, .debug)
    }
}
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/AppEnvironmentTests`
Expected: FAIL because `AppEnvironment` is undefined.

- [ ] **Step 3: Implement the environment contract**

```swift
import Foundation

enum BuildChannel: String, Equatable, Sendable { case debug, staging, production }

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
            guard let value = info[key] as? String, !value.isEmpty else { throw AppEnvironmentError.missing(key) }
            return value
        }
        let rawChannel = try required("ADL_BUILD_CHANNEL")
        guard let channel = BuildChannel(rawValue: rawChannel) else { throw AppEnvironmentError.invalidChannel(rawChannel) }
        let rawURL = try required("ADL_API_BASE_URL")
        guard let url = URL(string: rawURL), let host = url.host else { throw AppEnvironmentError.invalidURL(rawURL) }
        let loopback = host == "localhost" || host == "127.0.0.1"
        if url.scheme != "https" && !(channel == .debug && loopback) { throw AppEnvironmentError.insecureURL }
        if channel == .production && host != "www.app.africandatalayer.com" { throw AppEnvironmentError.unapprovedProductionHost }
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
```

- [ ] **Step 4: Regenerate and run the test**

Run: `cd ios-console && xcodegen generate && xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/AppEnvironmentTests`
Expected: `** TEST SUCCEEDED **`.

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/Configuration/AppEnvironment.swift ios-console/ADLConsoleTests/AppEnvironmentTests.swift ios-console/ADLConsole.xcodeproj/project.pbxproj
git commit -m "feat: validate ios console build environment"
```

---

### Task 2: Define Debug, Staging, and Release sources of truth

**Files:**
- Create: `ios-console/Config/Debug.xcconfig`
- Create: `ios-console/Config/Staging.xcconfig`
- Create: `ios-console/Config/Release.xcconfig`
- Modify: `ios-console/project.yml`
- Modify: `ios-console/ADLConsole.xcodeproj/project.pbxproj`
- Create: `ios-console/ADLConsole.xcodeproj/xcshareddata/xcschemes/ADLConsole-Debug.xcscheme`
- Create: `ios-console/ADLConsole.xcodeproj/xcshareddata/xcschemes/ADLConsole-Staging.xcscheme`

**Interfaces:**
- Consumes: `AppEnvironment` Info.plist keys.
- Produces: three configurations/schemes and iPhone-only build settings.

- [ ] **Step 1: Add a failing source-configuration contract test**

Create `ios-console/Scripts/test_release_configuration.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
rg -q 'TARGETED_DEVICE_FAMILY: "1"' "$root/project.yml"
rg -q 'configFiles:' "$root/project.yml"
rg -q 'ADL_BUILD_CHANNEL = debug' "$root/Config/Debug.xcconfig"
rg -q 'ADL_BUILD_CHANNEL = staging' "$root/Config/Staging.xcconfig"
rg -q 'ADL_BUILD_CHANNEL = production' "$root/Config/Release.xcconfig"
! rg -q 'UISupportedInterfaceOrientations_iPad' "$root/project.yml"
```

- [ ] **Step 2: Run it and verify failure**

Run: `bash ios-console/Scripts/test_release_configuration.sh`
Expected: FAIL because the config files and mapping do not exist.

- [ ] **Step 3: Add exact configuration values and XcodeGen mapping**

```xcconfig
// Debug.xcconfig
ADL_BUILD_CHANNEL = debug
ADL_API_BASE_URL = http:/$()/127.0.0.1:4173
PRODUCT_BUNDLE_IDENTIFIER = com.africandatalayer.console.debug
```

```xcconfig
// Staging.xcconfig
ADL_BUILD_CHANNEL = staging
ADL_API_BASE_URL = https:/$()/staging.app.africandatalayer.com
PRODUCT_BUNDLE_IDENTIFIER = com.africandatalayer.console.staging
```

```xcconfig
// Release.xcconfig
ADL_BUILD_CHANNEL = production
ADL_API_BASE_URL = https:/$()/www.app.africandatalayer.com
PRODUCT_BUNDLE_IDENTIFIER = com.africandatalayer.console
```

In `project.yml`, define configurations `Debug`, `Staging`, `Release`; map the application and test targets through `configFiles`; set `TARGETED_DEVICE_FAMILY: "1"`; add `INFOPLIST_KEY_ADL_BUILD_CHANNEL: "$(ADL_BUILD_CHANNEL)"` and `INFOPLIST_KEY_ADL_API_BASE_URL: "$(ADL_API_BASE_URL)"`; remove the iPad orientation key; declare the existing development team under `DEVELOPMENT_TEAM` using the value already present in the generated project; and generate `ADLConsole-Debug`, `ADLConsole-Staging`, and `ADLConsole` schemes.

- [ ] **Step 4: Regenerate and prove settings**

Run: `cd ios-console && xcodegen generate && bash Scripts/test_release_configuration.sh && xcodebuild -project ADLConsole.xcodeproj -scheme ADLConsole -showBuildSettings | rg 'TARGETED_DEVICE_FAMILY = 1|IPHONEOS_DEPLOYMENT_TARGET = 17.0|ADL_BUILD_CHANNEL = production'`
Expected: all three expected settings are printed and the script exits 0.

- [ ] **Step 5: Commit**

```bash
git add ios-console/Config ios-console/project.yml ios-console/Scripts/test_release_configuration.sh ios-console/ADLConsole.xcodeproj
git commit -m "build: define ios console release channels"
```

---

### Task 3: Inject environment into both clients and show safe failure

**Files:**
- Modify: `ios-console/ADLConsole/ADLConsoleApp.swift`
- Modify: `ios-console/ADLConsole/Auth/AuthTransport.swift`
- Modify: `ios-console/Packages/ConsoleCore/Sources/ConsoleAPI/PlatformTransport.swift`
- Create: `ios-console/ADLConsole/Configuration/ConfigurationErrorView.swift`
- Modify: `ios-console/ADLConsoleTests/AppEnvironmentTests.swift`

**Interfaces:**
- Consumes: Task 1 `AppEnvironment`.
- Produces: one URLSession policy shared by auth and platform transports; safe no-network configuration UI.

- [ ] **Step 1: Write a failing construction test**

```swift
func testProductionAppDependenciesShareEnvironment() throws {
    let environment = try AppEnvironment.load(info: [
        "ADL_BUILD_CHANNEL": "production",
        "ADL_API_BASE_URL": "https://www.app.africandatalayer.com",
        "CFBundleIdentifier": "com.africandatalayer.console",
        "CFBundleShortVersionString": "1.0.0",
        "CFBundleVersion": "42"
    ])
    let dependencies = AppDependencies(environment: environment)
    XCTAssertEqual(dependencies.baseURL, environment.apiBaseURL)
    XCTAssertEqual(dependencies.session.configuration.timeoutIntervalForRequest, 30)
}
```

- [ ] **Step 2: Verify it fails**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole-Debug -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/AppEnvironmentTests/testProductionAppDependenciesShareEnvironment`
Expected: FAIL because `AppDependencies` is undefined.

- [ ] **Step 3: Implement dependency construction and safe UI**

```swift
struct AppDependencies {
    let baseURL: URL
    let session: URLSession
    let apiClient: PlatformAPIClient
    let authService: NetworkAuthService

    init(environment: AppEnvironment) {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = environment.network.requestTimeout
        configuration.timeoutIntervalForResource = environment.network.resourceTimeout
        configuration.httpCookieStorage = .shared
        let session = URLSession(configuration: configuration)
        self.baseURL = environment.apiBaseURL
        self.session = session
        self.apiClient = PlatformAPIClient(baseURL: environment.apiBaseURL, transport: URLSessionPlatformTransport(session: session))
        self.authService = NetworkAuthService(baseURL: environment.apiBaseURL, transport: URLSessionAuthTransport(session: session))
    }
}
```

Make the transport initializers accept `URLSession`. Replace the hard-coded URL in `ADLConsoleApp` with `Result { try AppEnvironment.load() }`; construct `AppState` only on success and render `ConfigurationErrorView(message: "ADL Console is not configured for this build.")` on failure.

- [ ] **Step 4: Run environment/auth/API tests**

Run: `xcodebuild test -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole-Debug -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/AppEnvironmentTests -only-testing:ADLConsoleTests/NetworkAuthServiceTests`
Expected: `** TEST SUCCEEDED **` and `rg -n 'https://www.app.africandatalayer.com' ios-console/ADLConsole/ADLConsoleApp.swift` returns no matches.

- [ ] **Step 5: Commit**

```bash
git add ios-console/ADLConsole/ADLConsoleApp.swift ios-console/ADLConsole/Configuration ios-console/ADLConsole/Auth/AuthTransport.swift ios-console/Packages/ConsoleCore/Sources/ConsoleAPI/PlatformTransport.swift ios-console/ADLConsoleTests/AppEnvironmentTests.swift
git commit -m "refactor: inject ios console runtime configuration"
```

---

### Task 4: Add deterministic generation and build gates

**Files:**
- Create: `ios-console/Scripts/check_xcodegen_drift.sh`
- Modify: `.github/workflows/ci.yml`
- Create: `ios-console/Package.resolved`

**Interfaces:**
- Produces: `ios-console` CI job and deterministic project drift check.

- [ ] **Step 1: Add the drift script test condition**

```bash
#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
xcodegen generate
git diff --exit-code -- ADLConsole.xcodeproj/project.pbxproj ADLConsole.xcodeproj/xcshareddata
```

- [ ] **Step 2: Run it before committing regenerated output**

Run: `bash ios-console/Scripts/check_xcodegen_drift.sh`
Expected: FAIL with the intentional generated-project diff if Task 2 output was not committed correctly; otherwise PASS.

- [ ] **Step 3: Add the macOS CI job**

```yaml
  ios-console:
    runs-on: macos-15
    defaults:
      run:
        working-directory: ios-console
    steps:
      - uses: actions/checkout@v4
      - name: Install XcodeGen and Greenlight
        run: brew install xcodegen revylai/tap/greenlight
      - name: Verify generated project
        run: bash Scripts/check_xcodegen_drift.sh
      - name: Test ConsoleCore
        run: swift test --package-path Packages/ConsoleCore
      - name: Test Debug
        run: xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole-Debug -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=latest' CODE_SIGNING_ALLOWED=NO
      - name: Compile Release
        run: xcodebuild build -project ADLConsole.xcodeproj -scheme ADLConsole -configuration Release -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO
      - name: Greenlight
        run: greenlight preflight . --format json --output "$RUNNER_TEMP/greenlight.json" --exit-code
```

- [ ] **Step 4: Run all local deterministic gates**

Run: `bash ios-console/Scripts/check_xcodegen_drift.sh && cd ios-console/Packages/ConsoleCore && swift test`
Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml ios-console/Scripts/check_xcodegen_drift.sh ios-console/Package.resolved ios-console/ADLConsole.xcodeproj
git commit -m "ci: gate ios console release configuration"
```

---

### Task 5: Reconcile release, auth, and privacy documentation

**Files:**
- Modify: `ios-console/README.md`
- Modify: `ios-console/RELEASE.md`
- Modify: `ios-console/ADLConsole/PrivacyInfo.xcprivacy`
- Modify: `ios-console/ADLConsole/Auth/AuthService.swift`
- Modify: `ios-console/ADLConsole/Auth/NetworkAuthService.swift`
- Modify: `ios-console/ADLConsole/State/AppState.swift`
- Create: `ios-console/Scripts/lint_release_docs.sh`

**Interfaces:**
- Produces: current build/auth/privacy documentation and stale-claim lint.

- [ ] **Step 1: Create the failing stale-claim lint**

```bash
#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
if rg -n -i 'later task should make|future network-backed|real cookie handshake lands|stub auth flow has no session' "$root/README.md" "$root/RELEASE.md" "$root/ADLConsole"; then
  echo "stale release/auth statement found" >&2
  exit 1
fi
plutil -lint "$root/ADLConsole/PrivacyInfo.xcprivacy"
```

- [ ] **Step 2: Verify the lint fails on current stale comments**

Run: `bash ios-console/Scripts/lint_release_docs.sh`
Expected: FAIL and print at least one stale statement.

- [ ] **Step 3: Replace stale content with factual release behavior**

Document exact commands for Debug/Staging/Release, state that `NetworkAuthService` is production and `StubAuthService` is tests/previews only, describe synchronous cookie clearing plus best-effort server sign-out, state iPhone-only/iOS 17/invitation-only, list actual privacy data categories, and remove implementation-history comments from the privacy manifest.

- [ ] **Step 4: Run docs, privacy, build, and Greenlight gates**

Run: `bash ios-console/Scripts/lint_release_docs.sh && greenlight preflight ios-console --exit-code && xcodebuild build -project ios-console/ADLConsole.xcodeproj -scheme ADLConsole -configuration Release -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO`
Expected: lint and Greenlight exit 0; Xcode reports `** BUILD SUCCEEDED **`.

- [ ] **Step 5: Commit**

```bash
git add ios-console/README.md ios-console/RELEASE.md ios-console/ADLConsole/PrivacyInfo.xcprivacy ios-console/ADLConsole/Auth ios-console/ADLConsole/State/AppState.swift ios-console/Scripts/lint_release_docs.sh
git commit -m "docs: align ios console release truth"
```
