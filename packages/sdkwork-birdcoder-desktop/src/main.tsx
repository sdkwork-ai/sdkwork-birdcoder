import { createRoot } from 'react-dom/client';
import { resolveBirdCoderRuntimeUserCenterProviderKind } from '@sdkwork/birdcoder-core';
import { AppRoot } from '@sdkwork/birdcoder-shell';
import {
  BootstrapGate,
  bootstrapShellRuntime,
  isBirdCoderLocalRuntimeApiBaseUrl,
  normalizeBirdCoderServerBaseUrl,
  readStoredBirdCoderServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
  waitForBirdCoderApiReady,
} from '@sdkwork/birdcoder-shell-runtime';
import { resolveDesktopRuntime } from './desktop/resolveDesktopRuntime';

async function resolveDesktopApiBaseUrl(): Promise<string | undefined> {
  const storedApiBaseUrl = await readStoredBirdCoderServerBaseUrl();

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const runtimeConfig = await invoke<{ apiBaseUrl?: string | null }>('desktop_runtime_config');
    const runtimeApiBaseUrl = normalizeBirdCoderServerBaseUrl(runtimeConfig?.apiBaseUrl);

    // The embedded desktop gateway is authoritative for startup and avoids stale user overrides
    // pinning the renderer to an unreachable historical endpoint.
    if (runtimeApiBaseUrl && isBirdCoderLocalRuntimeApiBaseUrl(runtimeApiBaseUrl)) {
      return runtimeApiBaseUrl;
    }

    return resolveBirdCoderBootstrapServerBaseUrl({
      storedApiBaseUrl,
      runtimeApiBaseUrl,
    });
  } catch {
    return resolveBirdCoderBootstrapServerBaseUrl({
      storedApiBaseUrl,
    });
  }
}

async function bootstrapRuntime() {
  const resolvedApiBaseUrl = await resolveDesktopApiBaseUrl();
  await waitForBirdCoderApiReady(resolvedApiBaseUrl);
  await bootstrapShellRuntime({
    host: resolveDesktopRuntime('global', {
      apiBaseUrl: resolvedApiBaseUrl,
    }),
    userCenter: {
      providerKind: resolveBirdCoderRuntimeUserCenterProviderKind(),
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <BootstrapGate bootstrap={bootstrapRuntime}>
    <AppRoot />
  </BootstrapGate>,
);
