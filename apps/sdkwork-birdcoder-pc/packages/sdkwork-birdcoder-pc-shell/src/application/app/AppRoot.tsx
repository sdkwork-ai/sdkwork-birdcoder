import { Suspense, lazy } from 'react';
import { AppProviders } from '../providers/AppProviders';

const LazyBirdcoderApp = lazy(async () => {
  const module = await import('./loadBirdcoderApp');
  return module.loadBirdcoderApp();
});

function AppRootLoadingFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0e0e11] text-white">
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#18181b] px-4 py-3 shadow-lg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/80" />
        <div className="text-sm text-gray-300">Loading workspace shell</div>
      </div>
    </div>
  );
}

export default function AppRoot() {
  return (
    <AppProviders>
      <Suspense fallback={<AppRootLoadingFallback />}>
        <LazyBirdcoderApp />
      </Suspense>
    </AppProviders>
  );
}
