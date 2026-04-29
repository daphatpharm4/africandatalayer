# Admin Client Account Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authenticated admins create client accounts from the app without direct database access.

**Architecture:** Add an admin-only `POST /api/user?view=account_create` path that validates identifier, name, role, and temporary password, then creates a `user_profiles` row with the correct role claims and password hash. Extend the existing Profile admin Account Access card with a create-account form, while keeping the current lookup-and-role-change workflow for existing accounts.

**Tech Stack:** React 19, TypeScript, Vite, Auth.js JWT sessions, `bcryptjs`, `zod`, Postgres `user_profiles`, Node `node:test`, Playwright.

---

## Current State

Admins can already look up an existing account in `components/Screens/Profile.tsx` and change its role through `PATCH /api/user?view=account_access`. The missing piece is account creation: today a client account must exist first, usually by direct database insert or self-registration, before admin role management can touch it.

## File Structure

- Modify `lib/server/validation.ts`: add `adminAccountCreateSchema` for admin-created account payloads.
- Modify `lib/server/securityAudit.ts`: add the `admin_account_created` audit event type.
- Create `supabase/migrations/20260429_admin_account_creation_audit.sql`: extend the production `security_audit_log_event_type_check` constraint.
- Modify `api/user/index.ts`: add injectable `createAdminAccountCreateHandler`, wire it into `POST /api/user?view=account_create`, hash temporary passwords, persist roles, and audit account creation.
- Create `tests/adminAccountCreateValidation.test.ts`: cover payload validation and default client role.
- Create `tests/adminAccountCreate.test.ts`: cover server creation, duplicate handling, invalid identifier handling, and admin-role creation.
- Modify `components/Screens/Profile.tsx`: add an admin-only create-account form above the existing lookup/role editor.
- Modify `e2e/fixtures/mockApi.ts`: mock admin account creation using request body data.
- Modify `e2e/smoke/admin-access-controls.smoke.spec.ts`: prove an admin can create a client account from the UI.
- Modify `lib/docs/helpCenter.ts`: update admin account-access help copy to include account creation.

---

### Task 1: Validation And Audit Contract

**Files:**
- Modify: `lib/server/validation.ts`
- Modify: `lib/server/securityAudit.ts`
- Create: `supabase/migrations/20260429_admin_account_creation_audit.sql`
- Test: `tests/adminAccountCreateValidation.test.ts`

- [ ] **Step 1: Write the failing validation test**

Create `tests/adminAccountCreateValidation.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { adminAccountCreateSchema } from "../lib/server/validation.js";

test("adminAccountCreateSchema defaults new accounts to client role", () => {
  const result = adminAccountCreateSchema.safeParse({
    identifier: "buyer@example.com",
    name: "Buyer Team",
    password: "ClientPass123!",
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.identifier, "buyer@example.com");
  assert.equal(result.data.name, "Buyer Team");
  assert.equal(result.data.role, "client");
  assert.equal(result.data.password, "ClientPass123!");
});

test("adminAccountCreateSchema accepts explicit admin role", () => {
  const result = adminAccountCreateSchema.safeParse({
    identifier: "ops-admin@example.com",
    name: "Ops Admin",
    role: "admin",
    password: "AdminPass123!",
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.role, "admin");
});

test("adminAccountCreateSchema rejects weak temporary passwords", () => {
  const result = adminAccountCreateSchema.safeParse({
    identifier: "buyer@example.com",
    role: "client",
    password: "weakpass",
  });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(
    result.error.issues.some((issue) => issue.message === "Password must include an uppercase letter"),
    true,
  );
});

test("adminAccountCreateSchema rejects unsupported roles", () => {
  const result = adminAccountCreateSchema.safeParse({
    identifier: "buyer@example.com",
    role: "owner",
    password: "ClientPass123!",
  });

  assert.equal(result.success, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import tsx --test tests/adminAccountCreateValidation.test.ts
```

Expected: FAIL because `adminAccountCreateSchema` is not exported from `lib/server/validation.ts`.

