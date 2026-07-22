#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole-Debug -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleUITests/RoleJourneyUITests -only-testing:ADLConsoleUITests/RecoveryAccessibilityUITests -only-testing:ADLConsoleUITests/PermissionUITests 2>&1 | tail -5
echo "UI gate passed"
