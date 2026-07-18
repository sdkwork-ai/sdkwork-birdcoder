import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { createBootstrapGateMessages } from '@sdkwork/birdcoder-pc-workbench';
import {
  BootstrapGate,
  bootstrapShellRuntime,
  isBirdCoderDevelopmentBrowserRuntime,
  readConfiguredBirdCoderApiBaseUrl,
  readConfiguredBirdCoderRealtimeTransport,
  readStoredBirdCoderServerBaseUrl,
  resolveBirdCoderBrowserServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
  waitForBirdCoderApiReady,
} from '@sdkwork/birdcoder-pc-shell-runtime';
import './index.css';

async function bootstrapRuntime() {
  const configuredApiBaseUrl = readConfiguredBirdCoderApiBaseUrl();
  const storedApiBaseUrl = await readStoredBirdCoderServerBaseUrl();
  const resolvedApiBaseUrl = resolveBirdCoderBrowserServerBaseUrl(
    resolveBirdCoderBootstrapServerBaseUrl({
      configuredApiBaseUrl,
      storedApiBaseUrl,
    }),
    {
      browserLocationUrl: window.location.href,
      preferSameOrigin: isBirdCoderDevelopmentBrowserRuntime(),
    },
  );

  await waitForBirdCoderApiReady(resolvedApiBaseUrl);
  await bootstrapShellRuntime({
    apiBaseUrl: resolvedApiBaseUrl,
    realtimeTransport: readConfiguredBirdCoderRealtimeTransport(),
  });
}

createRoot(document.getElementById('root')!).render(
  <BootstrapGate bootstrap={bootstrapRuntime} messages={createBootstrapGateMessages()}>
    <App />
  </BootstrapGate>,
);

