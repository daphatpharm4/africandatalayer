#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
xcodegen generate
git diff --exit-code -- ADLConsole.xcodeproj/project.pbxproj ADLConsole.xcodeproj/xcshareddata
