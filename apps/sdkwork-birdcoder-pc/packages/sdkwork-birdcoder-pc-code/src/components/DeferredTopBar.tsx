import { Suspense, lazy } from 'react';
import type { TopBarProps } from './TopBar';

const Runtime = lazy(async () => {
  const module = await import('./TopBar');
  return { default: module.TopBar };
});

export function DeferredTopBar(props: TopBarProps) {
  return (
    <Suspense fallback={<div className="h-12 shrink-0 bg-[#0e0e11]" aria-hidden="true" />}>
      <Runtime {...props} />
    </Suspense>
  );
}
