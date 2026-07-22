#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
output_dir="$root/../docs/app-store/v1/screenshots"
mkdir -p "$output_dir/en-US" "$output_dir/fr-FR"
echo "Screenshot capture script"
echo "Manual step: Run XCUITest with simctl ui to capture 1320x2868 PNGs"
