import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { createBootstrapGateMessages } from '@sdkwork/birdcoder-pc-commons';
import {
  BootstrapGate,
  bootstrapShellRuntime,
  isBirdCoderLocalRuntimeApiBaseUrl,
  normalizeBirdCoderServerBaseUrl,
  readStoredBirdCoderServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
  waitForBirdCoderApiReady,
} from '@sdkwork/birdcoder-pc-shell-runtime';
import './index.css';

interface BirdCoderPublicRuntimeEnv {
  DEV?: string;
  VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL?: string;
  VITE_BIRDCODER_API_BASE_URL?: string;
}

function resolveDevelopmentApiBaseUrl(apiBaseUrl?: string): string | undefined {
  const runtimeGlobal = globalThis as typeof globalThis & BirdCoderRuntimeGlobal;
  if (
    !apiBaseUrl
    || runtimeGlobal.__SDKWORK_PC_REACT_ENV__?.DEV !== 'true'
    || typeof window === 'undefined'
    || !isBirdCoderLocalRuntimeApiBaseUrl(apiBaseUrl)
  ) {
    return apiBaseUrl;
  }
  return window.location.origin;
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
  const resolvedApiBaseUrl = resolveDevelopmentApiBaseUrl(resolveBirdCoderBootstrapServerBaseUrl({
    configuredApiBaseUrl,
    storedApiBaseUrl,
  }));

  await waitForBirdCoderApiReady(resolvedApiBaseUrl);
  await bootstrapShellRuntime({
    apiBaseUrl: resolvedApiBaseUrl,
  });
}

createRoot(document.getElementById('root')!).render(
  <BootstrapGate bootstrap={bootstrapRuntime} messages={createBootstrapGateMessages()}>
    <App />
  </BootstrapGate>,
);

