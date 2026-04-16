import { Capacitor } from '@capacitor/core';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPlatform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
}

export function getApiBase(): string {
  if (isNative()) {
    return 'https://africandatalayer.vercel.app';
  }
  const viteEnv =
    typeof import.meta !== 'undefined' && typeof import.meta.env === 'object'
      ? (import.meta.env as { VITE_API_BASE?: string })
      : undefined;
  return viteEnv?.VITE_API_BASE ?? '';
}