- [ ] **Step 3: Add the validation schema**

In `lib/server/validation.ts`, insert this schema after `registerBodySchema`:

```ts
export const adminAccountCreateSchema = z
  .object({
    identifier: z.string().trim().min(3).max(160),
    password: z
      .string()
      .min(10)
      .max(128)
      .regex(/[A-Z]/, "Password must include an uppercase letter")
      .regex(/[a-z]/, "Password must include a lowercase letter")
      .regex(/[0-9]/, "Password must include a number"),
    name: z.string().trim().max(160).optional(),
    role: z.enum(["agent", "admin", "client"]).default("client"),
  })
  .strict();
```

- [ ] **Step 4: Add the audit event type**

In `lib/server/securityAudit.ts`, add `admin_account_created` to the `SecurityAuditEventType` union immediately after `"role_changed"`:

```ts
  | "role_changed"
  | "admin_account_created"
  | "remote_wipe_triggered"
```

- [ ] **Step 5: Add the Postgres audit constraint migration**

Create `supabase/migrations/20260429_admin_account_creation_audit.sql`:

```sql
-- Allows admin-created account events in the security audit log.

ALTER TABLE public.security_audit_log
  DROP CONSTRAINT IF EXISTS security_audit_log_event_type_check;

ALTER TABLE public.security_audit_log
  ADD CONSTRAINT security_audit_log_event_type_check CHECK (event_type IN (
    'login_success',
    'login_failure',
    'logout',
    'session_expired',
    'session_revoked',
    'account_locked',
    'account_unlocked',
    'role_changed',
    'admin_account_created',
    'remote_wipe_triggered',
    'remote_wipe_executed',
    'data_export',
    'privacy_request',
    'privacy_erasure',
    'submission_flagged',
    'submission_rejected',
    'admin_review',
    'api_rate_limited',
    'idempotency_conflict',
    'suspicious_activity',
    'policy_accepted',
    'ip_report_filed',
    'ip_report_updated'
  ));
```

- [ ] **Step 6: Run validation test to verify it passes**

Run:

```bash
node --import tsx --test tests/adminAccountCreateValidation.test.ts
```

Expected: PASS with 4 tests.

- [ ] **Step 7: Commit**

```bash
git add lib/server/validation.ts lib/server/securityAudit.ts supabase/migrations/20260429_admin_account_creation_audit.sql tests/adminAccountCreateValidation.test.ts
git commit -m "feat(admin): define account creation contract"
```

---

### Task 2: Admin Account Creation API

**Files:**
- Modify: `api/user/index.ts`
- Test: `tests/adminAccountCreate.test.ts`

- [ ] **Step 1: Write the failing API tests**

