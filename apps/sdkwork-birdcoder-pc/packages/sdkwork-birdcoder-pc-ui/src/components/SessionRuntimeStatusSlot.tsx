import React from 'react';
import { CircleAlert, Clock3, Loader2, TriangleAlert } from 'lucide-react';

export type SessionRuntimeStatusPresentation =
  | 'attention'
  | 'busy'
  | 'failed'
  | 'idle'
  | 'neutral';

export interface SessionRuntimeStatusLabels {
  awaitingApproval: string;
  awaitingTool: string;
  awaitingUser: string;
  executing: string;
  failed: string;
  initializing: string;
  stale: string;
  unknown: string;
}

export interface SessionRuntimeStatusSlotProps {
  label?: string | null;
  runtimeStatus?: string | null;
}

// Unavailable runtime states (`unknown`, `null`, or `undefined`) carry no reliable
// signal. Keep them completely silent: no label, icon, or reserved icon space.
function isSilentSessionRuntimeStatus(runtimeStatus?: string | null): boolean {
  return runtimeStatus == null || runtimeStatus === 'unknown';
}

export function resolveSessionRuntimeStatusPresentation(
  runtimeStatus?: string | null,
): SessionRuntimeStatusPresentation {
  if (runtimeStatus === 'initializing' || runtimeStatus === 'streaming') {
    return 'busy';
  }
  if (
    runtimeStatus === 'awaiting_approval'
    || runtimeStatus === 'awaiting_tool'
    || runtimeStatus === 'awaiting_user'
  ) {
    return 'attention';
  }
  if (runtimeStatus === 'failed') {
    return 'failed';
  }
  if (runtimeStatus === 'stale' || runtimeStatus === 'unknown') {
    return 'neutral';
  }
  return 'idle';
}

export function resolveSessionRuntimeStatusLabel(
  runtimeStatus: string | null | undefined,
  labels: SessionRuntimeStatusLabels,
): string | null {
  if (isSilentSessionRuntimeStatus(runtimeStatus)) {
    return null;
  }

  switch (runtimeStatus) {
    case 'initializing':
      return labels.initializing;
    case 'streaming':
      return labels.executing;
    case 'awaiting_approval':
      return labels.awaitingApproval;
    case 'awaiting_tool':
      return labels.awaitingTool;
    case 'awaiting_user':
      return labels.awaitingUser;
    case 'failed':
      return labels.failed;
    case 'stale':
      return labels.stale;
    default:
      return null;
  }
}

export const SessionRuntimeStatusSlot = React.memo(function SessionRuntimeStatusSlot({
  label,
  runtimeStatus,
}: SessionRuntimeStatusSlotProps) {
  if (isSilentSessionRuntimeStatus(runtimeStatus)) {
    return null;
  }

  const presentation = resolveSessionRuntimeStatusPresentation(runtimeStatus);
  const isBusy = presentation === 'busy';
  const icon = isBusy
    ? <Loader2 className="h-3 w-3 animate-spin text-emerald-400" aria-hidden="true" />
    : presentation === 'attention'
      ? <CircleAlert className="h-3 w-3 text-amber-300" aria-hidden="true" />
      : presentation === 'failed'
        ? <TriangleAlert className="h-3 w-3 text-red-300" aria-hidden="true" />
        : runtimeStatus === 'stale'
          ? <Clock3 className="h-3 w-3 text-gray-500" aria-hidden="true" />
          : null;

  const accessibilityProps = icon && label
    ? { 'aria-label': label, role: 'img' as const, title: label }
    : { 'aria-hidden': true as const };

  return (
    <span
      {...accessibilityProps}
      className="inline-flex h-4 w-4 flex-none items-center justify-center"
      data-session-runtime-presentation={presentation}
      data-session-runtime-status={runtimeStatus ?? undefined}
      data-session-runtime-status-icon={icon ? presentation : undefined}
    >
      {icon}
    </span>
  );
});

SessionRuntimeStatusSlot.displayName = 'SessionRuntimeStatusSlot';
