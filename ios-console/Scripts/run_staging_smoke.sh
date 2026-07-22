#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
if [ -z "${ADL_STAGING_EMAIL:-}" ] || [ -z "${ADL_STAGING_PASSWORD:-}" ]; then
    echo "Staging secrets not configured — skipping (exit 77)"
    exit 77
fi
cd "$root"
xcodebuild test -project ADLConsole.xcodeproj -scheme ADLConsole-Staging -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest' -only-testing:ADLConsoleTests/StagingContractSmokeTests 2>&1 | tail -5
echo "Staging smoke passed"
