import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isGoogleSignInSupported,
  resolveAuthCallbackUrl,
  resolveAuthRedirectUrl,
} from '../lib/client/auth.ts';

test('resolveAuthCallbackUrl prefers the browser origin on web', () => {
  assert.equal(
    resolveAuthCallbackUrl({
      nativeApp: false,
      apiBase: 'https://africandatalayer.vercel.app',
      windowOrigin: 'http://127.0.0.1:4173',
    }),
    'http://127.0.0.1:4173',
  );
});

test('resolveAuthCallbackUrl prefers the API origin on native', () => {
  assert.equal(
    resolveAuthCallbackUrl({
      nativeApp: true,
      apiBase: 'https://africandatalayer.vercel.app/api',
      windowOrigin: 'capacitor://localhost',
    }),
    'https://africandatalayer.vercel.app',
  );
});

test('resolveAuthRedirectUrl resolves callback responses against the selected callback origin', () => {
  const url = resolveAuthRedirectUrl(
    '/api/auth/signin?error=CredentialsSignin',
    {
      nativeApp: true,
      apiBase: 'https://africandatalayer.vercel.app/api',
    },
  );

  assert.equal(
    url.toString(),
    'https://africandatalayer.vercel.app/api/auth/signin?error=CredentialsSignin',
  );
});

test('isGoogleSignInSupported disables Google sign-in for native mobile', () => {
  assert.equal(isGoogleSignInSupported({ nativeApp: true }), false);
  assert.equal(isGoogleSignInSupported({ nativeApp: false }), true);
});
