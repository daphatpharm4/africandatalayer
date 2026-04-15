# ADL Branch Playbook

## Purpose

This playbook explains how to work safely across ADL's four active long-lived branches:

- `main`
- `feature/capacitor-base`
- `feature/ios-distribution`
- `feature/android-distribution`

As of `2026-04-14`, these are the branches that exist in the repo and are the ones you should optimize around for day-to-day development.

## Branch Roles

| Branch | Role | What belongs here |
| --- | --- | --- |
| `main` | shipped and stable | production-ready web and shared app code only |
| `feature/capacitor-base` | shared app integration trunk | React, Capacitor plugin usage, API calls, offline queue, shared UI, business logic |
| `feature/ios-distribution` | iOS-native branch | Xcode project, `Info.plist`, entitlements, iOS signing, App Store prep |
| `feature/android-distribution` | Android-native branch | Gradle, `AndroidManifest.xml`, Android signing, Play Store prep |

## Default Rule

- If the change affects shared app behavior, do it on `feature/capacitor-base`.
- If the change is only native iOS, do it on `feature/ios-distribution`.
- If the change is only native Android, do it on `feature/android-distribution`.
- Do not develop directly on `main`.

## Short-Lived Branch Naming

Create short-lived branches off the correct long-lived parent:

- `codex/<shared-change>`
- `codex/ios-<change>`
- `codex/android-<change>`
- `hotfix/<production-fix>`
- `sync/<source>-to-<target>`

## Workflow 1: Shared Feature Or Bugfix

Use this for:

- React screens and components
- Capacitor plugin calls in shared code
- offline queue behavior
- API calls and request handling
- shared missions, rewards, review UI, and analytics hooks

### Commands

```bash
git fetch origin

git switch feature/capacitor-base
git pull --ff-only origin feature/capacitor-base

git switch -c codex/my-shared-change
# make changes
git push -u origin codex/my-shared-change
```

### PR target

- `codex/my-shared-change` -> `feature/capacitor-base`

### After merge

1. Let `.github/workflows/merge-base-to-platforms.yml` create sync PRs into:
   - `feature/ios-distribution`
   - `feature/android-distribution`
2. Validate each platform branch if the shared change affects native behavior.
3. When the shared branch is release-ready, open a PR from `feature/capacitor-base` to `main`.

## Workflow 2: iOS-Only Fix

Use this only for:

- `Info.plist`
- entitlements
- iOS-specific permission text
- Xcode project settings
- TestFlight or App Store release prep

### Commands

```bash
git fetch origin

git switch feature/ios-distribution
git pull --ff-only origin feature/ios-distribution

git switch -c codex/ios-camera-permission-fix
# make changes
git push -u origin codex/ios-camera-permission-fix
```

### PR target

- `codex/ios-camera-permission-fix` -> `feature/ios-distribution`

### Rule

- If the fix is truly iOS-only, stop there.
- If the fix should become part of the long-term shared project state, merge it back into `feature/capacitor-base` after iOS validation.

## Workflow 3: Android-Only Fix

Use this only for:

- `AndroidManifest.xml`
- Gradle settings
- Android-specific permission behavior
- Android signing
- Play Store release prep

### Commands

```bash
git fetch origin

git switch feature/android-distribution
git pull --ff-only origin feature/android-distribution

git switch -c codex/android-location-fix
# make changes
git push -u origin codex/android-location-fix
```

### PR target

- `codex/android-location-fix` -> `feature/android-distribution`

### Rule

- If the fix is truly Android-only, keep it there.
- If it should live in the shared branch state, merge it back into `feature/capacitor-base` after Android validation.

## Workflow 4: Production Hotfix

Use this only when `main` must be repaired quickly.

### Commands

```bash
git fetch origin

git switch main
git pull --ff-only origin main

git switch -c hotfix/fix-production-issue
# make changes
git push -u origin hotfix/fix-production-issue
```

### PR target

- `hotfix/fix-production-issue` -> `main`

### Critical follow-up

After the hotfix lands on `main`, back-merge it into `feature/capacitor-base` so your shared branch does not drift:

```bash
git fetch origin

git switch -c sync/main-to-base origin/feature/capacitor-base
git merge --no-ff origin/main
git push -u origin sync/main-to-base
```

PR target:

- `sync/main-to-base` -> `feature/capacitor-base`

Then sync `feature/capacitor-base` forward into `feature/ios-distribution` and `feature/android-distribution` if the hotfix affects them.

## Workflow 5: Manual Sync From Base To Platform Branches

If the sync workflow does not open PRs automatically, open them manually.

### Base to iOS

```bash
git fetch origin

git switch -c sync/base-to-ios origin/feature/ios-distribution
git merge --no-ff origin/feature/capacitor-base
git push -u origin sync/base-to-ios
```

PR target:

- `sync/base-to-ios` -> `feature/ios-distribution`

### Base to Android

```bash
git fetch origin

git switch -c sync/base-to-android origin/feature/android-distribution
git merge --no-ff origin/feature/capacitor-base
git push -u origin sync/base-to-android
```

PR target:

- `sync/base-to-android` -> `feature/android-distribution`

## Workflow 6: Release Path

Use this for standard releases:

1. Merge shared work into `feature/capacitor-base`.
2. Sync base into `feature/ios-distribution` and `feature/android-distribution`.
3. Validate:
   - `npm run test:ci`
   - `.github/workflows/ios-build.yml` if iOS is affected
   - `.github/workflows/android-build.yml` if Android is affected
4. Merge any durable native release fixes back into `feature/capacitor-base`.
5. Open PR from `feature/capacitor-base` to `main`.
6. Deploy from `main`.

## What Not To Do

- Do not implement the same shared feature separately on all three non-main branches.
- Do not leave a `main` hotfix out of `feature/capacitor-base`.
- Do not use direct commits on long-lived branches for routine work.
- Do not store signing secrets, provisioning files, or keystore secrets in Git.

## Decision Table

| If the change is... | Branch |
| --- | --- |
| shared React, Capacitor, API, offline, analytics, missions, review UI | `feature/capacitor-base` |
| native iOS configuration or App Store release prep | `feature/ios-distribution` |
| native Android configuration or Play Store release prep | `feature/android-distribution` |
| urgent production repair | `main`, then back-merge to `feature/capacitor-base` |

## Optional `staging` Note

This repo's current operational branch model does not require a dedicated `staging` branch.

If a `staging` branch is reintroduced later, place it between `feature/capacitor-base` and `main`:

- `feature/capacitor-base` -> `staging` -> `main`

Until then, treat:

- `feature/capacitor-base` as the shared integration branch
- `main` as the production branch
