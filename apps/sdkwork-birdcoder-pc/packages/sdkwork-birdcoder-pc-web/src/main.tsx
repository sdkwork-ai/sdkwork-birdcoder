import { createRoot } from 'react-dom/client';
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
import { createBootstrapGateMessages, ErrorBoundary } from '@sdkwork/birdcoder-pc-workbench';
import { resolveWebRuntime } from './web/resolveWebRuntime';
import { resolveWebTestGitService } from './web/resolveWebTestGitService';
import App from './App';

async function bootstrapRuntime() {
  publishBirdCoderBootstrapProgress({ progress: 18, stage: 'runtime' });
  const configuredRuntimeApiBaseUrl =
    readConfiguredBirdCoderApplicationApiBaseUrl();
  const platformApiGatewayBaseUrl =
    readConfiguredBirdCoderPlatformApiGatewayBaseUrl();
  const storedApiBaseUrl = await readStoredBirdCoderServerBaseUrl();
  publishBirdCoderBootstrapProgress({ progress: 28, stage: 'runtime' });
  const configuredApiBaseUrl = resolveBirdCoderBootstrapServerBaseUrl({
    configuredApiBaseUrl: configuredRuntimeApiBaseUrl,
    storedApiBaseUrl,
  });
  const resolvedApiBaseUrl = resolveBirdCoderBrowserServerBaseUrl(configuredApiBaseUrl, {
    browserLocationUrl: window.location.href,
    preferSameOrigin: isBirdCoderDevelopmentBrowserRuntime(),
  });

  publishBirdCoderBootstrapProgress({ progress: 36, stage: 'runtime' });
  await waitForBirdCoderApiReady(resolvedApiBaseUrl);
  publishBirdCoderBootstrapProgress({ progress: 52, stage: 'runtime' });
  await bootstrapShellRuntime({
    gitService: resolveWebTestGitService(),
    host: resolveWebRuntime('global', {
      apiBaseUrl: resolvedApiBaseUrl,
    }),
    platformApiGatewayBaseUrl,
  });
  publishBirdCoderBootstrapProgress({ progress: 62, stage: 'runtime' });
}

if (!document.getElementById('root')) {
  throw new Error('Root element #root not found in the document');
}
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <BootstrapGate bootstrap={bootstrapRuntime} messages={createBootstrapGateMessages()}>
      <App bootstrapMessages={createBootstrapGateMessages()} />
    </BootstrapGate>
  </ErrorBoundary>,
);

