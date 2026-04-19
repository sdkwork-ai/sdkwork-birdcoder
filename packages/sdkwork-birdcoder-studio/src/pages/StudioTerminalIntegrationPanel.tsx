import { memo } from 'react';
import type { TerminalCommandRequest } from '@sdkwork/birdcoder-commons/workbench';
import { ResizeHandle } from '@sdkwork/birdcoder-ui';
import { TerminalPage } from '@sdkwork/birdcoder-terminal';

interface StudioTerminalIntegrationPanelProps {
  isOpen: boolean;
  height: number;
  terminalRequest?: TerminalCommandRequest;
  workspaceId?: string;
  projectId?: string;
  onResize: (delta: number) => void;
}

function areTerminalRequestsEqual(
  left: TerminalCommandRequest | undefined,
  right: TerminalCommandRequest | undefined,
): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return left === right;
  }

  return (
    left.path === right.path &&
    left.command === right.command &&
    left.profileId === right.profileId &&
    left.timestamp === right.timestamp
  );
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
    areTerminalRequestsEqual(left.terminalRequest, right.terminalRequest)
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
  return (
    <>
      {isOpen && <ResizeHandle direction="vertical" onResize={onResize} />}
      <div
        className={`border-white/10 shrink-0 flex flex-col bg-[#18181b] transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'opacity-100 border-t' : 'h-0 opacity-0 border-t-0'}`}
        style={isOpen ? { height } : undefined}
      >
        <TerminalPage
          terminalRequest={terminalRequest}
          workspaceId={workspaceId}
          projectId={projectId}
        />
      </div>
    </>
  );
}, areStudioTerminalIntegrationPanelPropsEqual);

StudioTerminalIntegrationPanel.displayName = 'StudioTerminalIntegrationPanel';
