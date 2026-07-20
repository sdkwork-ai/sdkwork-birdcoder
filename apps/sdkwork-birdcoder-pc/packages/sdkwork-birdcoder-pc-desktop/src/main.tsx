import { createRoot } from 'react-dom/client';
import { AppRoot } from '@sdkwork/birdcoder-pc-shell';
import { createBootstrapGateMessages, ErrorBoundary } from '@sdkwork/birdcoder-pc-workbench';
import {
  BootstrapGate,
  bootstrapShellRuntime,
  publishBirdCoderBootstrapProgress,
  publishBirdCoderEmbeddedSdkRuntimeEnv,
  readDesktopEmbeddedRuntimeConfig,
  waitForBirdCoderApiReady,
} from '@sdkwork/birdcoder-pc-shell-runtime';
import { hydrateBirdCoderDesktopAppSessionPersistence } from '@sdkwork/birdcoder-pc-infrastructure/bootstrap/appSessionPersistenceBinding';
import { resolveDesktopRuntime } from './desktop/resolveDesktopRuntime';

async function bootstrapRuntime() {
  publishBirdCoderBootstrapProgress({ progress: 18, stage: 'runtime' });
  await hydrateBirdCoderDesktopAppSessionPersistence();
  publishBirdCoderBootstrapProgress({ progress: 28, stage: 'runtime' });
  const { apiBaseUrl } = await readDesktopEmbeddedRuntimeConfig();
  publishBirdCoderEmbeddedSdkRuntimeEnv(apiBaseUrl);
  publishBirdCoderBootstrapProgress({ progress: 36, stage: 'runtime' });
  await waitForBirdCoderApiReady(apiBaseUrl, {
    runtimeTarget: 'desktop',
  });
  publishBirdCoderBootstrapProgress({ progress: 52, stage: 'runtime' });
  await bootstrapShellRuntime({
    host: resolveDesktopRuntime('global', {
      apiBaseUrl,
    }),
  });
  publishBirdCoderBootstrapProgress({ progress: 62, stage: 'runtime' });
}

if (!document.getElementById('root')) {
  throw new Error('Root element #root not found in the document');
}
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <BootstrapGate bootstrap={bootstrapRuntime} messages={createBootstrapGateMessages()}>
      <AppRoot />
    </BootstrapGate>
  </ErrorBoundary>,
);
