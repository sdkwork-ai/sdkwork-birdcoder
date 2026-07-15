import { lazy, Suspense } from 'react';
import type { CodeMobileProgrammingPanelProps } from './CodeMobileProgrammingPanel';

const LazyCodeMobileProgrammingPanel = lazy(async () => {
  const module = await import('./CodeMobileProgrammingPanel');
  return { default: module.CodeMobileProgrammingPanel };
});

export function DeferredCodeMobileProgrammingPanel(
  props: CodeMobileProgrammingPanelProps,
) {
  if (!props.isActive) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <LazyCodeMobileProgrammingPanel {...props} />
    </Suspense>
  );
}