Create `tests/adminAccountCreate.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { createAdminAccountCreateHandler } from "../api/user/index.js";
import type { UserProfile } from "../shared/types.js";

function makeCreateRequest(body: unknown): Request {
  return new Request("http://localhost/api/user?view=account_create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.44",
    },
    body: JSON.stringify(body),
  });
}

test("admin account create handler creates a client account by default", async () => {
  let saved: { id: string; profile: UserProfile } | null = null;
  const auditEvents: Array<{ eventType: string; userId?: string | null; details?: Record<string, unknown> | null }> = [];

  const handler = createAdminAccountCreateHandler({
    getUserProfileFn: async () => null,
    hashPasswordFn: async (password) => `hashed:${password}`,
    upsertUserProfileFn: async (id, profile) => {
      saved = { id, profile };
    },
    logSecurityEventFn: async (input) => {
      auditEvents.push({
        eventType: input.eventType,
        userId: input.userId,
        details: input.details,
      });
    },
  });

  const response = await handler(
    makeCreateRequest({
      identifier: "New.Client@Example.com",
      name: "New Client",
      password: "ClientPass123!",
    }),
    "admin.ops@adl.test",
  );

  assert.equal(response.status, 201);
  assert.notEqual(saved, null);
  assert.equal(saved?.id, "new.client@example.com");
  assert.equal(saved?.profile.id, "new.client@example.com");
  assert.equal(saved?.profile.email, "new.client@example.com");
  assert.equal(saved?.profile.phone, null);
  assert.equal(saved?.profile.name, "New Client");
  assert.equal(saved?.profile.role, "client");
  assert.equal(saved?.profile.isAdmin, false);
  assert.equal(saved?.profile.mapScope, "bonamoussadi");
  assert.equal(saved?.profile.passwordHash, "hashed:ClientPass123!");
  assert.equal(saved?.profile.XP, 0);
  assert.equal(saved?.profile.trustScore, 50);
  assert.equal(saved?.profile.trustTier, "standard");

  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.id, "new.client@example.com");
  assert.equal(body.role, "client");
  assert.equal(Object.hasOwn(body, "passwordHash"), false);

  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0]?.eventType, "admin_account_created");
  assert.equal(auditEvents[0]?.userId, "new.client@example.com");
  assert.equal(auditEvents[0]?.details?.actorUserId, "admin.ops@adl.test");
  assert.equal(auditEvents[0]?.details?.role, "client");
});

test("admin account create handler creates admin accounts with global access", async () => {
  let saved: UserProfile | null = null;
  const handler = createAdminAccountCreateHandler({
    getUserProfileFn: async () => null,
    hashPasswordFn: async (password) => `hashed:${password}`,
    upsertUserProfileFn: async (_id, profile) => {
      saved = profile;
    },
    logSecurityEventFn: async () => {},
  });

  const response = await handler(
    makeCreateRequest({
      identifier: "ops-admin@example.com",
      name: "Ops Admin",
      role: "admin",
      password: "AdminPass123!",
    }),
    "admin.ops@adl.test",
  );

  assert.equal(response.status, 201);
  assert.equal(saved?.role, "admin");
  assert.equal(saved?.isAdmin, true);
  assert.equal(saved?.mapScope, "global");
});

test("admin account create handler rejects duplicate identifiers", async () => {
  let upsertCalls = 0;
  const handler = createAdminAccountCreateHandler({
    getUserProfileFn: async () => ({
      id: "existing@example.com",
      name: "Existing",
      email: "existing@example.com",
      XP: 0,
      role: "client",
    }),
    upsertUserProfileFn: async () => {
      upsertCalls += 1;
    },
    logSecurityEventFn: async () => {},
  });

  const response = await handler(
    makeCreateRequest({
      identifier: "existing@example.com",
      name: "Existing",
      password: "ClientPass123!",
    }),
    "admin.ops@adl.test",
  );

  assert.equal(response.status, 409);
  assert.equal(upsertCalls, 0);
});

test("admin account create handler rejects invalid identifiers", async () => {
  let profileLookups = 0;
  const handler = createAdminAccountCreateHandler({
    getUserProfileFn: async () => {
      profileLookups += 1;
      return null;
    },
    logSecurityEventFn: async () => {},
  });

  const response = await handler(
    makeCreateRequest({
      identifier: "not-an-email-or-phone",
      password: "ClientPass123!",
    }),
    "admin.ops@adl.test",
  );

  assert.equal(response.status, 400);
  assert.equal(profileLookups, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import tsx --test tests/adminAccountCreate.test.ts
```

Expected: FAIL because `createAdminAccountCreateHandler` is not exported from `api/user/index.ts`.

- [ ] **Step 3: Add imports to `api/user/index.ts`**

Update the imports at the top of `api/user/index.ts`:

