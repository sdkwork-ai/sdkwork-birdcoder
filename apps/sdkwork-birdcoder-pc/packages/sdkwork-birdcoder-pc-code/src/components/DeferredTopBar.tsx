import { Suspense, lazy } from 'react';
import type { TopBarProps } from './TopBar';

const Runtime = lazy(async () => {
  const module = await import('./TopBar');
  return { default: module.TopBar };
});

export function DeferredTopBar(props: TopBarProps) {
  return (
    <Suspense fallback={<div className="birdcoder-workbench-header h-12 shrink-0" aria-hidden="true" />}>
      <Runtime {...props} />
    </Suspense>
  );
}
