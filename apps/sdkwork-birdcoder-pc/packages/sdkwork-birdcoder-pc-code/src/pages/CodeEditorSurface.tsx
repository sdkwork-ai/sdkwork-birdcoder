import { memo, useDeferredValue, useMemo } from 'react';
import {
  buildBirdCoderEditorModelPath,
  ContentWorkbench,
  FileChangeDiffViewer,
  resolveContentPreviewDescriptor,
} from '@sdkwork/birdcoder-pc-ui';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import type { FileChange } from '@sdkwork/birdcoder-pc-contracts-commons';
import { FileCode2, FolderPlus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CodeEditorSurfaceProps {
  currentProjectId?: string;
  fileCount: number;
  openFiles: string[];
  selectedFile?: string | null;
  viewingDiff: FileChange | null;
  fileContent: string;
  onSelectFile: (path: string) => void;
  onCloseFile: (path: string) => void;
  onCloseDiff: () => void;
  onFileDraftChange: (value: string) => void;
  onCreateRootFile: () => void;
  getLanguageFromPath: (path: string) => string;
}

export const CodeEditorSurface = memo(function CodeEditorSurface({
  currentProjectId,
  fileCount,
  openFiles,
  selectedFile,
  viewingDiff,
  fileContent,
  onSelectFile,
  onCloseFile,
  onCloseDiff,
  onFileDraftChange,
  onCreateRootFile,
  getLanguageFromPath,
}: CodeEditorSurfaceProps) {
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
    () => buildBirdCoderEditorModelPath('code', currentProjectId, selectedFile),
    [currentProjectId, selectedFile],
  );
  const retainedModelPaths = useMemo(
    () =>
      openFiles
        .map((path) => buildBirdCoderEditorModelPath('code', currentProjectId, path))
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
    <div className="flex-1 min-w-0 h-full overflow-hidden bg-[#0e0e11] flex flex-col border-r border-white/10 relative">
      {viewingDiff ? (
        <>
          <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#18181b] px-4">
            <div className="flex min-w-0 items-center gap-2 text-sm text-gray-300">
              <span className="shrink-0 text-gray-400">{fullDiffLabel}:</span>
              <span className="truncate font-medium" title={viewingDiff.path}>{viewingDiff.path}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 hover:bg-white/10 focus-visible:ring-1 focus-visible:ring-blue-400/70"
              title={closeFullDiffLabel}
              aria-label={closeFullDiffLabel}
              onClick={onCloseDiff}
            >
              <X size={14} aria-hidden="true" />
            </Button>
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
                  onClick={() => onSelectFile(path)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') {
                      return;
                    }
                    event.preventDefault();
                    onSelectFile(path);
                  }}
                  role="button"
                  tabIndex={0}
                  className={`group flex items-center h-full px-4 border-r border-white/5 text-sm min-w-max transition-colors ${
                    isActive
                      ? 'bg-[#18181b]/50 text-gray-100 border-t-2 border-t-blue-500'
                      : 'bg-[#141417] text-gray-500 hover:text-gray-300 border-t-2 border-t-transparent'
                  }`}
                >
                  <FileCode2 size={14} className={`mr-2 ${isActive ? 'text-blue-400' : 'text-gray-500'}`} />
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
        <div className="flex-1 h-full flex flex-col items-center justify-center text-gray-500 animate-in fade-in zoom-in-95 duration-300 bg-[#0e0e11]">
          {fileCount === 0 ? (
            <div className="flex flex-col items-center max-w-sm text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center mb-6 border border-white/5 shadow-2xl relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                <FolderPlus size={36} className="text-blue-400 relative z-10" />
              </div>
              <h3 className="text-xl font-semibold text-gray-200 mb-3 tracking-tight">{t('app.projectIsEmpty')}</h3>
              <p className="text-sm text-gray-400 mb-8 leading-relaxed">
                {t('app.projectIsEmptyDesc')}
              </p>
              <Button
                onClick={onCreateRootFile}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/10"
              >
                <FolderPlus size={16} className="mr-2" />
                {t('app.createFirstFile')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center max-w-sm text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#18181b] to-[#0e0e11] flex items-center justify-center mb-6 border border-white/5 shadow-2xl relative">
                <FileCode2 size={36} className="text-gray-500 relative z-10" />
              </div>
              <h3 className="text-xl font-semibold text-gray-300 mb-2 tracking-tight">{t('app.noFileSelected')}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {t('app.noFileSelectedDesc')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

CodeEditorSurface.displayName = 'CodeEditorSurface';