```ts
import bcrypt from "bcryptjs";
import { requireUser } from "../../lib/auth.js";
import { inferDefaultDisplayName, normalizeIdentifier } from "../../lib/shared/identifier.js";
import { getUserProfile, isStorageUnavailableError, upsertUserProfile } from "../../lib/server/storage/index.js";
import { buildContributionEvents } from "../../lib/server/submissionEvents.js";
import { computeCanonicalUserXp } from "../../lib/server/xp.js";
import {
  createAssignment,
  getAssignmentById,
  getPlannerContext,
  listAssignments,
  updateAssignment,
} from "../../lib/server/collectionAssignments.js";
import { errorResponse, jsonResponse } from "../../lib/server/http.js";
import { logSecurityEvent } from "../../lib/server/securityAudit.js";
import { updateUserTrust } from "../../lib/server/userTrust.js";
import {
  adminAccountCreateSchema,
  adminUserAccessPatchSchema,
  userStatusPatchSchema,
  userUpdateSchema,
} from "../../lib/server/validation.js";
import { DEFAULT_AVATAR_PRESET, encodeAvatarPresetImage } from "../../shared/avatarPresets.js";
import type {
  CollectionAssignmentCreateInput,
  CollectionAssignmentStatus,
  CollectionAssignmentUpdateInput,
  MapScope,
  UserProfile,
  UserRole,
} from "../../shared/types.js";
```

- [ ] **Step 4: Add injectable account creation handler**

In `api/user/index.ts`, insert this code after `sanitizeProfile`:

```ts
type GetUserProfileFn = typeof getUserProfile;
type UpsertUserProfileFn = typeof upsertUserProfile;
type HashPasswordFn = typeof bcrypt.hash;
type LogSecurityEventFn = typeof logSecurityEvent;

type AdminAccountCreateDeps = {
  getUserProfileFn?: GetUserProfileFn;
  upsertUserProfileFn?: UpsertUserProfileFn;
  hashPasswordFn?: HashPasswordFn;
  logSecurityEventFn?: LogSecurityEventFn;
};

export function createAdminAccountCreateHandler(deps: AdminAccountCreateDeps = {}) {
  const getUserProfileFn = deps.getUserProfileFn ?? getUserProfile;
  const upsertUserProfileFn = deps.upsertUserProfileFn ?? upsertUserProfile;
  const hashPasswordFn = deps.hashPasswordFn ?? bcrypt.hash;
  const logSecurityEventFn = deps.logSecurityEventFn ?? logSecurityEvent;

  return async function handleAdminAccountCreate(request: Request, actorUserId: string): Promise<Response> {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const validation = adminAccountCreateSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0]?.message ?? "Invalid request body", 400);
    }

    const body = validation.data;
    const normalizedIdentifier = normalizeIdentifier(body.identifier);
    if (!normalizedIdentifier) {
      return errorResponse("Enter a valid email or phone number", 400);
    }

    const userId = normalizedIdentifier.value;
    try {
      const existing = await getUserProfileFn(userId);
      if (existing) {
        return errorResponse("An account already exists for this phone/email", 409);
      }

      const nextRole = body.role;
      const nextIsAdmin = nextRole === "admin";
      const nextMapScope: MapScope = nextIsAdmin ? "global" : "bonamoussadi";
      const name = body.name?.trim() || inferDefaultDisplayName(userId);

      const profile: UserProfile = {
        id: userId,
        name,
        email: normalizedIdentifier.type === "email" ? userId : null,
        phone: normalizedIdentifier.type === "phone" ? userId : null,
        image: encodeAvatarPresetImage(DEFAULT_AVATAR_PRESET),
        avatarPreset: DEFAULT_AVATAR_PRESET,
        occupation: nextRole === "client" ? "Client stakeholder" : "",
        XP: 0,
        passwordHash: await hashPasswordFn(body.password, 12),
        isAdmin: nextIsAdmin,
        role: nextRole,
        mapScope: nextMapScope,
        trustScore: 50,
        trustTier: "standard",
        failedLoginCount: 0,
        lockedUntil: null,
        wipeRequested: false,
        suspendedUntil: null,
      };

      await upsertUserProfileFn(userId, profile);
      await logSecurityEventFn({
        eventType: "admin_account_created",
        userId,
        request,
        details: {
          actorUserId,
          role: nextRole,
          isAdmin: nextIsAdmin,
          mapScope: nextMapScope,
          identifierType: normalizedIdentifier.type,
        },
      });

      return jsonResponse(sanitizeProfile(profile), { status: 201 });
    } catch (error) {
      if (isStorageUnavailableError(error)) {
        return errorResponse("Storage service temporarily unavailable", 503, { code: "storage_unavailable" });
      }
      throw error;
    }
  };
}

const handleAdminAccountCreate = createAdminAccountCreateHandler();
```

