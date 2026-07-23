import { createRoot } from 'react-dom/client';
import { AppRoot } from '@sdkwork/birdcoder-pc-shell';
import { createBootstrapGateMessages, ErrorBoundary } from '@sdkwork/birdcoder-pc-workbench';
import {
  BootstrapGate,
  bootstrapShellRuntime,
  publishBirdCoderBootstrapProgress,
  publishBirdCoderDesktopSdkRuntimeEnv,
  readDesktopRuntimeConfig,
  waitForBirdCoderApiReady,
} from '@sdkwork/birdcoder-pc-shell-runtime';
import { hydrateBirdCoderDesktopAppSessionPersistence } from '@sdkwork/birdcoder-pc-infrastructure/bootstrap/appSessionPersistenceBinding';
import { resolveDesktopRuntime } from './desktop/resolveDesktopRuntime';

async function bootstrapRuntime() {
  publishBirdCoderBootstrapProgress({ progress: 18, stage: 'runtime' });
  await hydrateBirdCoderDesktopAppSessionPersistence();
  publishBirdCoderBootstrapProgress({ progress: 28, stage: 'runtime' });
  const runtimeConfig = await readDesktopRuntimeConfig();
  const { applicationApiBaseUrl, platformApiGatewayBaseUrl } = runtimeConfig;
  publishBirdCoderDesktopSdkRuntimeEnv(runtimeConfig);
  publishBirdCoderBootstrapProgress({ progress: 36, stage: 'runtime' });
  await waitForBirdCoderApiReady(applicationApiBaseUrl, {
    runtimeTarget: 'desktop',
  });
  publishBirdCoderBootstrapProgress({ progress: 52, stage: 'runtime' });
  await bootstrapShellRuntime({
    deploymentProfile: runtimeConfig.deploymentProfile,
    executionLocation: runtimeConfig.executionLocation,
    host: resolveDesktopRuntime('global', {
      apiBaseUrl: applicationApiBaseUrl,
    }),
    platformApiGatewayBaseUrl,
    runtimeTarget: runtimeConfig.runtimeTarget,
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
