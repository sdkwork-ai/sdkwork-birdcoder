import { lazy, Suspense } from 'react';
import type { CodeWorkspaceOverlaysProps } from './CodeWorkspaceOverlays';

const LazyCodeWorkspaceOverlays = lazy(async () => {
  const module = await import('./CodeWorkspaceOverlays');
  return { default: module.CodeWorkspaceOverlays };
});

export function DeferredCodeWorkspaceOverlays(props: CodeWorkspaceOverlaysProps) {
  const isVisible =
    props.isFindVisible ||
    props.isQuickOpenVisible ||
    props.mountRecoveryState.status === 'recovering' ||
    props.mountRecoveryState.status === 'failed';

  if (!isVisible) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <LazyCodeWorkspaceOverlays {...props} />
    </Suspense>
  );
}
