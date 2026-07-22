#!/usr/bin/env bash
set -euo pipefail
configuration="Release"
evidence="docs/release/evidence/m2-release-system.md"
while (( $# )); do
  case "$1" in
    --configuration) configuration="$2"; shift 2 ;;
    --evidence) evidence="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
root="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Release Gate ==="
echo "Configuration: $configuration"
echo "Evidence: $evidence"

# Gate 1: XcodeGen drift check
echo "--- Gate 1: XcodeGen drift ---"
bash "$root/Scripts/check_xcodegen_drift.sh" || { echo "FAIL: XcodeGen drift"; exit 1; }

# Gate 2: ConsoleCore package tests
echo "--- Gate 2: ConsoleCore ---"
swift test --package-path "$root/Packages/ConsoleCore" 2>&1 | tail -3 || { echo "FAIL: ConsoleCore tests"; exit 1; }

# Gate 3: Privacy manifest
echo "--- Gate 3: Privacy manifest ---"
plutil -lint "$root/ADLConsole/PrivacyInfo.xcprivacy" >/dev/null 2>&1 || { echo "FAIL: Privacy manifest"; exit 1; }

# Gate 4: Release build
echo "--- Gate 4: Release build ---"
xcodebuild build -project "$root/ADLConsole.xcodeproj" -scheme ADLConsole -configuration "$configuration" -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -3 || { echo "FAIL: Release build"; exit 1; }

echo "=== All gates passed ==="
