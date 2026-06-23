import { isCapacitorNativePlatform, readCapacitorPlatformName } from './runtime/capacitorRuntime.ts';

export const H5_CAPACITOR_VERSION = '0.1.0';

export interface CapacitorPlatform {
  name: 'ios' | 'android' | 'web';
  isNative: boolean;
}

export function detectPlatform(): CapacitorPlatform {
  const name = readCapacitorPlatformName();
  return {
    name,
    isNative: isCapacitorNativePlatform(),
  };
}
