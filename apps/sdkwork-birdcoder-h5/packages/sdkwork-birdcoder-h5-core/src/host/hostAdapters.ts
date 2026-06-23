import type { SecureStorageHostAdapter } from './secureStorageAdapter.ts';
import { getBirdCoderSecureStorageAdapter } from './secureStorageAdapter.ts';
import type { DeepLinkHostAdapter } from './deepLinkAdapter.ts';
import {
  createBrowserDeepLinkAdapter,
  getBirdCoderDeepLinkAdapter,
} from './deepLinkAdapter.ts';

export interface HostAdapters {
  camera: { available: boolean };
  qrScanner: { available: boolean };
  pushNotifications: { available: boolean };
  deepLinks: DeepLinkHostAdapter;
  secureStorage: { available: boolean };
  biometric: { available: boolean };
  clipboard: { available: boolean };
  filePicker: { available: boolean };
}

export function createHostAdapters(
  secureStorage: SecureStorageHostAdapter,
  deepLinks: DeepLinkHostAdapter = createBrowserDeepLinkAdapter(),
): HostAdapters {
  return {
    camera: { available: false },
    qrScanner: { available: false },
    pushNotifications: { available: false },
    deepLinks,
    secureStorage: { available: secureStorage.available },
    biometric: { available: false },
    clipboard: { available: typeof navigator !== 'undefined' && !!navigator.clipboard },
    filePicker: { available: typeof document !== 'undefined' && 'createElement' in document },
  };
}

export function createDefaultHostAdapters(): HostAdapters {
  return createHostAdapters(
    getBirdCoderSecureStorageAdapter(),
    getBirdCoderDeepLinkAdapter(),
  );
}
