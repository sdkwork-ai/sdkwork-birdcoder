import { type TerminalCommandRequest } from '@sdkwork/birdcoder-commons/workbench';
import { ResizeHandle } from '@sdkwork/birdcoder-ui';
import React, { Suspense, lazy, memo } from 'react';

const TerminalPage = lazy(async () => {
  const module = await import('@sdkwork/birdcoder-terminal');
  return { default: module.TerminalPage };
});

function TerminalPanelLoader() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#18181b]">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
    </div>
  );
}

interface CodeTerminalIntegrationPanelProps {
  isOpen: boolean;
  height: number;
  terminalRequest?: TerminalCommandRequest;
  workspaceId?: string;
  projectId?: string;
  onResize: (delta: number) => void;
}

function areCodeTerminalRequestsEqual(
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

function areCodeTerminalIntegrationPanelPropsEqual(
  left: CodeTerminalIntegrationPanelProps,
  right: CodeTerminalIntegrationPanelProps,
): boolean {
  return (
    left.isOpen === right.isOpen &&
    left.height === right.height &&
    left.workspaceId === right.workspaceId &&
    left.projectId === right.projectId &&
    areCodeTerminalRequestsEqual(left.terminalRequest, right.terminalRequest)
  );
}

export const CodeTerminalIntegrationPanel = memo(function CodeTerminalIntegrationPanel({
  isOpen,
  height,
  terminalRequest,
  workspaceId,
  projectId,
  onResize,
}: CodeTerminalIntegrationPanelProps) {
  return (
    <>
      {isOpen && <ResizeHandle direction="vertical" onResize={onResize} />}
      <div
        className={`border-white/10 shrink-0 flex flex-col bg-[#18181b] transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'opacity-100 border-t' : 'h-0 opacity-0 border-t-0'}`}
        style={isOpen ? { height } : undefined}
      >
        {isOpen ? (
          <Suspense fallback={<TerminalPanelLoader />}>
            <TerminalPage
              terminalRequest={terminalRequest}
              workspaceId={workspaceId}
              projectId={projectId}
            />
          </Suspense>
        ) : null}
      </div>
    </>
  );
}, areCodeTerminalIntegrationPanelPropsEqual);

CodeTerminalIntegrationPanel.displayName = 'CodeTerminalIntegrationPanel';
