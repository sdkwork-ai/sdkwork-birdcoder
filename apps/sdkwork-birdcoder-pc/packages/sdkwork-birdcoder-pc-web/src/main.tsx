import { createRoot } from 'react-dom/client';
import {
  BootstrapGate,
  bootstrapShellRuntime,
  normalizeBirdCoderServerBaseUrl,
  readStoredBirdCoderServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
  waitForBirdCoderApiReady,
} from '@sdkwork/birdcoder-pc-shell-runtime';
import { createBootstrapGateMessages, ErrorBoundary } from '@sdkwork/birdcoder-pc-commons';
import { loadCatalog } from '@sdkwork/birdcoder-pc-codeengine/catalogBridge';
import { resolveWebRuntime } from './web/resolveWebRuntime';
import App from './App';

interface BirdCoderPublicRuntimeEnv {
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

async function bootstrapRuntime() {
  const configuredApiBaseUrl = readConfiguredApiBaseUrl();
  const storedApiBaseUrl = await readStoredBirdCoderServerBaseUrl();
  const resolvedApiBaseUrl = resolveBirdCoderBootstrapServerBaseUrl({
    configuredApiBaseUrl,
    storedApiBaseUrl,
  });

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

