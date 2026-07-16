import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { StartupScreen } from '@sdkwork/birdcoder-pc-ui-shell';
import { SdkworkSessionAuthBrowserRoot } from '@sdkwork/auth-pc-react';
import { BirdCoderAuthGate } from '@sdkwork/birdcoder-pc-iam';
import { AppProviders } from '../providers/AppProviders';
import { ShellRuntimeProviders } from '../providers/ShellRuntimeProviders';

const LazyBirdcoderApp = lazy(async () => {
  const module = await import('./loadBirdcoderApp');
  return module.loadBirdcoderApp();
});

function AppRootLoadingFallback() {
  const { t } = useTranslation();

  return (
    <StartupScreen
      description={t('bootstrap.loadingWorkspace')}
      progress={88}
      stage="workspace"
      stageLabels={{
        runtime: t('bootstrap.runtimeStage'),
        session: t('bootstrap.sessionStage'),
        workspace: t('bootstrap.workspaceStage'),
      }}
      title={t('bootstrap.startingTitle')}
    />
  );
}

export default function AppRoot() {
  return (
    <MemoryRouter>
      <SdkworkSessionAuthBrowserRoot>
        <AppProviders>
          <ShellRuntimeProviders>
            <BirdCoderAuthGate>
              <Suspense fallback={<AppRootLoadingFallback />}>
                <LazyBirdcoderApp />
              </Suspense>
            </BirdCoderAuthGate>
          </ShellRuntimeProviders>
        </AppProviders>
      </SdkworkSessionAuthBrowserRoot>
    </MemoryRouter>
  );
}
