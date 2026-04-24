import type { ComponentProps, RefObject } from 'react';
import { ProjectGitOverviewDrawer, UniversalChat } from '@sdkwork/birdcoder-ui';
import { ResizeHandle } from '@sdkwork/birdcoder-ui-shell';
import { ProjectExplorer, type ProjectExplorerProps } from '../components/ProjectExplorer';
import { TopBar } from '../components/TopBar';
import { CodeEditorWorkspacePanel } from './CodeEditorWorkspacePanel';
import { CodeMobileProgrammingPanel } from './CodeMobileProgrammingPanel';
import { CodePageDialogs } from './CodePageDialogs';
import { CodeTerminalIntegrationPanel } from './CodeTerminalIntegrationPanel';
import { CodeWorkspaceOverlays } from './CodeWorkspaceOverlays';
import { memo } from 'react';

interface CodePageSurfaceProps {
  activeTab: 'ai' | 'editor' | 'mobile';
  dialogProps: ComponentProps<typeof CodePageDialogs>;
  editorWorkspaceHostRef: RefObject<HTMLDivElement | null>;
  gitOverviewDrawerProps: ComponentProps<typeof ProjectGitOverviewDrawer>;
  isSidebarVisible: boolean;
  mainChatProps: ComponentProps<typeof UniversalChat>;
  mobileProgrammingProps: Omit<ComponentProps<typeof CodeMobileProgrammingPanel>, 'isActive'>;
  onSidebarResize: (delta: number) => void;
  overlayProps: ComponentProps<typeof CodeWorkspaceOverlays>;
  projectExplorerProps: ProjectExplorerProps;
  terminalProps: ComponentProps<typeof CodeTerminalIntegrationPanel>;
  topBarProps: ComponentProps<typeof TopBar>;
  workspaceProps: Omit<ComponentProps<typeof CodeEditorWorkspacePanel>, 'isActive'>;
}

interface CodePageMainChatPanelProps {
  chatProps: ComponentProps<typeof UniversalChat>;
  isActive: boolean;
}

function areCodePageSurfacePropsEqual(
  left: CodePageSurfaceProps,
  right: CodePageSurfaceProps,
) {
  return (
    left.activeTab === right.activeTab &&
    left.dialogProps === right.dialogProps &&
    left.editorWorkspaceHostRef === right.editorWorkspaceHostRef &&
    left.gitOverviewDrawerProps === right.gitOverviewDrawerProps &&
    left.isSidebarVisible === right.isSidebarVisible &&
    left.mainChatProps === right.mainChatProps &&
    left.mobileProgrammingProps === right.mobileProgrammingProps &&
    left.onSidebarResize === right.onSidebarResize &&
    left.overlayProps === right.overlayProps &&
    left.projectExplorerProps === right.projectExplorerProps &&
    left.terminalProps === right.terminalProps &&
    left.topBarProps === right.topBarProps &&
    left.workspaceProps === right.workspaceProps
  );
}

const CodePageMainChatPanel = memo(function CodePageMainChatPanel({
  chatProps,
  isActive,
}: CodePageMainChatPanelProps) {
  return (
    <div className={isActive ? 'flex flex-1 min-h-0 w-full overflow-hidden' : 'hidden'}>
      <UniversalChat {...chatProps} isActive={isActive} />
    </div>
  );
}, (left, right) => {
  if (left.isActive !== right.isActive) {
    return false;
  }

  if (!left.isActive && !right.isActive) {
    return true;
  }

  return left.chatProps === right.chatProps;
});

CodePageMainChatPanel.displayName = 'CodePageMainChatPanel';

export const CodePageSurface = memo(function CodePageSurface({
  activeTab,
  dialogProps,
  editorWorkspaceHostRef,
  gitOverviewDrawerProps,
  isSidebarVisible,
  mainChatProps,
  mobileProgrammingProps,
  onSidebarResize,
  overlayProps,
  projectExplorerProps,
  terminalProps,
  topBarProps,
  workspaceProps,
}: CodePageSurfaceProps) {
  return (
    <div className="flex h-full w-full bg-[#0e0e11] text-gray-100 font-sans selection:bg-white/10 selection:text-white">
      {isSidebarVisible && (
        <>
          <ProjectExplorer {...projectExplorerProps} />
          <ResizeHandle direction="horizontal" onResize={onSidebarResize} />
        </>
      )}

      <div className="flex-1 flex flex-col relative bg-[#0e0e11] shadow-[-4px_0_24px_-4px_rgba(0,0,0,0.5)] overflow-hidden">
        <CodeWorkspaceOverlays {...overlayProps} />
        <CodePageDialogs {...dialogProps} />
        <TopBar {...topBarProps} />

        <div ref={editorWorkspaceHostRef} className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
          <CodePageMainChatPanel chatProps={mainChatProps} isActive={activeTab === 'ai'} />
          <CodeEditorWorkspacePanel {...workspaceProps} isActive={activeTab === 'editor'} />
          <CodeMobileProgrammingPanel {...mobileProgrammingProps} isActive={activeTab === 'mobile'} />
          <ProjectGitOverviewDrawer {...gitOverviewDrawerProps} />
        </div>

        <CodeTerminalIntegrationPanel {...terminalProps} />
      </div>
    </div>
  );
}, areCodePageSurfacePropsEqual);

CodePageSurface.displayName = 'CodePageSurface';
