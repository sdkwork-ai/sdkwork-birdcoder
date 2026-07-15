import { Suspense, lazy } from 'react';
import type { FileExplorerProps } from './FileExplorer';

const DeferredFileExplorerRuntime = lazy(async () => {
  const module = await import('./FileExplorer');
  return { default: module.FileExplorer };
});

export function DeferredFileExplorer(props: FileExplorerProps) {
  return (
    <Suspense
      fallback={(
        <div
          className="h-full shrink-0 bg-[#111114]"
          style={{ width: props.width ?? 260 }}
          aria-hidden="true"
        />
      )}
    >
      <DeferredFileExplorerRuntime {...props} />
    </Suspense>
  );
}
