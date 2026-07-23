import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { createBootstrapGateMessages } from '@sdkwork/birdcoder-pc-workbench';
import {
  BootstrapGate,
  bootstrapShellRuntime,
  isBirdCoderDevelopmentBrowserRuntime,
  readConfiguredBirdCoderApplicationApiBaseUrl,
  readConfiguredBirdCoderPlatformApiGatewayBaseUrl,
  readStoredBirdCoderServerBaseUrl,
  publishBirdCoderBootstrapProgress,
  resolveBirdCoderBrowserServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
  waitForBirdCoderApiReady,
} from '@sdkwork/birdcoder-pc-shell-runtime';
import './index.css';

async function bootstrapRuntime() {
  publishBirdCoderBootstrapProgress({ progress: 18, stage: 'runtime' });
  const configuredApiBaseUrl = readConfiguredBirdCoderApplicationApiBaseUrl();
  const platformApiGatewayBaseUrl =
    readConfiguredBirdCoderPlatformApiGatewayBaseUrl();
  const storedApiBaseUrl = await readStoredBirdCoderServerBaseUrl();
  publishBirdCoderBootstrapProgress({ progress: 28, stage: 'runtime' });
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

  publishBirdCoderBootstrapProgress({ progress: 36, stage: 'runtime' });
  await waitForBirdCoderApiReady(resolvedApiBaseUrl);
  publishBirdCoderBootstrapProgress({ progress: 52, stage: 'runtime' });
  await bootstrapShellRuntime({
    applicationApiBaseUrl: resolvedApiBaseUrl,
    platformApiGatewayBaseUrl,
  });
  publishBirdCoderBootstrapProgress({ progress: 62, stage: 'runtime' });
}

createRoot(document.getElementById('root')!).render(
  <BootstrapGate bootstrap={bootstrapRuntime} messages={createBootstrapGateMessages()}>
    <App />
  </BootstrapGate>,
);

