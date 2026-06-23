import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export { Capacitor, Preferences };

export function isCapacitorNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function readCapacitorPlatformName(): 'ios' | 'android' | 'web' {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') {
    return 'ios';
  }
  if (platform === 'android') {
    return 'android';
  }
  return 'web';
}