- [ ] **Step 5: Wire the POST route**

In `api/user/index.ts`, replace the start of `POST` after the admin check:

```ts
  const url = new URL(request.url);
  const view = url.searchParams.get("view");
  if (view !== "assignments") return errorResponse("Invalid view", 400);
```

with:

```ts
  const url = new URL(request.url);
  const view = url.searchParams.get("view");
  if (view === "account_create") {
    return await handleAdminAccountCreate(request, auth.id);
  }
  if (view !== "assignments") return errorResponse("Invalid view", 400);
```

- [ ] **Step 6: Run API tests to verify they pass**

Run:

```bash
node --import tsx --test tests/adminAccountCreate.test.ts tests/adminAccountCreateValidation.test.ts
```

Expected: PASS with 8 tests.

- [ ] **Step 7: Run auth regression tests**

Run:

```bash
node --import tsx --test tests/adminAuth.test.ts tests/registerApi.test.ts
```

Expected: PASS. This confirms DB-created admins still log in with credentials and self-registration remains policy-gated.

- [ ] **Step 8: Commit**

```bash
git add api/user/index.ts tests/adminAccountCreate.test.ts
git commit -m "feat(admin): create managed user accounts"
```

---

### Task 3: Admin Profile UI Create Form

**Files:**
- Modify: `components/Screens/Profile.tsx`

- [ ] **Step 1: Add state for account creation**

In `components/Screens/Profile.tsx`, after the existing account access state declarations:

```ts
  const [accountLookupInput, setAccountLookupInput] = useState('');
  const [managedAccount, setManagedAccount] = useState<UserProfile | null>(null);
  const [managedRole, setManagedRole] = useState<UserRole>('agent');
  const [lookupError, setLookupError] = useState('');
  const [accessActionError, setAccessActionError] = useState('');
  const [accessActionSuccess, setAccessActionSuccess] = useState('');
  const [isLookingUpAccount, setIsLookingUpAccount] = useState(false);
  const [isSavingAccountAccess, setIsSavingAccountAccess] = useState(false);
```

add:

```ts
  const [createIdentifier, setCreateIdentifier] = useState('');
  const [createName, setCreateName] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>('client');
  const [createPassword, setCreatePassword] = useState('');
  const [createAccountError, setCreateAccountError] = useState('');
  const [createAccountSuccess, setCreateAccountSuccess] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
```

After `hasManagedAccessChanges`, add:

```ts
  const canCreateAccount =
    createIdentifier.trim().length > 0 &&
    createPassword.trim().length >= 10 &&
    !isCreatingAccount;
```

- [ ] **Step 2: Add the create-account handler**

In `components/Screens/Profile.tsx`, insert this function immediately before `handleLookupAccount`:

```ts
  const handleCreateAccount = async () => {
    if (!canCreateAccount) {
      setCreateAccountError(t('Enter an email or phone and a temporary password.', 'Saisissez un email ou numéro et un mot de passe temporaire.'));
      return;
    }

    setCreateAccountError('');
    setCreateAccountSuccess('');
    setLookupError('');
    setAccessActionError('');
    setAccessActionSuccess('');

    try {
      setIsCreatingAccount(true);
      const created = await apiJson<UserProfile>('/api/user?view=account_create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: createIdentifier.trim(),
          name: createName.trim() || undefined,
          role: createRole,
          password: createPassword,
        }),
      });

      setManagedAccount(created);
      setManagedRole(resolveRole(created));
      setAccountLookupInput(created.email || created.phone || created.id);
      setCreateIdentifier('');
      setCreateName('');
      setCreateRole('client');
      setCreatePassword('');
      setCreateAccountSuccess(t('Account created. Share the temporary password through a trusted channel.', 'Compte créé. Partagez le mot de passe temporaire via un canal de confiance.'));
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : t('Unable to create account.', 'Impossible de créer le compte.');
      setCreateAccountError(message);
    } finally {
      setIsCreatingAccount(false);
    }
  };
```

