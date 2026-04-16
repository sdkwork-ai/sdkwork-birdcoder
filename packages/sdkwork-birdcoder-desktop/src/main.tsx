import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRoot } from '@sdkwork/birdcoder-shell/app';
import {
  bootstrapShellRuntime,
  readStoredBirdCoderServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
} from '@sdkwork/birdcoder-shell/runtime';
import { resolveDesktopRuntime } from './desktop/resolveDesktopRuntime';

const configuredApiBaseUrl = import.meta.env.VITE_BIRDCODER_API_BASE_URL?.trim() || undefined;

async function resolveDesktopApiBaseUrl(): Promise<string | undefined> {
  const storedApiBaseUrl = await readStoredBirdCoderServerBaseUrl();

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const runtimeConfig = await invoke<{ apiBaseUrl?: string | null }>('desktop_runtime_config');
    return resolveBirdCoderBootstrapServerBaseUrl({
      storedApiBaseUrl,
      runtimeApiBaseUrl: runtimeConfig?.apiBaseUrl,
      configuredApiBaseUrl,
    });
  } catch {
    return resolveBirdCoderBootstrapServerBaseUrl({
      storedApiBaseUrl,
      configuredApiBaseUrl,
    });
  }
}

const resolvedApiBaseUrl = await resolveDesktopApiBaseUrl();

bootstrapShellRuntime({
  host: resolveDesktopRuntime('global', {
    apiBaseUrl: resolvedApiBaseUrl,
  }),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
