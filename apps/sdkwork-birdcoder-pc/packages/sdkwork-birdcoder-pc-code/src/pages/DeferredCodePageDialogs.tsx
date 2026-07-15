import { lazy, Suspense } from 'react';
import type { CodePageDialogsProps } from './CodePageDialogs';

const LazyCodePageDialogs = lazy(async () => {
  const module = await import('./CodePageDialogs');
  return { default: module.CodePageDialogs };
});

export function DeferredCodePageDialogs(props: CodePageDialogsProps) {
  const isVisible =
    props.isRunConfigVisible ||
    props.isDebugConfigVisible ||
    props.isRunTaskVisible ||
    props.deleteConfirmation !== null;

  if (!isVisible) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <LazyCodePageDialogs {...props} />
    </Suspense>
  );
}