- [ ] **Step 3: Update the Account Access heading copy**

Inside the `profile-admin-access` card, replace the heading block text:

```tsx
              <h3 className="text-sm font-bold text-gray-900">
                {t('Grant admin access to another account', 'Donner un acces admin a un autre compte')}
              </h3>
              <p className="text-xs leading-5 text-gray-500">
                {t(
                  'Look up an account by exact email or phone, then promote it to admin. Admin accounts automatically unlock Cameroon and worldwide map views.',
                  'Recherchez un compte par email ou numero exact, puis promouvez-le en admin. Les comptes admin debloquent automatiquement les vues Cameroun et monde entier.',
                )}
              </p>
```

with:

```tsx
              <h3 className="text-sm font-bold text-gray-900">
                {t('Create or manage account access', 'Créer ou gérer les accès aux comptes')}
              </h3>
              <p className="text-xs leading-5 text-gray-500">
                {t(
                  'Create client accounts, then look up any account by exact email or phone to adjust Agent, Client, or Admin access. Admin accounts automatically unlock worldwide map views.',
                  'Créez des comptes client, puis recherchez un compte par email ou numéro exact pour régler les accès Agent, Client ou Admin. Les comptes admin débloquent automatiquement la vue mondiale.',
                )}
              </p>
```

- [ ] **Step 4: Add the create form JSX**

Inside the `profile-admin-access` card, place this block after the heading block and before the existing lookup input row:

```tsx
            <div className="space-y-3 rounded-2xl border border-navy-border bg-page p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-900">
                    {t('Create account', 'Créer un compte')}
                  </div>
                  <div className="text-xs text-gray-500">
                    {t('Default role is Client. The user accepts policies on first login.', 'Le rôle par défaut est Client. L’utilisateur accepte les politiques à la première connexion.')}
                  </div>
                </div>
                <span className="rounded-full bg-gold-wash px-3 py-1 micro-label text-amber-900">
                  {roleLabel(createRole)}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="micro-label text-gray-400">
                    {t('Email or phone', 'Email ou téléphone')}
                  </span>
                  <input
                    type="text"
                    value={createIdentifier}
                    onChange={(event) => setCreateIdentifier(event.target.value)}
                    placeholder={t('client@example.com or +237...', 'client@exemple.com ou +237...')}
                    data-testid="admin-account-create-identifier"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-navy"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="micro-label text-gray-400">
                    {t('Display name', 'Nom affiché')}
                  </span>
                  <input
                    type="text"
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    placeholder={t('Client team name', 'Nom de l’équipe client')}
                    data-testid="admin-account-create-name"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-navy"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="micro-label text-gray-400">
                    {t('Role', 'Rôle')}
                  </span>
                  <select
                    value={createRole}
                    onChange={(event) => setCreateRole(event.target.value as UserRole)}
                    data-testid="admin-account-create-role"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-navy"
                  >
                    <option value="client">{t('Client', 'Client')}</option>
                    <option value="agent">{t('Agent', 'Agent')}</option>
                    <option value="admin">{t('Admin', 'Admin')}</option>
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="micro-label text-gray-400">
                    {t('Temporary password', 'Mot de passe temporaire')}
                  </span>
                  <input
                    type="password"
                    value={createPassword}
                    onChange={(event) => setCreatePassword(event.target.value)}
                    placeholder={t('Minimum 10 chars, mixed case, number', '10 caractères min., majuscule, minuscule, chiffre')}
                    data-testid="admin-account-create-password"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-navy"
                  />
                </label>
              </div>

              {createAccountError && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-[11px] text-red-600">
                  {createAccountError}
                </div>
              )}

              {createAccountSuccess && (
                <div data-testid="admin-account-create-success" className="rounded-xl border border-forest/20 bg-forest-wash p-3 text-[11px] text-forest-dark">
                  {createAccountSuccess}
                </div>
              )}

              <button
                type="button"
                onClick={handleCreateAccount}
                disabled={!canCreateAccount}
                data-testid="admin-account-create-submit"
                className={`h-11 rounded-xl px-4 text-sm font-semibold ${
                  !canCreateAccount ? 'bg-gray-100 text-gray-400' : 'bg-navy text-white'
                }`}
              >
                {isCreatingAccount ? t('Creating...', 'Création...') : t('Create account', 'Créer le compte')}
              </button>
            </div>
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/Screens/Profile.tsx
git commit -m "feat(admin): add account creation form"
```

