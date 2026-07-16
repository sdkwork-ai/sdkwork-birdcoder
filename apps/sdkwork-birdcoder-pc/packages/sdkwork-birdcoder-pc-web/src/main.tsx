import { createRoot } from 'react-dom/client';
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
import { createBootstrapGateMessages, ErrorBoundary } from '@sdkwork/birdcoder-pc-commons';
import { loadCatalog } from '@sdkwork/birdcoder-pc-codeengine/catalogBridge';
import { resolveWebRuntime } from './web/resolveWebRuntime';
import App from './App';
import '../../../src/index.css';

async function bootstrapRuntime() {
  const configuredRuntimeApiBaseUrl = readConfiguredBirdCoderApiBaseUrl();
  const storedApiBaseUrl = await readStoredBirdCoderServerBaseUrl();
  const configuredApiBaseUrl = resolveBirdCoderBootstrapServerBaseUrl({
    configuredApiBaseUrl: configuredRuntimeApiBaseUrl,
    storedApiBaseUrl,
  });
  const resolvedApiBaseUrl = resolveBirdCoderBrowserServerBaseUrl(configuredApiBaseUrl, {
    browserLocationUrl: window.location.href,
    preferSameOrigin: isBirdCoderDevelopmentBrowserRuntime(),
  });

  await waitForBirdCoderApiReady(resolvedApiBaseUrl);
  await bootstrapShellRuntime({
    host: resolveWebRuntime('global', {
      apiBaseUrl: resolvedApiBaseUrl,
    }),
    realtimeTransport: readConfiguredBirdCoderRealtimeTransport(),
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

