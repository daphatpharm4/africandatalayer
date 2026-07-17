const INVITE_RETURN_STORAGE_KEY = 'adl_console_invite_return';
const INVITE_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function consoleInvitePath(token: string): string | null {
  return INVITE_TOKEN_PATTERN.test(token) ? `/console#/join?token=${token}` : null;
}

export function saveConsoleInviteReturn(
  token: string,
  storage: SessionStorageLike = sessionStorage,
): boolean {
  const path = consoleInvitePath(token);
  if (!path) return false;
  try {
    storage.setItem(INVITE_RETURN_STORAGE_KEY, path);
    return true;
  } catch {
    return false;
  }
}

export function readConsoleInviteReturn(
  storage: SessionStorageLike = sessionStorage,
): string | null {
  try {
    const value = storage.getItem(INVITE_RETURN_STORAGE_KEY);
    if (!value) return null;
    const match = /^\/console#\/join\?token=([0-9a-f]{64})$/.exec(value);
    return match ? value : null;
  } catch {
    return null;
  }
}

export function clearConsoleInviteReturn(
  storage: SessionStorageLike = sessionStorage,
): void {
  try {
    storage.removeItem(INVITE_RETURN_STORAGE_KEY);
  } catch {
    // Private browsing may make session storage unavailable.
  }
}
