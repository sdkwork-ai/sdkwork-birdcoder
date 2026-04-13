import type { TerminalCommandRequest } from '@sdkwork/birdcoder-commons';
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

export function StudioTerminalIntegrationPanel({
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
}
