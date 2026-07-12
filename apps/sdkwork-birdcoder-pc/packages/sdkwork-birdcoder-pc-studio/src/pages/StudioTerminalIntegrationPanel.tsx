import { memo, useCallback } from 'react';
import {
  areTerminalCommandRequestsEqual,
  useBirdcoderTerminalLaunchPlanResolver,
  useToast,
  type TerminalCommandRequest,
} from '@sdkwork/birdcoder-pc-commons';
import { ResizeHandle } from '@sdkwork/birdcoder-pc-ui-shell';
import { DesktopTerminalApp } from '@sdkwork/terminal-pc-desktop';

interface StudioTerminalIntegrationPanelProps {
  isOpen: boolean;
  height: number;
  terminalRequest?: TerminalCommandRequest;
  workspaceId?: string;
  projectId?: string;
  onResize: (delta: number) => void;
}

function areStudioTerminalIntegrationPanelPropsEqual(
  left: StudioTerminalIntegrationPanelProps,
  right: StudioTerminalIntegrationPanelProps,
): boolean {
  return (
    left.isOpen === right.isOpen &&
    left.height === right.height &&
    left.workspaceId === right.workspaceId &&
    left.projectId === right.projectId &&
    areTerminalCommandRequestsEqual(left.terminalRequest, right.terminalRequest)
  );
}

export const StudioTerminalIntegrationPanel = memo(function StudioTerminalIntegrationPanel({
  isOpen,
  height,
  terminalRequest,
  workspaceId,
  projectId,
  onResize,
}: StudioTerminalIntegrationPanelProps) {
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
          <DesktopTerminalApp
            launchRequest={terminalRequest}
            launchRequestKey={terminalRequest?.timestamp ?? null}
            resolveLaunchPlan={resolveTerminalLaunchPlan}
            showWindowControls={false}
          />
        ) : null}
      </div>
    </>
  );
}, areStudioTerminalIntegrationPanelPropsEqual);

StudioTerminalIntegrationPanel.displayName = 'StudioTerminalIntegrationPanel';

