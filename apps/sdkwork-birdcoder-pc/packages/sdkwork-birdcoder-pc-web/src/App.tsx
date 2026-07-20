import { Suspense, lazy } from 'react';
import { StartupScreen } from '@sdkwork/birdcoder-pc-ui-shell';
import type { BootstrapGateMessages } from '@sdkwork/birdcoder-pc-shell-runtime';

const LazyAppRoot = lazy(async () => {
  const module = await import('./loadAppRoot');
  return module.loadAppRoot();
});

interface AppProps {
  bootstrapMessages: BootstrapGateMessages;
}

function AppShellLoadingFallback({ messages }: { messages: BootstrapGateMessages }) {
  return (
    <StartupScreen
      description={messages.bootingDescription}
      progress={64}
      stage="runtime"
      stageLabels={{
        runtime: messages.runtimeStage,
        session: messages.sessionStage,
        workspace: messages.workspaceStage,
      }}
      startupFailedLabel={messages.startupFailed}
      title={messages.startingTitle}
    />
  );
}

export default function App({ bootstrapMessages }: AppProps) {
  return (
    <Suspense fallback={<AppShellLoadingFallback messages={bootstrapMessages} />}>
      <LazyAppRoot />
    </Suspense>
  );
}
