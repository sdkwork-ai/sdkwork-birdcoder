import { Suspense, lazy, useMemo, type ReactNode } from 'react';
import { useAuth } from '@sdkwork/birdcoder-pc-commons';
import { shouldBootIntoAuthSurface } from './authSurface.ts';
import { AuthShell } from './AuthShell.tsx';
import { loadAuthPage, type LoadBirdCoderAuthPageOptions } from './pageLoaders.ts';

interface AuthGateProps {
  children: ReactNode;
  getRuntime: LoadBirdCoderAuthPageOptions['getRuntime'];
}

function AuthGateLoadingState() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0e0e11] px-6 text-white">
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#18181b] px-4 py-3 shadow-lg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/80" />
        <div className="text-sm text-gray-300">Validating SDKWork session</div>
      </div>
    </div>
  );
}

export function AuthGate({ children, getRuntime }: AuthGateProps) {
  const { isLoading, user } = useAuth();
  const LazyAuthPage = useMemo(
    () => lazy(() => loadAuthPage({ getRuntime })),
    [getRuntime],
  );

  if (isLoading) {
    return <AuthGateLoadingState />;
  }

  if (!user && shouldBootIntoAuthSurface()) {
    return (
      <AuthShell>
        <Suspense fallback={<AuthGateLoadingState />}>
          <LazyAuthPage />
        </Suspense>
      </AuthShell>
    );
  }

  return <>{children}</>;
}
