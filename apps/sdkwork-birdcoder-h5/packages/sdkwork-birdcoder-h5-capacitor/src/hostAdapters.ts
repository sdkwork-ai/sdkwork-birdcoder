import {
  bindBirdCoderH5AppSessionPersistence,
  bindBirdCoderSecureStorageAdapter,
  createBrowserSecureStorageAdapter,
  createHostAdapters,
  type HostAdapters,
  type SecureStorageHostAdapter,
} from '@sdkwork/birdcoder-h5-core';

import {
  createCapacitorSecureStorageAdapter,
  type CapacitorPreferencesPort,
} from './adapters/capacitorSecureStorageAdapter.ts';
import { registerCapacitorBirdCoderDeepLinkAdapter } from './adapters/capacitorDeepLinkAdapter.ts';
import { isCapacitorNativePlatform } from './runtime/capacitorRuntime.ts';

export {
  createCapacitorSecureStorageAdapter,
  type CapacitorPreferencesPort,
} from './adapters/capacitorSecureStorageAdapter.ts';

export function registerCapacitorBirdCoderHostAdapters(): SecureStorageHostAdapter {
  const secureStorage = createCapacitorSecureStorageAdapter({
    isNative: isCapacitorNativePlatform(),
  });
  bindBirdCoderSecureStorageAdapter(secureStorage);
  return secureStorage;
}

export function registerBirdCoderHostAdapters(): HostAdapters {
  const secureStorage = registerCapacitorBirdCoderHostAdapters();
  const deepLinks = registerCapacitorBirdCoderDeepLinkAdapter();
  bindBirdCoderH5AppSessionPersistence();
  return createHostAdapters(secureStorage, deepLinks);
}

export function registerBrowserBirdCoderHostAdapters(): HostAdapters {
  const secureStorage = createBrowserSecureStorageAdapter();
  bindBirdCoderSecureStorageAdapter(secureStorage);
  const deepLinks = registerCapacitorBirdCoderDeepLinkAdapter();
  bindBirdCoderH5AppSessionPersistence();
  return createHostAdapters(secureStorage, deepLinks);
}

export function createBirdCoderHostAdapters(options: {
  preferCapacitor?: boolean;
} = {}): HostAdapters {
  if (options.preferCapacitor === false) {
    return registerBrowserBirdCoderHostAdapters();
  }

  const secureStorage = createCapacitorSecureStorageAdapter();
  bindBirdCoderSecureStorageAdapter(secureStorage);
  const deepLinks = registerCapacitorBirdCoderDeepLinkAdapter();
  bindBirdCoderH5AppSessionPersistence();
  return createHostAdapters(secureStorage, deepLinks);
}

export { createDefaultHostAdapters, createHostAdapters, type HostAdapters };
