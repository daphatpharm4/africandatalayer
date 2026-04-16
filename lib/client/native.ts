import { Capacitor } from '@capacitor/core';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPlatform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
}

function toOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getApiBase(): string {
  if (isNative()) {
    return 'https://africandatalayer.vercel.app';
  }

  const viteEnv =
    typeof import.meta !== 'undefined' && typeof import.meta.env === 'object'
      ? (import.meta.env as {
          VITE_API_BASE?: string;
          VITE_FORCE_CROSS_ORIGIN_API?: string;
        })
      : undefined;

  const configuredBase = viteEnv?.VITE_API_BASE?.trim() ?? '';
  if (!configuredBase) return '';

  if (viteEnv?.VITE_FORCE_CROSS_ORIGIN_API === 'true') {
    return configuredBase;
  }

  if (typeof window !== 'undefined') {
    const apiOrigin = toOrigin(configuredBase);
    const browserOrigin = toOrigin(window.location.origin);
    if (apiOrigin && browserOrigin && apiOrigin !== browserOrigin) {
      return '';
    }
  }

  return configuredBase;
}
