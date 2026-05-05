import type { ComponentProps } from 'react';
import { ProjectGitOverviewDrawer } from '@sdkwork/birdcoder-ui';
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
  currentProjectPath?: string;
  fileContent: StudioCodeWorkspacePanelProps['fileContent'];
  files: StudioWorkspaceOverlaysProps['files'];
  getLanguageFromPath: StudioCodeWorkspacePanelProps['getLanguageFromPath'];
  handleActiveTabChange: StudioStageHeaderProps['onTabChange'];
  handleAnalyzeCode: StudioStageHeaderProps['onAnalyzeCode'];
  handleCloseProjectGitOverviewDrawer: StudioGitOverviewDrawerProps['onClose'];
  handleLaunchSimulatorFromHeader: StudioStageHeaderProps['onLaunchSimulator'];
  handleOpenPreviewInNewTab: StudioStageHeaderProps['onOpenPreviewInNewTab'];
  handleOpenStudioPublish: StudioStageHeaderProps['onOpenPublish'];
  handleOpenStudioShare: StudioStageHeaderProps['onOpenShare'];
  handlePreviewAppPlatformChange: StudioStageHeaderProps['onPreviewAppPlatformChange'];
  handlePreviewLandscapeToggle: StudioStageHeaderProps['onPreviewLandscapeToggle'];
  handleRefreshPreview: StudioStageHeaderProps['onRefreshPreview'];
  handleStudioAcceptViewingDiff: StudioCodeWorkspacePanelProps['onAcceptDiff'];
  handleStudioCloseFind: StudioWorkspaceOverlaysProps['onCloseFind'];
  handleStudioCloseQuickOpen: StudioWorkspaceOverlaysProps['onCloseQuickOpen'];
  handleStudioCodeExplorerResize: StudioCodeWorkspacePanelProps['onExplorerResize'];
  handleStudioCodePanelSelectFile: StudioCodeWorkspacePanelProps['onSelectFile'];
  handleStudioNotifyNoResults: StudioWorkspaceOverlaysProps['onNotifyNoResults'];
  handleStudioOverlaySelectFile: StudioWorkspaceOverlaysProps['onSelectFile'];
  handleStudioReimportProjectFolder: StudioWorkspaceOverlaysProps['onReimportProjectFolder'];
  handleStudioRejectViewingDiff: StudioCodeWorkspacePanelProps['onRejectDiff'];
  handleStudioRetryMountRecovery: StudioWorkspaceOverlaysProps['onRetryMountRecovery'];
  handleStudioTerminalResize: StudioTerminalIntegrationPanelProps['onResize'];
  handleToggleProjectGitOverviewDrawer: StudioStageHeaderProps['onToggleProjectGitOverviewDrawer'];
  handleToggleStudioTerminal: StudioStageHeaderProps['onToggleTerminal'];
  isFindVisible: StudioWorkspaceOverlaysProps['isFindVisible'];
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
  updateFileDraft: StudioCodeWorkspacePanelProps['onFileDraftChange'];
  viewingDiff: StudioCodeWorkspacePanelProps['viewingDiff'];
  workspaceId: StudioTerminalIntegrationPanelProps['workspaceId'];
  closeFile: StudioCodeWorkspacePanelProps['onCloseFile'];
  createFile: StudioCodeWorkspacePanelProps['onCreateFile'];
  createFolder: StudioCodeWorkspacePanelProps['onCreateFolder'];
  deleteFile: StudioCodeWorkspacePanelProps['onDeleteFile'];
  deleteFolder: StudioCodeWorkspacePanelProps['onDeleteFolder'];
  loadDirectory: StudioCodeWorkspacePanelProps['onExpandDirectory'];
  renameNode: StudioCodeWorkspacePanelProps['onRenameNode'];
}

interface StudioMainContentProps {
  model: StudioMainContentModel;
}

export function StudioMainContent({ model }: StudioMainContentProps) {
  const {
    activeTab,
    codeExplorerWidth,
    currentProjectId,
    currentProjectPath,
    fileContent,
    files,
    getLanguageFromPath,
    handleActiveTabChange,
    handleAnalyzeCode,
    handleCloseProjectGitOverviewDrawer,
    handleLaunchSimulatorFromHeader,
    handleOpenPreviewInNewTab,
    handleOpenStudioPublish,
    handleOpenStudioShare,
    handlePreviewAppPlatformChange,
    handlePreviewLandscapeToggle,
    handleRefreshPreview,
    handleStudioAcceptViewingDiff,
    handleStudioCloseFind,
    handleStudioCloseQuickOpen,
    handleStudioCodeExplorerResize,
    handleStudioCodePanelSelectFile,
    handleStudioNotifyNoResults,
    handleStudioOverlaySelectFile,
    handleStudioReimportProjectFolder,
    handleStudioRejectViewingDiff,
    handleStudioRetryMountRecovery,
    handleStudioTerminalResize,
    handleToggleProjectGitOverviewDrawer,
    handleToggleStudioTerminal,
    isFindVisible,
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
    updateFileDraft,
    viewingDiff,
    workspaceId,
    closeFile,
    createFile,
    createFolder,
    deleteFile,
    deleteFolder,
    loadDirectory,
    renameNode,
  } = model;

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
        onOpenShare={handleOpenStudioShare}
        onOpenPublish={handleOpenStudioPublish}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="relative flex-1 flex overflow-hidden">
          {activeTab === 'preview' ? (
            <StudioPreviewPanel devicePreviewProps={memoizedDevicePreviewProps} />
          ) : isSimulatorTabActive ? (
            <StudioSimulatorPanel devicePreviewProps={memoizedDevicePreviewProps} />
          ) : null}
          <StudioCodeWorkspacePanel
            isActive={isVisible && activeTab === 'code'}
            currentProjectId={currentProjectId || undefined}
            files={files}
            loadingDirectoryPaths={loadingDirectoryPaths}
            openFiles={openFiles}
            explorerWidth={codeExplorerWidth}
            selectedFile={selectedFile}
            currentProjectPath={currentProjectPath}
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
            onAcceptDiff={handleStudioAcceptViewingDiff}
            onRejectDiff={handleStudioRejectViewingDiff}
            onFileDraftChange={updateFileDraft}
            onExplorerResize={handleStudioCodeExplorerResize}
            getLanguageFromPath={getLanguageFromPath}
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
          workspaceId={workspaceId}
          projectId={currentProjectId}
          onResize={handleStudioTerminalResize}
        />
      </div>
    </div>
  );
}
