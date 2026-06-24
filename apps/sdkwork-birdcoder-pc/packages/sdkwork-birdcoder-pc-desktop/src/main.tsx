import { createRoot } from 'react-dom/client';
import { AppRoot } from '@sdkwork/birdcoder-pc-shell';
import {
  BootstrapGate,
  bootstrapShellRuntime,
  publishBirdCoderEmbeddedSdkRuntimeEnv,
  readDesktopEmbeddedRuntimeConfig,
  waitForBirdCoderApiReady,
} from '@sdkwork/birdcoder-pc-shell-runtime';
import { ErrorBoundary } from '@sdkwork/birdcoder-pc-commons';
import { hydrateBirdCoderDesktopAppSessionPersistence } from '@sdkwork/birdcoder-pc-infrastructure/bootstrap/appSessionPersistenceBinding';
import { resolveDesktopRuntime } from './desktop/resolveDesktopRuntime';

async function bootstrapRuntime() {
  await hydrateBirdCoderDesktopAppSessionPersistence();
  const { apiBaseUrl } = await readDesktopEmbeddedRuntimeConfig();
  publishBirdCoderEmbeddedSdkRuntimeEnv(apiBaseUrl);
  await waitForBirdCoderApiReady(apiBaseUrl);
  await bootstrapShellRuntime({
    host: resolveDesktopRuntime('global', {
      apiBaseUrl,
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
