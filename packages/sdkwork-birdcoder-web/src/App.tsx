import { Suspense, lazy } from 'react';

const LazyAppRoot = lazy(async () => {
  const module = await import('./loadAppRoot');
  return module.loadAppRoot();
});

function AppShellLoadingFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0e0e11] px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#18181b] p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-white/80" />
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">Loading SDKWork BirdCoder</div>
            <div className="mt-1 text-sm text-gray-400">
              Resolving the application shell and workspace surfaces.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<AppShellLoadingFallback />}>
      <LazyAppRoot />
    </Suspense>
  );
}
