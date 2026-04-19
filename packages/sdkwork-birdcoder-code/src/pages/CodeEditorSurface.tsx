import { memo } from 'react';
import { Button } from '@sdkwork/birdcoder-ui';
import { CodeEditor, DiffEditor } from '@sdkwork/birdcoder-ui/editors';
import type { FileChange } from '@sdkwork/birdcoder-types';
import { FileCode2, FolderPlus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CodeEditorSurfaceProps {
  fileCount: number;
  selectedFile?: string | null;
  viewingDiff: FileChange | null;
  fileContent: string;
  onClearSelectedFile: () => void;
  onAcceptDiff: () => void | Promise<void>;
  onRejectDiff: () => void;
  onFileContentChange: (value: string) => void;
  onCreateRootFile: () => void;
  getLanguageFromPath: (path: string) => string;
}

function areFileChangesEqual(left: FileChange | null, right: FileChange | null): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return left === right;
  }

  return (
    left.path === right.path &&
    left.additions === right.additions &&
    left.deletions === right.deletions &&
    left.content === right.content &&
    left.originalContent === right.originalContent
  );
}

function areCodeEditorSurfacePropsEqual(
  left: CodeEditorSurfaceProps,
  right: CodeEditorSurfaceProps,
): boolean {
  return (
    left.fileCount === right.fileCount &&
    left.selectedFile === right.selectedFile &&
    left.fileContent === right.fileContent &&
    areFileChangesEqual(left.viewingDiff, right.viewingDiff)
  );
}

export const CodeEditorSurface = memo(function CodeEditorSurface({
  fileCount,
  selectedFile,
  viewingDiff,
  fileContent,
  onClearSelectedFile,
  onAcceptDiff,
  onRejectDiff,
  onFileContentChange,
  onCreateRootFile,
  getLanguageFromPath,
}: CodeEditorSurfaceProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 min-w-0 h-full overflow-hidden bg-[#0e0e11] flex flex-col border-r border-white/10 relative">
      {viewingDiff ? (
        <>
          <div className="h-10 border-b border-white/10 flex items-center justify-between px-4 bg-[#18181b] shrink-0">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <span className="text-gray-500">Diff:</span>
              <span className="font-medium">{viewingDiff.path}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-6 text-xs bg-green-600 hover:bg-green-500 text-white" onClick={onAcceptDiff}>
                Accept
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-xs border-white/10 hover:bg-white/10" onClick={onRejectDiff}>
                Reject
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 ml-2 hover:bg-white/10" onClick={onRejectDiff}>
                <X size={14} />
              </Button>
            </div>
          </div>
          <DiffEditor
            language={getLanguageFromPath(viewingDiff.path)}
            original={viewingDiff.originalContent || ''}
            modified={viewingDiff.content || ''}
            readOnly={true}
          />
        </>
      ) : selectedFile ? (
        <>
          <div className="h-10 flex items-center bg-[#18181b] border-b border-white/5 shrink-0 overflow-x-auto custom-scrollbar">
            <div className="flex items-center h-full px-4 bg-[#18181b]/50 border-r border-white/5 text-sm text-gray-300 min-w-max group cursor-pointer border-t-2 border-t-blue-500">
              <FileCode2 size={14} className="mr-2 text-blue-400" />
              {selectedFile.split('/').pop()}
              <button
                className="ml-3 p-0.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                onClick={(event) => {
                  event.stopPropagation();
                  onClearSelectedFile();
                }}
              >
                <X size={14} className="text-gray-400 hover:text-white" />
              </button>
            </div>
          </div>
          <CodeEditor
            language={getLanguageFromPath(selectedFile)}
            value={fileContent}
            onChange={(value) => onFileContentChange(value || '')}
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
}, areCodeEditorSurfacePropsEqual);

CodeEditorSurface.displayName = 'CodeEditorSurface';
