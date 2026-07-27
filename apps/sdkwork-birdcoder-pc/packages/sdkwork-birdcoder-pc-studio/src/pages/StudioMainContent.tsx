import type { ComponentProps } from 'react';
import {
  ProjectGitOverviewDrawer,
  WorkspaceDetailSurface,
  type WorkspaceDetailView,
} from '@sdkwork/birdcoder-pc-ui';
import { StudioPreviewPanel } from '../preview/StudioPreviewPanel';
import { StudioStageHeader } from '../preview/StudioStageHeader';
import { StudioSimulatorPanel } from '../simulator/StudioSimulatorPanel';
import { StudioCodeWorkspacePanel } from './StudioCodeWorkspacePanel';
import { StudioTerminalIntegrationPanel } from './StudioTerminalIntegrationPanel';
import { StudioWorkspaceOverlays } from './StudioWorkspaceOverlays';

type StudioCodeWorkspacePanelProps = ComponentProps<typeof StudioCodeWorkspacePanel>;
type StudioGitOverviewDrawerProps = ComponentProps<typeof ProjectGitOverviewDrawer>;
type StudioStageHeaderProps = ComponentProps<typeof StudioStageHeader>;
type StudioTerminalIntegrationPanelProps =
  ComponentProps<typeof StudioTerminalIntegrationPanel>;
type StudioWorkspaceOverlaysProps = ComponentProps<typeof StudioWorkspaceOverlays>;

export interface StudioMainContentModel {
  activeTab: StudioStageHeaderProps['activeTab'];
  codeExplorerWidth: StudioCodeWorkspacePanelProps['explorerWidth'];
  currentProjectId: string;
  fileContent: StudioCodeWorkspacePanelProps['fileContent'];
  files: StudioWorkspaceOverlaysProps['files'];
  projectRootPath: StudioCodeWorkspacePanelProps['projectRootPath'];
  fileTreeLoadError: StudioCodeWorkspacePanelProps['fileTreeLoadError'];
  getLanguageFromPath: StudioCodeWorkspacePanelProps['getLanguageFromPath'];
  handleActiveTabChange: StudioStageHeaderProps['onTabChange'];
  handleAnalyzeCode: StudioStageHeaderProps['onAnalyzeCode'];
  handleCloseProjectGitOverviewDrawer: StudioGitOverviewDrawerProps['onClose'];
  handleLaunchSimulatorFromHeader: StudioStageHeaderProps['onLaunchSimulator'];
  handleOpenPreviewInNewTab: StudioStageHeaderProps['onOpenPreviewInNewTab'];
  handlePreviewUrlChange: (url: string) => void;
  handlePreviewAppPlatformChange: StudioStageHeaderProps['onPreviewAppPlatformChange'];
  handlePreviewLandscapeToggle: StudioStageHeaderProps['onPreviewLandscapeToggle'];
  handleRefreshPreview: StudioStageHeaderProps['onRefreshPreview'];
  handleStudioCloseFind: StudioWorkspaceOverlaysProps['onCloseFind'];
  handleStudioCloseQuickOpen: StudioWorkspaceOverlaysProps['onCloseQuickOpen'];
  handleStudioCodeExplorerResize: StudioCodeWorkspacePanelProps['onExplorerResize'];
  handleStudioCodePanelSelectFile: StudioCodeWorkspacePanelProps['onSelectFile'];
  handleStudioNotifyNoResults: StudioWorkspaceOverlaysProps['onNotifyNoResults'];
  handleStudioOverlaySelectFile: StudioWorkspaceOverlaysProps['onSelectFile'];
  handleStudioReimportProjectFolder: StudioWorkspaceOverlaysProps['onReimportProjectFolder'];
  handleStudioCloseViewingDiff: StudioCodeWorkspacePanelProps['onCloseDiff'];
  handleStudioRetryMountRecovery: StudioWorkspaceOverlaysProps['onRetryMountRecovery'];
  handleStudioTerminalResize: StudioTerminalIntegrationPanelProps['onResize'];
  handleToggleProjectGitOverviewDrawer: StudioStageHeaderProps['onToggleProjectGitOverviewDrawer'];
  handleToggleStudioTerminal: StudioStageHeaderProps['onToggleTerminal'];
  isFindVisible: StudioWorkspaceOverlaysProps['isFindVisible'];
  isFileTreeLoading: StudioCodeWorkspacePanelProps['isFileTreeLoading'];
  isMountRecoveryActionPending: StudioWorkspaceOverlaysProps['isMountRecoveryActionPending'];
  isProjectGitOverviewDrawerOpen: StudioStageHeaderProps['isProjectGitOverviewDrawerOpen'];
  isQuickOpenVisible: StudioWorkspaceOverlaysProps['isQuickOpenVisible'];
  isSearchingFiles: StudioWorkspaceOverlaysProps['isSearchingFiles'];
  isSimulatorTabActive: boolean;
  isTerminalOpen: StudioStageHeaderProps['isTerminalOpen'];
  isVisible: boolean;
  loadingDirectoryPaths: StudioCodeWorkspacePanelProps['loadingDirectoryPaths'];
  memoizedDevicePreviewProps: ComponentProps<typeof StudioPreviewPanel>['devicePreviewProps'];
  mountRecoveryState: StudioWorkspaceOverlaysProps['mountRecoveryState'];
  openFiles: StudioCodeWorkspacePanelProps['openFiles'];
  previewAppPlatform: StudioStageHeaderProps['previewAppPlatform'];
  previewDeviceModel: StudioStageHeaderProps['previewDeviceModel'];
  previewIsLandscape: StudioStageHeaderProps['previewIsLandscape'];
  previewMpPlatform: StudioStageHeaderProps['previewMpPlatform'];
  previewPlatform: StudioStageHeaderProps['previewPlatform'];
  previewUrl: StudioStageHeaderProps['previewUrl'];
  previewWebDevice: StudioStageHeaderProps['previewWebDevice'];
  projectGitOverviewState: StudioStageHeaderProps['projectGitOverviewState'];
  searchFiles: StudioWorkspaceOverlaysProps['searchFiles'];
  selectedFile: StudioCodeWorkspacePanelProps['selectedFile'];
  setPreviewDeviceModel: StudioStageHeaderProps['onPreviewDeviceModelChange'];
  setPreviewMpPlatform: StudioStageHeaderProps['onPreviewMpPlatformChange'];
  setPreviewPlatform: StudioStageHeaderProps['onPreviewPlatformChange'];
  setPreviewWebDevice: StudioStageHeaderProps['onPreviewWebDeviceChange'];
  terminalHeight: StudioTerminalIntegrationPanelProps['height'];
  terminalRequest: StudioTerminalIntegrationPanelProps['terminalRequest'];
  terminalRuntimeLocationId: StudioTerminalIntegrationPanelProps['runtimeLocationId'];
  updateFileDraft: StudioCodeWorkspacePanelProps['onFileDraftChange'];
  viewingDiff: StudioCodeWorkspacePanelProps['viewingDiff'];
  closeFile: StudioCodeWorkspacePanelProps['onCloseFile'];
  createFile: StudioCodeWorkspacePanelProps['onCreateFile'];
  createFolder: StudioCodeWorkspacePanelProps['onCreateFolder'];
  deleteFile: StudioCodeWorkspacePanelProps['onDeleteFile'];
  deleteFolder: StudioCodeWorkspacePanelProps['onDeleteFolder'];
  loadDirectory: StudioCodeWorkspacePanelProps['onExpandDirectory'];
  renameNode: StudioCodeWorkspacePanelProps['onRenameNode'];
  refreshFiles: StudioCodeWorkspacePanelProps['onRetryFileTreeLoad'];
}

