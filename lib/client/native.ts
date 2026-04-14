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
  return import.meta.env.VITE_API_BASE ?? '';
}