---

### Task 4: Playwright Mock And Smoke Coverage

**Files:**
- Modify: `e2e/fixtures/mockApi.ts`
- Modify: `e2e/smoke/admin-access-controls.smoke.spec.ts`

- [ ] **Step 1: Update Playwright mock imports**

In `e2e/fixtures/mockApi.ts`, add the type import:

```ts
import type { UserRole } from '../../shared/types';
```

- [ ] **Step 2: Add admin account creation mock**

In `e2e/fixtures/mockApi.ts`, inside `page.route('**/api/**', async (route) => { ... })`, add this block after the `/api/auth/register` mock and before the credentials callback mock:

```ts
    if (
      role === 'admin' &&
      url.pathname === '/api/user' &&
      url.searchParams.get('view') === 'account_create' &&
      method === 'POST'
    ) {
      const payload = request.postDataJSON() as {
        identifier?: string;
        name?: string;
        role?: UserRole;
        password?: string;
      };
      const identifier = String(payload.identifier ?? '').trim().toLowerCase();
      const accountRole: UserRole =
        payload.role === 'admin' || payload.role === 'agent' || payload.role === 'client'
          ? payload.role
          : 'client';
      const name = String(payload.name ?? '').trim() || 'New client account';

      if (!identifier || knownCredentials.has(identifier)) {
        await fulfillRoute(route, {
          status: identifier ? 409 : 400,
          body: {
            error: identifier
              ? 'An account already exists for this phone/email'
              : 'Enter a valid email or phone number',
          },
        });
        return;
      }

      knownCredentials.set(identifier, String(payload.password ?? ''));
      knownNames.set(identifier, name);
      await fulfillRoute(route, {
        status: 201,
        body: {
          id: identifier,
          name,
          email: identifier.includes('@') ? identifier : null,
          phone: identifier.startsWith('+') ? identifier : null,
          image: 'baobab',
          avatarPreset: 'baobab',
          occupation: accountRole === 'client' ? 'Client stakeholder' : '',
          XP: 0,
          isAdmin: accountRole === 'admin',
          role: accountRole,
          mapScope: accountRole === 'admin' ? 'global' : 'bonamoussadi',
          trustScore: 50,
          trustTier: 'standard',
          suspendedUntil: null,
          wipeRequested: false,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      return;
    }
```

- [ ] **Step 3: Extend the admin smoke test**

In `e2e/smoke/admin-access-controls.smoke.spec.ts`, after this assertion:

```ts
  await expect(page.getByTestId("profile-admin-access")).toBeVisible();
```

insert:

```ts
  await page.getByTestId("admin-account-create-identifier").fill("new.client@adl.test");
  await page.getByTestId("admin-account-create-name").fill("New Client Buyer");
  await page.getByTestId("admin-account-create-role").selectOption("client");
  await page.getByTestId("admin-account-create-password").fill("ClientPass123!");
  await page.getByTestId("admin-account-create-submit").click();

  await expect(page.getByTestId("admin-account-create-success")).toContainText(/Account created/i);
  await expect(page.getByText(/New Client Buyer/i)).toBeVisible();
  await expect(page.getByTestId("admin-account-role")).toHaveValue("client");
  await expect(page.getByTestId("profile-admin-access")).toContainText(/Current access: Client/i);
```

