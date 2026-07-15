import { Suspense, lazy } from 'react';
import type { ProjectExplorerProps } from './ProjectExplorer';

const Runtime = lazy(async () => {
  const module = await import('./ProjectExplorer');
  return { default: module.ProjectExplorer };
});

export function DeferredProjectExplorer(props: ProjectExplorerProps) {
  return (
    <Suspense fallback={<div className="birdcoder-workbench-sidebar h-full w-[280px] shrink-0" aria-hidden="true" />}>
      <Runtime {...props} />
    </Suspense>
  );
}
