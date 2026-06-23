import { App } from '@capacitor/app';
import {
  bindBirdCoderDeepLinkAdapter,
  createBrowserDeepLinkAdapter,
  normalizeBirdCoderH5AuthDeepLinkPath,
  type DeepLinkHostAdapter,
} from '@sdkwork/birdcoder-h5-core';

import { isCapacitorNativePlatform } from '../runtime/capacitorRuntime.ts';

export function createCapacitorDeepLinkAdapter(): DeepLinkHostAdapter {
  const available = isCapacitorNativePlatform();

  return {
    available,
    async readInitialAuthPath() {
      if (!available) {
        return null;
      }

      const launch = await App.getLaunchUrl();
      if (!launch?.url) {
        return null;
      }

      return normalizeBirdCoderH5AuthDeepLinkPath(launch.url);
    },
    subscribe(listener) {
      if (!available) {
        return () => {};
      }

      const subscription = App.addListener('appUrlOpen', (event) => {
        const authPath = normalizeBirdCoderH5AuthDeepLinkPath(event.url);
        if (authPath) {
          listener(authPath);
        }
      });

      return () => {
        void subscription.then((handle) => handle.remove());
      };
    },
  };
}

export function registerCapacitorBirdCoderDeepLinkAdapter(): DeepLinkHostAdapter {
  const deepLinks = isCapacitorNativePlatform()
    ? createCapacitorDeepLinkAdapter()
    : createBrowserDeepLinkAdapter();
  bindBirdCoderDeepLinkAdapter(deepLinks);
  return deepLinks;
}
