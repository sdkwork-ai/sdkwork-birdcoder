import { Suspense, lazy } from 'react';
import type { DiffEditorProps } from './DiffEditor';

const DeferredDiffEditorRuntime = lazy(async () => {
  const module = await import('./DiffEditor');
  return { default: module.DiffEditor };
});

function DeferredDiffEditorLoadingState() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-[#0e0e11] text-sm text-gray-400">
      Loading diff editor...
    </div>
  );
}

export function DeferredDiffEditor(props: DiffEditorProps) {
  return (
    <Suspense fallback={<DeferredDiffEditorLoadingState />}>
      <DeferredDiffEditorRuntime {...props} />
    </Suspense>
  );
}
