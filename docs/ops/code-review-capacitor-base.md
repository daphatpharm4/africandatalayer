# Code Review — Capacitor Base Integration

**Date:** 2026-04-15
**Reviewer:** Code Reviewer (ADL Subagent)
**Branch:** `feature/capacitor-base`
**Verdict:** APPROVE (with advisory notes)

---

## Files Reviewed

| File | Status | Notes |
|------|--------|-------|
| `capacitor.config.ts` | PASS | Clean config, correct types |
| `lib/client/native.ts` | PASS | 3 exports, well-typed |
| `lib/client/api.ts` | PASS | Clean import swap, no behavior change on web |
| `App.tsx` | PASS | All guards correct, cleanup functions present |
| `components/Screens/ContributionFlow.tsx` | PASS | Dual-path pattern consistent |
| `vercel.json` | PASS | CORS + CSP changes justified |
| `index.html` | PASS | CDN lines removed |
| `index.css` | PASS | @font-face declarations correct |
| `eslint.config.js` | PASS | ios/android ignores added |
| `.gitignore` | PASS | Native artifacts covered |
| `.github/workflows/ci.yml` | PASS | Branch triggers added |
| `.github/workflows/ios-build.yml` | PASS | Correct macOS workflow |
| `.github/workflows/android-build.yml` | PASS | Correct Ubuntu + Java workflow |
| `.github/workflows/merge-base-to-platforms.yml` | PASS | Auto-sync PRs |

---

## Blocking Issues

None.

---

## Advisory Suggestions

### A1: useEffect Cleanup in App.tsx Network Listener (line 243-261)

The native network listener setup is async, and the cleanup function is set inside the async `setup()` call. If the component unmounts before `setup()` completes, the cleanup variable may not be set.

```typescript
// Current pattern (App.tsx ~line 244-260):
let cleanup: (() => void) | undefined;
const setup = async () => {
  // ...
  cleanup = () => { void listener.remove(); };
};
void setup();
return () => { cleanup?.(); };
```

This is safe in practice because App.tsx is the root component and never unmounts during the app lifecycle. But the pattern could be improved with an `AbortController` or ref-based cleanup for reuse elsewhere. **Non-blocking.**

### A2: takeNativePhoto Error Handling (ContributionFlow.tsx ~line 878)

`takeNativePhoto()` catches errors but doesn't distinguish user cancellation from actual failures:

```typescript
const takeNativePhoto = async () => {
  try {
    const photo = await CapCamera.getPhoto({ ... });
    // process photo
  } catch {
    // user cancelled or actual error — both silently caught
  }
};
```

Capacitor Camera throws a specific error when the user cancels. Consider checking for `'User cancelled photos app'` to avoid logging/alerting on intentional cancellations. **Non-blocking.**

### A3: getPlatform Type Assertion (native.ts:8)

```typescript
return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
```

`Capacitor.getPlatform()` returns `string`. The assertion is correct for known platforms but would silently pass if Capacitor adds new platform values. Consider a validation:

```typescript
const p = Capacitor.getPlatform();
if (p !== 'ios' && p !== 'android' && p !== 'web') return 'web';
return p;
```

**Non-blocking.** Current assertion is fine for Capacitor 8.

---

## [SECURITY] Findings

### [SECURITY] S1: CORS Wildcard — Low Risk

See Security Audit M1. The wildcard CORS with credentials is technically spec-invalid but functionally safe due to browser enforcement. Browsers will not send cookies to `*` origin. Native WebViews bypass CORS entirely, so they work regardless.

**No action required for pilot.**

---

## [FRAUD-REVIEW] Findings

### [FRAUD-REVIEW] F1: Native Camera EXIF Metadata — Needs Verification

Capacitor's `CapCamera.getPhoto()` with `correctOrientation: true` and `CameraResultType.DataUrl` may produce different EXIF metadata than the browser `<input type="file" capture="environment">`.

The fraud pipeline in `lib/server/submissionFraud.ts` relies on EXIF for:
- Photo timestamp vs submission timestamp comparison
- Camera model/make consistency
- GPS coordinates cross-reference

**Action:** Fraud Lead should test native camera output through the EXIF pipeline and verify detection rules still work. No code change needed — this is a verification task.

### [FRAUD-REVIEW] F2: GPS Source Dual-Path — Verified Safe

Native GPS (`CapGeolocation.getCurrentPosition`) and web GPS (`navigator.geolocation.getCurrentPosition`) both produce `{latitude, longitude}` in the same format. The server-side GPS validation doesn't distinguish sources. No fraud surface change.

---

## Verdict

**APPROVE**

The Capacitor integration is clean, well-guarded, and doesn't introduce correctness or security regressions. Advisory items are minor and non-blocking. Fraud review items are verification tasks, not code changes.

Ready for merge to main after:
1. Fraud Lead verifies native EXIF through fraud pipeline (F1)
2. Typecheck + lint + tests pass on CI
