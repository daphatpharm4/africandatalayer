#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
repo="$(cd "$root/../.." && pwd)"
output="$repo/docs/app-store/ios-app/v1/screenshots"
derived="/tmp/adl-ios-app-store-assets"
device="iPhone 17 Pro"
frames=(map capture offline sync progress bilingual)
files=(01-map.png 02-capture.png 03-offline.png 04-sync.png 05-progress.png 06-bilingual.png)

xcodebuild -project "$root/App.xcodeproj" -scheme App -configuration Release -destination "platform=iOS Simulator,name=$device,OS=26.5" -derivedDataPath "$derived" CODE_SIGNING_ALLOWED=NO ONLY_ACTIVE_ARCH=YES build
xcrun simctl boot "$device" 2>/dev/null || true
xcrun simctl bootstatus "$device" -b
xcrun simctl install "$device" "$derived/Build/Products/Release-iphonesimulator/App.app"
xcrun simctl terminate "$device" com.africandatalayer.console 2>/dev/null || true
xcrun simctl status_bar "$device" override --time 9:41 --batteryState charged --batteryLevel 100 --wifiBars 3 --cellularBars 4
trap 'xcrun simctl status_bar "$device" clear >/dev/null 2>&1 || true' EXIT

for locale in en-US fr-FR; do
  mkdir -p "$output/$locale"
  for index in "${!frames[@]}"; do
    SIMCTL_CHILD_ADL_APP_STORE_CAPTURE=1 SIMCTL_CHILD_ADL_APP_STORE_FRAME="${frames[$index]}" SIMCTL_CHILD_ADL_APP_STORE_LOCALE="$locale" xcrun simctl launch --terminate-running-process "$device" com.africandatalayer.app >/dev/null
    sleep 2
    xcrun simctl io "$device" screenshot "$output/$locale/${files[$index]}" >/dev/null
    source="$output/$locale/${files[$index]}"
    opaque="/tmp/adl-ios-${locale}-${frames[$index]}.jpg"
    sips -z 2868 1320 -s format jpeg -s formatOptions 95 "$source" --out "$opaque" >/dev/null
    sips -s format png "$opaque" --out "$source" >/dev/null
    rm -f "$opaque"
  done
done

swift -module-cache-path /tmp/adl-swift-module-cache "$repo/ios-console/Scripts/lint_app_store_screenshots.swift" "$output/manifest.json"
