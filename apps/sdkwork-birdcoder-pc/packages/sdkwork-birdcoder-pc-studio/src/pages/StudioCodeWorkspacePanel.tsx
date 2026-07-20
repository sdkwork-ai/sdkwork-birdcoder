import { memo, useDeferredValue, useMemo } from 'react';
import {
  buildBirdCoderEditorModelPath,
  ContentWorkbench,
  DeferredFileExplorer,
  FileChangeDiffViewer,
  resolveContentPreviewDescriptor,
  type FileNode,
} from '@sdkwork/birdcoder-pc-ui';
import { ResizeHandle } from '@sdkwork/birdcoder-pc-ui-shell';
import type { FileChange } from '@sdkwork/birdcoder-pc-contracts-commons';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface StudioCodeWorkspacePanelProps {
  isActive?: boolean;
  currentProjectId?: string;
  files: FileNode[];
  loadingDirectoryPaths: Record<string, boolean>;
  openFiles: string[];
  selectedFile?: string | null;
  viewingDiff: FileChange | null;
  fileContent: string;
  explorerWidth: number;
  onSelectFile: (path: string) => void;
  onExpandDirectory: (path: string) => void | Promise<void>;
  onCloseFile: (path: string) => void;
  onCreateFile: (path: string) => void | Promise<void>;
  onCreateFolder: (path: string) => void | Promise<void>;
  onDeleteFile: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onRenameNode: (path: string, nextPath: string) => void | Promise<void>;
  onCloseDiff: () => void;
  onFileDraftChange: (value: string) => void;
  onExplorerResize: (delta: number) => void;
  getLanguageFromPath: (path: string) => string;
}

function areStudioCodeWorkspacePanelPropsEqual(
  left: StudioCodeWorkspacePanelProps,
  right: StudioCodeWorkspacePanelProps,
) {
  if (left.isActive !== right.isActive) {
    return false;
  }

  if (!left.isActive && !right.isActive) {
    return true;
  }

  return (
    left.currentProjectId === right.currentProjectId &&
    left.files === right.files &&
    left.loadingDirectoryPaths === right.loadingDirectoryPaths &&
    left.openFiles === right.openFiles &&
    left.selectedFile === right.selectedFile &&
    left.viewingDiff === right.viewingDiff &&
    left.fileContent === right.fileContent &&
    left.explorerWidth === right.explorerWidth &&
    left.onSelectFile === right.onSelectFile &&
    left.onExpandDirectory === right.onExpandDirectory &&
    left.onCloseFile === right.onCloseFile &&
    left.onCreateFile === right.onCreateFile &&
    left.onCreateFolder === right.onCreateFolder &&
    left.onDeleteFile === right.onDeleteFile &&
    left.onDeleteFolder === right.onDeleteFolder &&
    left.onRenameNode === right.onRenameNode &&
    left.onCloseDiff === right.onCloseDiff &&
    left.onFileDraftChange === right.onFileDraftChange &&
    left.onExplorerResize === right.onExplorerResize &&
    left.getLanguageFromPath === right.getLanguageFromPath
  );
}

