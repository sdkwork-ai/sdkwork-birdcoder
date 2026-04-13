import { Button, FileExplorer, type FileNode } from '@sdkwork/birdcoder-ui';
import { CodeEditor, DiffEditor } from '@sdkwork/birdcoder-ui/editors';
import type { FileChange } from '@sdkwork/birdcoder-types';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface StudioCodeWorkspacePanelProps {
  files: FileNode[];
  selectedFile?: string | null;
  currentProjectName?: string;
  viewingDiff: FileChange | null;
  fileContent: string;
  onSelectFile: (path: string) => void;
  onCreateFile: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onRenameNode: (path: string, nextPath: string) => void;
  onAcceptDiff: () => void | Promise<void>;
  onRejectDiff: () => void;
  onFileContentChange: (value: string) => void;
  getLanguageFromPath: (path: string) => string;
}

export function StudioCodeWorkspacePanel({
  files,
  selectedFile,
  currentProjectName,
  viewingDiff,
  fileContent,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onDeleteFolder,
  onRenameNode,
  onAcceptDiff,
  onRejectDiff,
  onFileContentChange,
  getLanguageFromPath,
}: StudioCodeWorkspacePanelProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      <FileExplorer
        files={files}
        selectedFile={selectedFile || undefined}
        basePath={`/workspace/${currentProjectName || 'project'}`}
        onSelectFile={onSelectFile}
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        onDeleteFile={onDeleteFile}
        onDeleteFolder={onDeleteFolder}
        onRenameNode={onRenameNode}
      />
      <div className="flex-1 h-full bg-[#0e0e11] flex flex-col">
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
            <DiffEditor
              language={getLanguageFromPath(viewingDiff.path)}
              original={viewingDiff.originalContent || ''}
              modified={viewingDiff.content || ''}
              readOnly={true}
            />
          </>
        ) : selectedFile ? (
          <CodeEditor
            language={getLanguageFromPath(selectedFile)}
            value={fileContent}
            onChange={(value) => onFileContentChange(value || '')}
          />
        ) : (
          <div className="flex-1 h-full flex items-center justify-center text-gray-500">
            {files.length === 0 ? t('studio.projectEmpty') : t('studio.selectFile')}
          </div>
        )}
      </div>
    </div>
  );
}
