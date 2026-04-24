import { Suspense, lazy } from 'react';
import type {
  RunConfigurationDialogProps,
  RunTaskDialogProps,
} from './RunConfigurationDialogs';

const DeferredRunConfigurationDialogRuntime = lazy(async () => {
  const module = await import('./RunConfigurationDialogs');
  return { default: module.RunConfigurationDialog };
});

const DeferredRunTaskDialogRuntime = lazy(async () => {
  const module = await import('./RunConfigurationDialogs');
  return { default: module.RunTaskDialog };
});

function DeferredDialogLoadingState() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="rounded-xl border border-white/10 bg-[#18181b] px-4 py-3 text-sm text-gray-300 shadow-2xl">
        Loading dialog...
      </div>
    </div>
  );
}

export function DeferredRunConfigurationDialog(
  props: RunConfigurationDialogProps,
) {
  if (!props.open) {
    return null;
  }

  return (
    <Suspense fallback={<DeferredDialogLoadingState />}>
      <DeferredRunConfigurationDialogRuntime {...props} />
    </Suspense>
  );
}

export function DeferredRunTaskDialog(props: RunTaskDialogProps) {
  if (!props.open) {
    return null;
  }

  return (
    <Suspense fallback={<DeferredDialogLoadingState />}>
      <DeferredRunTaskDialogRuntime {...props} />
    </Suspense>
  );
}
