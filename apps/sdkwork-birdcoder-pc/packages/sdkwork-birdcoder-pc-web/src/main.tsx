import { createRoot } from 'react-dom/client';
import {
  BootstrapGate,
  bootstrapShellRuntime,
  isBirdCoderLocalRuntimeApiBaseUrl,
  normalizeBirdCoderServerBaseUrl,
  readStoredBirdCoderServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
  waitForBirdCoderApiReady,
} from '@sdkwork/birdcoder-pc-shell-runtime';
import { createBootstrapGateMessages, ErrorBoundary } from '@sdkwork/birdcoder-pc-commons';
import { loadCatalog } from '@sdkwork/birdcoder-pc-codeengine/catalogBridge';
import { resolveWebRuntime } from './web/resolveWebRuntime';
import App from './App';
import '../../../src/index.css';

interface BirdCoderPublicRuntimeEnv {
  DEV?: string;
  VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL?: string;
  VITE_BIRDCODER_API_BASE_URL?: string;
}

interface BirdCoderRuntimeGlobal {
  __SDKWORK_PC_REACT_ENV__?: BirdCoderPublicRuntimeEnv;
}

function readConfiguredApiBaseUrl(): string | undefined {
  const runtimeGlobal = globalThis as typeof globalThis & BirdCoderRuntimeGlobal;
  return normalizeBirdCoderServerBaseUrl(
    runtimeGlobal.__SDKWORK_PC_REACT_ENV__?.VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL
      ?? runtimeGlobal.__SDKWORK_PC_REACT_ENV__?.VITE_BIRDCODER_API_BASE_URL,
  );
}

function resolveDevelopmentApiBaseUrl(apiBaseUrl?: string): string | undefined {
  const runtimeGlobal = globalThis as typeof globalThis & BirdCoderRuntimeGlobal;
  if (
    !apiBaseUrl ||
    runtimeGlobal.__SDKWORK_PC_REACT_ENV__?.DEV !== 'true' ||
    typeof window === 'undefined' ||
    !isBirdCoderLocalRuntimeApiBaseUrl(apiBaseUrl)
  ) {
    return apiBaseUrl;
  }

  // Keep browser development requests same-origin. Vite proxies the API
  // paths to the configured local server, which avoids requiring every
  // ephemeral dev port to be added to the gateway CORS allow-list.
  return window.location.origin;
}

async function bootstrapRuntime() {
  const configuredRuntimeApiBaseUrl = readConfiguredApiBaseUrl();
  const storedApiBaseUrl = await readStoredBirdCoderServerBaseUrl();
  const configuredApiBaseUrl = resolveBirdCoderBootstrapServerBaseUrl({
    configuredApiBaseUrl: configuredRuntimeApiBaseUrl,
    storedApiBaseUrl,
  });
  const resolvedApiBaseUrl = resolveDevelopmentApiBaseUrl(configuredApiBaseUrl);

  await waitForBirdCoderApiReady(resolvedApiBaseUrl);
  await bootstrapShellRuntime({
    host: resolveWebRuntime('global', {
      apiBaseUrl: resolvedApiBaseUrl,
    }),
  });

  void loadCatalog().catch((error) => {
    console.warn('[sdkwork-models] failed to load model catalog:', error);
  });
}

if (!document.getElementById('root')) {
  throw new Error('Root element #root not found in the document');
}
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <BootstrapGate bootstrap={bootstrapRuntime} messages={createBootstrapGateMessages()}>
      <App />
    </BootstrapGate>
  </ErrorBoundary>,
);

