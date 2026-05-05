import { memo, useDeferredValue, useMemo } from 'react';
import {
  ContentWorkbench,
  DeferredDiffEditor,
  FileExplorer,
  resolveContentPreviewDescriptor,
  type FileNode,
} from '@sdkwork/birdcoder-ui';
import { Button, ResizeHandle } from '@sdkwork/birdcoder-ui-shell';
import type { FileChange } from '@sdkwork/birdcoder-types';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface StudioCodeWorkspacePanelProps {
  isActive?: boolean;
  currentProjectId?: string;
  files: FileNode[];
  loadingDirectoryPaths: Record<string, boolean>;
  openFiles: string[];
  selectedFile?: string | null;
  currentProjectPath?: string;
  viewingDiff: FileChange | null;
  fileContent: string;
  explorerWidth: number;
  onSelectFile: (path: string) => void;
  onExpandDirectory: (path: string) => void | Promise<void>;
  onCloseFile: (path: string) => void;
  onCreateFile: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onRenameNode: (path: string, nextPath: string) => void;
  onAcceptDiff: () => void | Promise<void>;
  onRejectDiff: () => void;
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
    left.currentProjectPath === right.currentProjectPath &&
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
    left.onAcceptDiff === right.onAcceptDiff &&
    left.onRejectDiff === right.onRejectDiff &&
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
  currentProjectPath,
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
  onAcceptDiff,
  onRejectDiff,
  onFileDraftChange,
  onExplorerResize,
  getLanguageFromPath,
}: StudioCodeWorkspacePanelProps) {
  const { t } = useTranslation();
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

  return (
    <div className={isActive ? 'flex-1 flex h-full overflow-hidden' : 'hidden'}>
      <FileExplorer
        files={files}
        isActive={isActive}
        width={explorerWidth}
        loadingDirectoryPaths={loadingDirectoryPaths}
        onExpandDirectory={onExpandDirectory}
        scopeKey={currentProjectId}
        selectedFile={selectedFile || undefined}
        basePath={currentProjectPath}
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
            <div className="h-10 border-b border-white/10 flex items-center justify-between px-4 bg-[#18181b] shrink-0">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <span className="text-gray-500">Diff:</span>
                <span className="font-medium">{viewingDiff.path}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-6 text-xs bg-green-600 hover:bg-green-500 text-white" onClick={onAcceptDiff}>
                  {t('studio.accept')}
                </Button>
                <Button size="sm" variant="outline" className="h-6 text-xs border-white/10 hover:bg-white/10" onClick={onRejectDiff}>
                  {t('studio.reject')}
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-2 hover:bg-white/10" onClick={onRejectDiff}>
                  <X size={14} />
                </Button>
              </div>
            </div>
            <DeferredDiffEditor
              language={getLanguageFromPath(viewingDiff.path)}
              original={viewingDiff.originalContent || ''}
              modified={viewingDiff.content || ''}
              readOnly={true}
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
                key={selectedFile}
                defaultMode={defaultWorkbenchMode}
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