- [ ] **Step 4: Run admin smoke test**

Run:

```bash
npx playwright test e2e/smoke/admin-access-controls.smoke.spec.ts --project=admin-desktop
```

Expected: PASS. If Playwright browsers are missing, run `npm run playwright:install` once, then rerun the smoke test.

- [ ] **Step 5: Commit**

```bash
git add e2e/fixtures/mockApi.ts e2e/smoke/admin-access-controls.smoke.spec.ts
git commit -m "test(admin): cover client account creation"
```

---

### Task 5: Help Copy And Final Verification

**Files:**
- Modify: `lib/docs/helpCenter.ts`

- [ ] **Step 1: Update help-center copy**

In `lib/docs/helpCenter.ts`, replace the `admin-account-access` entry body with:

```ts
  'admin-account-access': {
    id: 'admin-account-access',
    title: 'Account access management',
    surface: 'Admin field orchestration',
    audiences: ['admin'],
    entryPoint: 'Profile dashboard -> Account Access card (admin only)',
    summary: 'Lets admins create client accounts, look up existing user accounts by email or phone, and change roles between Agent, Client, and Admin. Admin accounts automatically unlock worldwide map scope.',
    whyItMatters: 'Role management is the trust escalation lever. Admin-created users no longer require direct database edits, and every creation or role change is audit-logged for security review.',
    primaryActions: [
      'Create a new account with email or phone, display name, role, and temporary password.',
      'Search for an existing account by exact email or phone number.',
      'Change the role to Agent, Client, or Admin and save.',
    ],
    keySignals: [
      'Created account role and map scope',
      'Current role and map scope of the target account',
      'Confirmation message after successful creation or role change',
      'Self-edit protection: admins cannot change their own role from this panel',
    ],
    screenshots: [],
  },
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
node --import tsx --test tests/adminAccountCreateValidation.test.ts tests/adminAccountCreate.test.ts tests/adminAuth.test.ts tests/registerApi.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run project typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run admin E2E smoke**

Run:

```bash
npx playwright test e2e/smoke/admin-access-controls.smoke.spec.ts --project=admin-desktop
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/docs/helpCenter.ts
git commit -m "docs(admin): document account creation"
```

---

## Manual Acceptance

- [ ] Sign in as an admin.
- [ ] Open `Profile`.
- [ ] In `Account Access`, create `client.demo@adl.test` with role `Client` and a temporary password such as `ClientPass123!`.
- [ ] Confirm the created account appears in the managed account panel with `Current access: Client · Bonamoussadi only`.
- [ ] Sign out.
- [ ] Sign in with `client.demo@adl.test` and the temporary password.
- [ ] Confirm the policy gate appears if no policy acceptance records exist.
- [ ] Accept policies.
- [ ] Confirm the client lands on the client dashboard, not the field-agent home.

## Security Notes

- Admin-created users must not get policy acceptance rows during creation; the first-login policy gate records the real user's acceptance.
- The API response must not include `passwordHash`.
- Temporary passwords are only accepted from the admin form and hashed server-side. The app must not store or redisplay plaintext passwords after creation.
- Existing `PATCH /api/user?view=account_access` self-demotion protection remains unchanged.

## Self Review

- Spec coverage: Admins can create client accounts in-app through Task 2 and Task 3. Existing admin account creation is supported by the same role selector because current RBAC already lets admins grant admin access. Direct database creation is no longer required.
- Placeholder scan: No deferred implementation markers remain in this plan.
- Type consistency: `UserRole`, `MapScope`, `UserProfile`, `adminAccountCreateSchema`, and `createAdminAccountCreateHandler` names are consistent across tests, API, UI, and mocks.
