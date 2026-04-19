import type { ComponentProps, RefObject } from 'react';
import { ResizeHandle } from '@sdkwork/birdcoder-ui';
import { UniversalChat } from '@sdkwork/birdcoder-ui/chat';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { CodeEditorWorkspacePanel } from './CodeEditorWorkspacePanel';
import { CodePageDialogs } from './CodePageDialogs';
import { CodeTerminalIntegrationPanel } from './CodeTerminalIntegrationPanel';
import { CodeWorkspaceOverlays } from './CodeWorkspaceOverlays';

interface CodePageSurfaceProps {
  activeTab: 'ai' | 'editor';
  dialogProps: ComponentProps<typeof CodePageDialogs>;
  editorWorkspaceHostRef: RefObject<HTMLDivElement | null>;
  isSidebarVisible: boolean;
  mainChatProps: ComponentProps<typeof UniversalChat>;
  onSidebarResize: (delta: number) => void;
  overlayProps: ComponentProps<typeof CodeWorkspaceOverlays>;
  sidebarProps: ComponentProps<typeof Sidebar>;
  terminalProps: ComponentProps<typeof CodeTerminalIntegrationPanel>;
  topBarProps: ComponentProps<typeof TopBar>;
  workspaceProps: ComponentProps<typeof CodeEditorWorkspacePanel>;
}

export function CodePageSurface({
  activeTab,
  dialogProps,
  editorWorkspaceHostRef,
  isSidebarVisible,
  mainChatProps,
  onSidebarResize,
  overlayProps,
  sidebarProps,
  terminalProps,
  topBarProps,
  workspaceProps,
}: CodePageSurfaceProps) {
  return (
    <div className="flex h-full w-full bg-[#0e0e11] text-gray-100 font-sans selection:bg-white/10 selection:text-white">
      {isSidebarVisible && (
        <>
          <Sidebar {...sidebarProps} />
          <ResizeHandle direction="horizontal" onResize={onSidebarResize} />
        </>
      )}

      <div className="flex-1 flex flex-col relative bg-[#0e0e11] shadow-[-4px_0_24px_-4px_rgba(0,0,0,0.5)] overflow-hidden">
        <CodeWorkspaceOverlays {...overlayProps} />
        <CodePageDialogs {...dialogProps} />
        <TopBar {...topBarProps} />

        <div ref={editorWorkspaceHostRef} className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'ai' ? (
            <UniversalChat {...mainChatProps} />
          ) : (
            <CodeEditorWorkspacePanel {...workspaceProps} />
          )}
        </div>

        <CodeTerminalIntegrationPanel {...terminalProps} />
      </div>
    </div>
  );
}