interface StudioMainContentProps {
  model: StudioMainContentModel;
}

export function StudioMainContent({ model }: StudioMainContentProps) {
  const {
    activeTab,
    codeExplorerWidth,
    currentProjectId,
    fileContent,
    files,
    projectRootPath,
    fileTreeLoadError,
    getLanguageFromPath,
    handleActiveTabChange,
    handleAnalyzeCode,
    handleCloseProjectGitOverviewDrawer,
    handleLaunchSimulatorFromHeader,
    handleOpenPreviewInNewTab,
    handlePreviewUrlChange,
    handlePreviewAppPlatformChange,
    handlePreviewLandscapeToggle,
    handleRefreshPreview,
    handleStudioCloseFind,
    handleStudioCloseQuickOpen,
    handleStudioCodeExplorerResize,
    handleStudioCodePanelSelectFile,
    handleStudioNotifyNoResults,
    handleStudioOverlaySelectFile,
    handleStudioReimportProjectFolder,
    handleStudioCloseViewingDiff,
    handleStudioRetryMountRecovery,
    handleStudioTerminalResize,
    handleToggleProjectGitOverviewDrawer,
    handleToggleStudioTerminal,
    isFindVisible,
    isFileTreeLoading,
    isMountRecoveryActionPending,
    isProjectGitOverviewDrawerOpen,
    isQuickOpenVisible,
    isSearchingFiles,
    isSimulatorTabActive,
    isTerminalOpen,
    isVisible,
    loadingDirectoryPaths,
    memoizedDevicePreviewProps,
    mountRecoveryState,
    openFiles,
    previewAppPlatform,
    previewDeviceModel,
    previewIsLandscape,
    previewMpPlatform,
    previewPlatform,
    previewUrl,
    previewWebDevice,
    projectGitOverviewState,
    searchFiles,
    selectedFile,
    setPreviewDeviceModel,
    setPreviewMpPlatform,
    setPreviewPlatform,
    setPreviewWebDevice,
    terminalHeight,
    terminalRequest,
    terminalRuntimeLocationId,
    updateFileDraft,
    viewingDiff,
    closeFile,
    createFile,
    createFolder,
    deleteFile,
    deleteFolder,
    loadDirectory,
    renameNode,
    refreshFiles,
  } = model;

  const workspaceDetailViews: WorkspaceDetailView[] = [
    {
      id: 'preview',
      kind: 'browser',
      keepMounted: true,
      content: (
        <StudioPreviewPanel
          devicePreviewProps={memoizedDevicePreviewProps}
          onNavigate={handlePreviewUrlChange}
        />
      ),
    },
    {
      id: 'simulator',
      kind: 'simulator',
      content: <StudioSimulatorPanel devicePreviewProps={memoizedDevicePreviewProps} />,
    },
    {
      id: 'code',
      kind: viewingDiff ? 'review' : 'file-editor',
      keepMounted: true,
      content: (
        <StudioCodeWorkspacePanel
          isActive={isVisible && activeTab === 'code'}
          currentProjectId={currentProjectId || undefined}
          files={files}
          projectRootPath={projectRootPath}
          fileTreeLoadError={fileTreeLoadError}
          isFileTreeLoading={isFileTreeLoading}
          loadingDirectoryPaths={loadingDirectoryPaths}
          openFiles={openFiles}
          explorerWidth={codeExplorerWidth}
          selectedFile={selectedFile}
          viewingDiff={viewingDiff}
          fileContent={fileContent}
          onSelectFile={handleStudioCodePanelSelectFile}
          onExpandDirectory={loadDirectory}
          onCloseFile={closeFile}
          onCreateFile={createFile}
          onCreateFolder={createFolder}
          onDeleteFile={deleteFile}
          onDeleteFolder={deleteFolder}
          onRenameNode={renameNode}
          onRetryFileTreeLoad={refreshFiles}
          onCloseDiff={handleStudioCloseViewingDiff}
          onFileDraftChange={updateFileDraft}
          onExplorerResize={handleStudioCodeExplorerResize}
          getLanguageFromPath={getLanguageFromPath}
        />
      ),
    },
  ];

  return (
    <div className="flex-1 flex flex-col relative bg-[#0e0e11] overflow-hidden">
      <StudioWorkspaceOverlays
        currentProjectId={currentProjectId || undefined}
        files={files}
        mountRecoveryState={mountRecoveryState}
        isMountRecoveryActionPending={isMountRecoveryActionPending}
        isFindVisible={isFindVisible}
        isSearchingFiles={isSearchingFiles}
        isQuickOpenVisible={isQuickOpenVisible}
        searchFiles={searchFiles}
        onSelectFile={handleStudioOverlaySelectFile}
        onRetryMountRecovery={handleStudioRetryMountRecovery}
        onReimportProjectFolder={handleStudioReimportProjectFolder}
        onCloseFind={handleStudioCloseFind}
        onCloseQuickOpen={handleStudioCloseQuickOpen}
        onNotifyNoResults={handleStudioNotifyNoResults}
      />
      <StudioStageHeader
        activeTab={activeTab}
        isProjectGitOverviewDrawerOpen={isProjectGitOverviewDrawerOpen}
        projectGitOverviewState={projectGitOverviewState}
        projectId={activeTab === 'code' ? currentProjectId || undefined : undefined}
        previewUrl={previewUrl}
        previewPlatform={previewPlatform}
        previewWebDevice={previewWebDevice}
        previewMpPlatform={previewMpPlatform}
        previewAppPlatform={previewAppPlatform}
        previewDeviceModel={previewDeviceModel}
        previewIsLandscape={previewIsLandscape}
        selectedFile={selectedFile}
        viewingDiffPath={viewingDiff?.path}
        isTerminalOpen={isTerminalOpen}
        onTabChange={handleActiveTabChange}
        onPreviewPlatformChange={setPreviewPlatform}
        onPreviewWebDeviceChange={setPreviewWebDevice}
        onPreviewMpPlatformChange={setPreviewMpPlatform}
        onPreviewAppPlatformChange={handlePreviewAppPlatformChange}
        onPreviewDeviceModelChange={setPreviewDeviceModel}
        onPreviewLandscapeToggle={handlePreviewLandscapeToggle}
        onRefreshPreview={handleRefreshPreview}
        onOpenPreviewInNewTab={handleOpenPreviewInNewTab}
        onLaunchSimulator={handleLaunchSimulatorFromHeader}
        onAnalyzeCode={handleAnalyzeCode}
        onToggleTerminal={handleToggleStudioTerminal}
        onToggleProjectGitOverviewDrawer={handleToggleProjectGitOverviewDrawer}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="relative flex-1 flex overflow-hidden">
          <WorkspaceDetailSurface
            activeViewId={isSimulatorTabActive ? 'simulator' : activeTab}
            views={workspaceDetailViews}
          />
          <ProjectGitOverviewDrawer
            isOpen={isProjectGitOverviewDrawerOpen}
            onClose={handleCloseProjectGitOverviewDrawer}
            projectId={currentProjectId || undefined}
            projectGitOverviewState={projectGitOverviewState}
          />
        </div>

        <StudioTerminalIntegrationPanel
          isOpen={isTerminalOpen}
          height={terminalHeight}
          terminalRequest={terminalRequest}
          projectId={currentProjectId}
          runtimeLocationId={terminalRuntimeLocationId}
          onResize={handleStudioTerminalResize}
        />
      </div>
    </div>
  );
}

