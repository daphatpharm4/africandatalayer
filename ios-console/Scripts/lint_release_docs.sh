#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
stale=false
for doc in "$root/README.md" "$root/RELEASE.md"; do
    if [ -f "$doc" ]; then
        if rg -n -i 'later task should make|future network-backed|real cookie handshake lands|stub auth flow has no session' "$doc" 2>/dev/null; then
            echo "stale release/auth statement found in $doc" >&2
            stale=true
        fi
    fi
done
for src in "$root/ADLConsole/Auth/AuthService.swift" "$root/ADLConsole/Auth/NetworkAuthService.swift" "$root/ADLConsole/State/AppState.swift"; do
    if rg -n -i 'later task should make|future network-backed|real cookie handshake lands|stub auth flow has no session' "$src" 2>/dev/null; then
        echo "stale statement found in $src" >&2
        stale=true
    fi
done
plutil -lint "$root/ADLConsole/PrivacyInfo.xcprivacy" >/dev/null 2>&1 || { echo "PrivacyInfo.xcprivacy is invalid" >&2; stale=true; }
if $stale; then
    exit 1
fi
echo "All release docs are current"
