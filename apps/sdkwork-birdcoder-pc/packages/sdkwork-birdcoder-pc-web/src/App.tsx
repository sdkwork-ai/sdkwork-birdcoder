import { Suspense, lazy } from 'react';
import {
  BootstrapLoadingScreen,
  type BootstrapGateMessages,
} from '@sdkwork/birdcoder-pc-shell-runtime';

const LazyAppRoot = lazy(async () => {
  const module = await import('./loadAppRoot');
  return module.loadAppRoot();
});

interface AppProps {
  bootstrapMessages: BootstrapGateMessages;
}

function AppShellLoadingFallback({ messages }: { messages: BootstrapGateMessages }) {
  return <BootstrapLoadingScreen messages={messages} />;
}

export default function App({ bootstrapMessages }: AppProps) {
  return (
    <Suspense fallback={<AppShellLoadingFallback messages={bootstrapMessages} />}>
      <LazyAppRoot />
    </Suspense>
  );
}
