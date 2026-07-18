import {
  areTerminalCommandRequestsEqual,
  type TerminalCommandRequest,
} from '@sdkwork/birdcoder-pc-workbench/terminal/runtime';
import { useBirdcoderTerminalLaunchPlanResolver } from '@sdkwork/birdcoder-pc-workbench/terminal/useBirdcoderTerminalLaunchPlanResolver';
import { useToast } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import { BirdcoderTerminalApp } from '@sdkwork/birdcoder-pc-workbench/terminal/BirdcoderTerminalApp';
import { ResizeHandle } from '@sdkwork/birdcoder-pc-ui-shell';
import { X } from 'lucide-react';
import { memo, useCallback } from 'react';

export interface CodeTerminalIntegrationPanelProps {
  isOpen: boolean;
  height: number;
  terminalRequest?: TerminalCommandRequest;
  workspaceId?: string;
  projectId?: string;
  onResize: (delta: number) => void;
  onClose: () => void;
}

function areCodeTerminalIntegrationPanelPropsEqual(
  left: CodeTerminalIntegrationPanelProps,
  right: CodeTerminalIntegrationPanelProps,
): boolean {
  return (
    left.isOpen === right.isOpen &&
    left.height === right.height &&
    left.workspaceId === right.workspaceId &&
    left.projectId === right.projectId &&
    left.onClose === right.onClose &&
    areTerminalCommandRequestsEqual(left.terminalRequest, right.terminalRequest)
  );
}

export const CodeTerminalIntegrationPanel = memo(function CodeTerminalIntegrationPanel({
  isOpen,
  height,
  terminalRequest,
  workspaceId,
  projectId,
  onResize,
  onClose,
}: CodeTerminalIntegrationPanelProps) {
  const { addToast } = useToast();
  const handleLaunchBlocked = useCallback(
    (message: string) => addToast(message, 'error'),
    [addToast],
  );
  const resolveTerminalLaunchPlan = useBirdcoderTerminalLaunchPlanResolver(
    workspaceId,
    projectId,
    handleLaunchBlocked,
  );

  return (
    <>
      {isOpen ? <ResizeHandle direction="vertical" onResize={onResize} /> : null}
      <div
        className={`border-white/10 shrink-0 flex flex-col bg-[#18181b] transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'opacity-100 border-t' : 'h-0 opacity-0 border-t-0'}`}
        style={isOpen ? { height } : undefined}
      >
        {isOpen ? (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-[#121214] px-3 py-2">
              <div className="min-w-0">
                <div className="inline-flex max-w-full items-center rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-gray-200">
                  <span className="truncate">Terminal</span>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close terminal"
                onClick={onClose}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <BirdcoderTerminalApp
                launchRequest={terminalRequest}
                launchRequestKey={terminalRequest?.timestamp ?? null}
                resolveLaunchPlan={resolveTerminalLaunchPlan}
                showWindowControls={false}
                workspaceId={workspaceId}
                projectId={projectId}
              />
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}, areCodeTerminalIntegrationPanelPropsEqual);

CodeTerminalIntegrationPanel.displayName = 'CodeTerminalIntegrationPanel';

