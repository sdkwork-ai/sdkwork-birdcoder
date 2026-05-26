import { createRoot } from 'react-dom/client';
import { AppRoot } from '@sdkwork/birdcoder-shell';
import {
  BootstrapGate,
  bootstrapShellRuntime,
  normalizeBirdCoderServerBaseUrl,
  waitForBirdCoderApiReady,
} from '@sdkwork/birdcoder-shell-runtime';
import { ErrorBoundary } from '@sdkwork/birdcoder-commons';
import { resolveDesktopRuntime } from './desktop/resolveDesktopRuntime';

function describeStartupError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function resolveDesktopApiBaseUrl(): Promise<string> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const runtimeConfig = await invoke<{ apiBaseUrl?: string | null }>('desktop_runtime_config');
    const runtimeApiBaseUrl = normalizeBirdCoderServerBaseUrl(runtimeConfig?.apiBaseUrl);
    if (!runtimeApiBaseUrl) {
      throw new Error('BirdCoder desktop runtime config did not provide an API base URL.');
    }

    return runtimeApiBaseUrl;
  } catch (error) {
    throw new Error(
      `Failed to resolve BirdCoder desktop runtime API base URL: ${describeStartupError(error)}`,
    );
  }
}

async function bootstrapRuntime() {
  const resolvedApiBaseUrl = await resolveDesktopApiBaseUrl();
  await waitForBirdCoderApiReady(resolvedApiBaseUrl);
  await bootstrapShellRuntime({
    host: resolveDesktopRuntime('global', {
      apiBaseUrl: resolvedApiBaseUrl,
    }),
  });
}

if (!document.getElementById('root')) {
  throw new Error('Root element #root not found in the document');
}
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <BootstrapGate bootstrap={bootstrapRuntime}>
      <AppRoot />
    </BootstrapGate>
  </ErrorBoundary>,
);
