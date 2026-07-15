import type { ComponentProps, RefObject } from 'react';
import {
  DeferredUniversalChat,
  ProjectGitOverviewDrawer,
  type UniversalChatProps,
} from '@sdkwork/birdcoder-pc-ui';
import { ResizeHandle } from '@sdkwork/birdcoder-pc-ui-shell';
import { DeferredProjectExplorer } from '../components/DeferredProjectExplorer';
import type { ProjectExplorerProps } from '../components/ProjectExplorer';
import { DeferredTopBar } from '../components/DeferredTopBar';
import type { TopBarProps } from '../components/TopBar';
import { CodeEditorWorkspacePanel } from './CodeEditorWorkspacePanel';
import { DeferredCodeMobileProgrammingPanel } from './DeferredCodeMobileProgrammingPanel';
import { DeferredCodePageDialogs } from './DeferredCodePageDialogs';
import { DeferredCodeTerminalIntegrationPanel } from './DeferredCodeTerminalIntegrationPanel';
import { DeferredCodeWorkspaceOverlays } from './DeferredCodeWorkspaceOverlays';
import type { CodeTerminalIntegrationPanelProps } from './CodeTerminalIntegrationPanel';
import type { CodeMobileProgrammingPanelProps } from './CodeMobileProgrammingPanel';
import type { CodePageDialogsProps } from './CodePageDialogs';
import type { CodeWorkspaceOverlaysProps } from './CodeWorkspaceOverlays';
import { memo } from 'react';

interface CodePageSurfaceProps {
  activeTab: 'ai' | 'editor' | 'mobile';
  dialogProps: CodePageDialogsProps;
  editorWorkspaceHostRef: RefObject<HTMLDivElement | null>;
  gitOverviewDrawerProps: ComponentProps<typeof ProjectGitOverviewDrawer>;
  isSidebarVisible: boolean;
  mainChatProps: UniversalChatProps;
  mobileProgrammingProps: Omit<CodeMobileProgrammingPanelProps, 'isActive'>;
  onSidebarResize: (delta: number) => void;
  overlayProps: CodeWorkspaceOverlaysProps;
  projectExplorerProps: ProjectExplorerProps;
  terminalProps: CodeTerminalIntegrationPanelProps;
  topBarProps: TopBarProps;
  workspaceProps: Omit<ComponentProps<typeof CodeEditorWorkspacePanel>, 'isActive'>;
}

interface CodePageMainChatPanelProps {
  chatProps: UniversalChatProps;
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
      <DeferredUniversalChat {...chatProps} isActive={isActive} />
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
    <div className="birdcoder-workbench-shell flex h-full w-full bg-[#0e0e11] text-gray-100 font-sans selection:bg-white/10 selection:text-white">
      {isSidebarVisible && (
        <>
          <DeferredProjectExplorer {...projectExplorerProps} />
          <ResizeHandle direction="horizontal" onResize={onSidebarResize} />
        </>
      )}

      <div className="flex-1 flex flex-col relative bg-[#0e0e11] overflow-hidden">
        <DeferredCodeWorkspaceOverlays {...overlayProps} />
        <DeferredCodePageDialogs {...dialogProps} />
        <DeferredTopBar {...topBarProps} />

        <div ref={editorWorkspaceHostRef} className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
          <CodePageMainChatPanel chatProps={mainChatProps} isActive={activeTab === 'ai'} />
          <CodeEditorWorkspacePanel {...workspaceProps} isActive={activeTab === 'editor'} />
          <DeferredCodeMobileProgrammingPanel
            {...mobileProgrammingProps}
            isActive={activeTab === 'mobile'}
          />
          <ProjectGitOverviewDrawer {...gitOverviewDrawerProps} />
        </div>

        <DeferredCodeTerminalIntegrationPanel {...terminalProps} />
      </div>
    </div>
  );
}, areCodePageSurfacePropsEqual);

CodePageSurface.displayName = 'CodePageSurface';

