export const H5_CAPACITOR_VERSION = '0.1.0';

export interface CapacitorPlatform {
  name: 'ios' | 'android' | 'web';
  isNative: boolean;
}

export function detectPlatform(): CapacitorPlatform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('iphone') || ua.includes('ipad')) {
    return { name: 'ios', isNative: true };
  }
  if (ua.includes('android')) {
    return { name: 'android', isNative: true };
  }
  return { name: 'web', isNative: false };
}
