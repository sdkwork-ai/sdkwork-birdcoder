import { Suspense, lazy } from 'react';
import type { CodeTerminalIntegrationPanelProps } from './CodeTerminalIntegrationPanel';

const Runtime = lazy(async () => {
  const module = await import('./CodeTerminalIntegrationPanel');
  return { default: module.CodeTerminalIntegrationPanel };
});

export function DeferredCodeTerminalIntegrationPanel(props: CodeTerminalIntegrationPanelProps) {
  if (!props.isOpen) {
    return null;
  }

  return (
    <Suspense fallback={<div className="h-0 shrink-0" aria-hidden="true" />}>
      <Runtime {...props} />
    </Suspense>
  );
}