export const StudioCodeWorkspacePanel = memo(function StudioCodeWorkspacePanel({
  isActive = true,
  currentProjectId,
  files,
  loadingDirectoryPaths,
  openFiles,
  selectedFile,
  viewingDiff,
  fileContent,
  explorerWidth,
  onSelectFile,
  onExpandDirectory,
  onCloseFile,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onDeleteFolder,
  onRenameNode,
  onCloseDiff,
  onFileDraftChange,
  onExplorerResize,
  getLanguageFromPath,
}: StudioCodeWorkspacePanelProps) {
  const { t } = useTranslation();
  const fullDiffLabel = t('chat.fullDiffTitle');
  const closeFullDiffLabel = t('chat.closeFullDiff');
  const emptyFullDiffLabel = t('chat.fullDiffUnavailable');
  const deferredFileContent = useDeferredValue(fileContent);
  const selectedFileLanguage = selectedFile ? getLanguageFromPath(selectedFile) : '';
  const previewDescriptor = useMemo(
    () =>
      selectedFile
        ? resolveContentPreviewDescriptor({
            language: selectedFileLanguage,
            path: selectedFile,
            value: deferredFileContent,
          })
        : null,
    [deferredFileContent, selectedFile, selectedFileLanguage],
  );
  const defaultWorkbenchMode = useMemo(
    () =>
      previewDescriptor?.shouldDefaultToSplit ? 'split' : 'edit',
    [previewDescriptor],
  );
  const editorModelPath = useMemo(
    () => buildBirdCoderEditorModelPath('studio', currentProjectId, selectedFile),
    [currentProjectId, selectedFile],
  );
  const retainedModelPaths = useMemo(
    () =>
      openFiles
        .map((path) => buildBirdCoderEditorModelPath('studio', currentProjectId, path))
        .filter((path): path is string => Boolean(path)),
    [currentProjectId, openFiles],
  );
  const editorProps = useMemo(
    () => ({
      path: editorModelPath,
      retainedModelPaths,
    }),
    [editorModelPath, retainedModelPaths],
  );

  return (
    <div className={isActive ? 'flex-1 flex h-full overflow-hidden' : 'hidden'}>
      <DeferredFileExplorer
        files={files}
        isActive={isActive}
        width={explorerWidth}
        loadingDirectoryPaths={loadingDirectoryPaths}
        onExpandDirectory={onExpandDirectory}
        projectId={currentProjectId}
        scopeKey={currentProjectId}
        selectedFile={selectedFile || undefined}
        onSelectFile={onSelectFile}
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        onDeleteFile={onDeleteFile}
        onDeleteFolder={onDeleteFolder}
        onRenameNode={onRenameNode}
      />
      <ResizeHandle direction="horizontal" onResize={onExplorerResize} />
      <div className="flex min-w-0 flex-1 flex-col bg-[#0e0e11]">
        <div className="min-h-0 flex-1 flex flex-col">
          {viewingDiff ? (
          <>
            <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#18181b] px-4">
              <div className="flex min-w-0 items-center gap-2 text-sm text-gray-300">
                <span className="shrink-0 text-gray-400">{fullDiffLabel}:</span>
                <span className="truncate font-medium" title={viewingDiff.path}>{viewingDiff.path}</span>
              </div>
              <button
                type="button"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
                title={closeFullDiffLabel}
                aria-label={closeFullDiffLabel}
                onClick={onCloseDiff}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <FileChangeDiffViewer
              ariaLabel={`${fullDiffLabel}: ${viewingDiff.path}`}
              emptyLabel={emptyFullDiffLabel}
              fileChange={viewingDiff}
              language={getLanguageFromPath(viewingDiff.path)}
            />
          </>
          ) : selectedFile ? (
            <>
              <div className="h-10 flex items-center bg-[#18181b] border-b border-white/5 shrink-0 overflow-x-auto custom-scrollbar">
                {openFiles.map((path) => {
                  const isActive = path === selectedFile;
                  return (
                    <div
                      key={path}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectFile(path)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') {
                          return;
                        }
                        event.preventDefault();
                        onSelectFile(path);
                      }}
                      className={`group flex items-center h-full px-4 border-r border-white/5 text-sm min-w-max transition-colors ${
                        isActive
                          ? 'bg-[#18181b]/50 text-gray-100 border-t-2 border-t-blue-500'
                          : 'bg-[#141417] text-gray-500 hover:text-gray-300 border-t-2 border-t-transparent'
                      }`}
                    >
                      <span>{path.split('/').pop()}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        className={`ml-3 rounded-md p-0.5 transition-all ${
                          isActive ? 'opacity-100 text-gray-400 hover:bg-white/10 hover:text-white' : 'opacity-0 group-hover:opacity-100 text-gray-500 hover:bg-white/10 hover:text-white'
                        }`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onCloseFile(path);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') {
                            return;
                          }
                          event.preventDefault();
                          event.stopPropagation();
                          onCloseFile(path);
                        }}
                      >
                        <X size={14} />
                      </span>
                    </div>
                  );
                })}
              </div>
              <ContentWorkbench
                defaultMode={defaultWorkbenchMode}
                editorProps={editorProps}
                language={selectedFileLanguage}
                path={selectedFile}
                previewDescriptor={previewDescriptor ?? undefined}
                responsiveSplitBreakpoint={920}
                value={fileContent}
                onChange={(value) => onFileDraftChange(value || '')}
              />
            </>
          ) : (
            <div className="flex-1 h-full flex items-center justify-center text-gray-500">
              {files.length === 0 ? t('studio.projectEmpty') : t('studio.selectFile')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}, areStudioCodeWorkspacePanelPropsEqual);

StudioCodeWorkspacePanel.displayName = 'StudioCodeWorkspacePanel';

