import { Suspense, lazy } from 'react';
import type { ProjectExplorerProps } from './ProjectExplorer';

const Runtime = lazy(async () => {
  const module = await import('./ProjectExplorer');
  return { default: module.ProjectExplorer };
});

export function DeferredProjectExplorer(props: ProjectExplorerProps) {
  return (
    <Suspense fallback={<div className="h-full w-[280px] shrink-0 bg-[#111114]" aria-hidden="true" />}>
      <Runtime {...props} />
    </Suspense>
  );
}
