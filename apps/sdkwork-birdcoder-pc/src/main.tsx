import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { createBootstrapGateMessages } from '@sdkwork/birdcoder-pc-commons';
import {
  BootstrapGate,
  bootstrapShellRuntime,
  normalizeBirdCoderServerBaseUrl,
  readStoredBirdCoderServerBaseUrl,
  resolveBirdCoderBrowserServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
  waitForBirdCoderApiReady,
} from '@sdkwork/birdcoder-pc-shell-runtime';
import './index.css';

interface BirdCoderPublicRuntimeEnv {
  DEV?: string;
  VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL?: string;
  VITE_BIRDCODER_API_BASE_URL?: string;
}

function isDevelopmentBrowserRuntime(): boolean {
  const runtimeGlobal = globalThis as typeof globalThis & BirdCoderRuntimeGlobal;
  return import.meta.env.DEV ||
    runtimeGlobal.__SDKWORK_PC_REACT_ENV__?.DEV === 'true';
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
  const resolvedApiBaseUrl = resolveBirdCoderBrowserServerBaseUrl(
    resolveBirdCoderBootstrapServerBaseUrl({
      configuredApiBaseUrl,
      storedApiBaseUrl,
    }),
    {
      browserLocationUrl: window.location.href,
      preferSameOrigin: isDevelopmentBrowserRuntime(),
    },
  );

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

