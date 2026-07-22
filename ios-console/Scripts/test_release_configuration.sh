#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
rg -q 'TARGETED_DEVICE_FAMILY: "1"' "$root/project.yml" 2>/dev/null || { echo "Missing TARGETED_DEVICE_FAMILY: '1'"; exit 1; }
rg -q 'configFiles:' "$root/project.yml" 2>/dev/null || { echo "Missing configFiles in project.yml"; exit 1; }
rg -q 'ADL_BUILD_CHANNEL = debug' "$root/Config/Debug.xcconfig" 2>/dev/null || { echo "Missing Debug.xcconfig ADL_BUILD_CHANNEL"; exit 1; }
rg -q 'ADL_BUILD_CHANNEL = staging' "$root/Config/Staging.xcconfig" 2>/dev/null || { echo "Missing Staging.xcconfig ADL_BUILD_CHANNEL"; exit 1; }
rg -q 'ADL_BUILD_CHANNEL = production' "$root/Config/Release.xcconfig" 2>/dev/null || { echo "Missing Release.xcconfig ADL_BUILD_CHANNEL"; exit 1; }
! rg -q 'UISupportedInterfaceOrientations_iPad' "$root/project.yml" 2>/dev/null || { echo "iPad orientation key still present"; exit 1; }
echo "All release configuration checks passed"
