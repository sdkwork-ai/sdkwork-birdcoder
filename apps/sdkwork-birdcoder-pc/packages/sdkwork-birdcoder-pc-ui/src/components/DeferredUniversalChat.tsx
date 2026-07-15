import { Suspense, lazy } from 'react';
import type { UniversalChatProps } from './UniversalChat';

const DeferredUniversalChatRuntime = lazy(async () => {
  const module = await import('./UniversalChat');
  return { default: module.UniversalChat };
});

export function DeferredUniversalChat(props: UniversalChatProps) {
  return (
    <Suspense fallback={<div className="h-full min-h-0 bg-[#0e0e11]" aria-hidden="true" />}>
      <DeferredUniversalChatRuntime {...props} />
    </Suspense>
  );
}
