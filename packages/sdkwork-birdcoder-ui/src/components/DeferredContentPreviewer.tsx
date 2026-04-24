import { Suspense, lazy } from 'react';
import type { ContentPreviewerProps } from './ContentPreviewer';

const DeferredContentPreviewerRuntime = lazy(async () => {
  const module = await import('./ContentPreviewer');
  return { default: module.ContentPreviewer };
});

function DeferredContentPreviewerLoadingState() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-[#0b0d12] text-sm text-gray-400">
      Rendering preview...
    </div>
  );
}

export function DeferredContentPreviewer(props: ContentPreviewerProps) {
  return (
    <Suspense fallback={<DeferredContentPreviewerLoadingState />}>
      <DeferredContentPreviewerRuntime {...props} />
    </Suspense>
  );
}
