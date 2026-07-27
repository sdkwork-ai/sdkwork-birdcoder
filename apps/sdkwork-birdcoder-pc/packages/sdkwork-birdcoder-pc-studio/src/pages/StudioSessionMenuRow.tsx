import type { AgentSessionView } from '@sdkwork/birdcoder-pc-contracts-commons';
import { formatAgentSessionActivityDisplayTime } from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  SessionProviderBadge,
  SessionRuntimeStatusSlot,
  resolveSessionRuntimeStatusLabel,
  resolveSessionRuntimeStatusPresentation,
  type SessionRuntimeStatusLabels,
} from '@sdkwork/birdcoder-pc-ui';
import { Check } from 'lucide-react';
import { memo } from 'react';

export interface StudioSessionMenuRowProps {
  isSelected: boolean;
  onSelectAgentSession: (projectId: string, agentSessionId: string) => void;
  projectId: string;
  relativeTimeNow: number;
  runtimeStatusLabels: SessionRuntimeStatusLabels;
  session: AgentSessionView;
}

export const StudioSessionMenuRow = memo(function StudioSessionMenuRow({
  isSelected,
  onSelectAgentSession,
  projectId,
  relativeTimeNow,
  runtimeStatusLabels,
  session,
}: StudioSessionMenuRowProps) {
  const runtimeStatusLabel = resolveSessionRuntimeStatusLabel(
    session.runtimeStatus,
    runtimeStatusLabels,
  );
  const runtimeStatusPresentation = resolveSessionRuntimeStatusPresentation(session.runtimeStatus);

  return (
    <button
      onClick={() => onSelectAgentSession(projectId, session.id)}
      data-agent-session-id={session.id}
      data-session-project-id={projectId}
      data-session-selected={isSelected ? 'true' : undefined}
      className={`group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm transition-all ${
        isSelected
          ? 'bg-blue-500/10 text-blue-400'
          : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
      }`}
      style={{ contain: 'layout paint style', containIntrinsicSize: '48px' }}
    >
      <SessionProviderBadge
        agentId={session.agentId}
        engineId={session.engineId}
        providerId={session.providerId}
      />
      <div className="flex min-w-0 flex-1 items-center truncate">
        <span className="max-w-full truncate text-left font-medium">{session.title}</span>
      </div>
      {isSelected ? <Check size={14} className="shrink-0 text-blue-400" /> : null}
      <span
        className="ml-auto inline-flex min-w-0 max-w-[45%] shrink items-center justify-end gap-1 text-right"
        data-session-trailing-metadata="true"
      >
          <span
            className={`min-w-0 truncate text-[10px] ${
              runtimeStatusLabel
                ? runtimeStatusPresentation === 'failed'
                  ? 'text-red-300'
                  : runtimeStatusPresentation === 'busy'
                    ? 'text-emerald-300'
                    : runtimeStatusPresentation === 'attention'
                      ? 'text-amber-300'
                      : 'text-gray-500'
                : isSelected
                  ? 'text-blue-400/70'
                  : 'text-gray-600 group-hover:text-gray-500'
            }`}
          >
            {runtimeStatusLabel ?? formatAgentSessionActivityDisplayTime(session, relativeTimeNow)}
          </span>
        <SessionRuntimeStatusSlot
          label={runtimeStatusLabel}
          runtimeStatus={session.runtimeStatus}
        />
      </span>
    </button>
  );
});

StudioSessionMenuRow.displayName = 'StudioSessionMenuRow';
