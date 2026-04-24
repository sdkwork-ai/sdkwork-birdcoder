import { createRoot } from 'react-dom/client';
import { resolveBirdCoderRuntimeUserCenterProviderKind } from '@sdkwork/birdcoder-core';
import {
  BootstrapGate,
  bootstrapShellRuntime,
  normalizeBirdCoderServerBaseUrl,
  readStoredBirdCoderServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
  waitForBirdCoderApiReady,
} from '@sdkwork/birdcoder-shell-runtime';
import { resolveWebRuntime } from './web/resolveWebRuntime';
import App from './App';

interface BirdCoderPublicRuntimeEnv {
  VITE_BIRDCODER_API_BASE_URL?: string;
}

interface BirdCoderRuntimeGlobal {
  __SDKWORK_PC_REACT_ENV__?: BirdCoderPublicRuntimeEnv;
}

function readConfiguredApiBaseUrl(): string | undefined {
  const runtimeGlobal = globalThis as typeof globalThis & BirdCoderRuntimeGlobal;
  return normalizeBirdCoderServerBaseUrl(
    runtimeGlobal.__SDKWORK_PC_REACT_ENV__?.VITE_BIRDCODER_API_BASE_URL,
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
    userCenter: {
      providerKind: resolveBirdCoderRuntimeUserCenterProviderKind(),
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <BootstrapGate bootstrap={bootstrapRuntime}>
    <App />
  </BootstrapGate>,
);
