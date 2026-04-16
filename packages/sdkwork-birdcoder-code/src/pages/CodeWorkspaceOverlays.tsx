import type { ProjectMountRecoveryState } from '@sdkwork/birdcoder-commons/workbench';
import type { FileNode } from '@sdkwork/birdcoder-ui';
import { AlertCircle, FileCode2, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  collectCodeQuickOpenResults,
  type CodeWorkspaceSearchResult,
} from './codeFileSearch';

interface CodeWorkspaceOverlaysProps {
  files: FileNode[];
  mountRecoveryState: ProjectMountRecoveryState;
  isMountRecoveryActionPending: boolean;
  isFindVisible: boolean;
  isSearchingFiles: boolean;
  isQuickOpenVisible: boolean;
  searchFiles: (query: string) => Promise<{
    status: 'completed' | 'stale';
    limitReached: boolean;
    results: CodeWorkspaceSearchResult[];
  }>;
  onSelectFile: (path: string) => void;
  onRetryMountRecovery: () => void;
  onReimportProjectFolder: () => void;
  onCloseFind: () => void;
  onCloseQuickOpen: () => void;
  onNotifyNoResults: () => void;
}

export function CodeWorkspaceOverlays({
  files,
  mountRecoveryState,
  isMountRecoveryActionPending,
  isFindVisible,
  isSearchingFiles,
  isQuickOpenVisible,
  searchFiles,
  onSelectFile,
  onRetryMountRecovery,
  onReimportProjectFolder,
  onCloseFind,
  onCloseQuickOpen,
  onNotifyNoResults,
}: CodeWorkspaceOverlaysProps) {
  const { t } = useTranslation();
  const [findResults, setFindResults] = useState<CodeWorkspaceSearchResult[]>([]);
  const [isResultLimitReached, setIsResultLimitReached] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState('');

  useEffect(() => {
    if (isFindVisible) {
      setFindResults([]);
      setIsResultLimitReached(false);
    }
  }, [isFindVisible]);

  useEffect(() => {
    if (isQuickOpenVisible) {
      setQuickOpenQuery('');
    }
  }, [isQuickOpenVisible]);

  const quickOpenResults = useMemo(
    () => collectCodeQuickOpenResults(files, quickOpenQuery, 'File match'),
    [files, quickOpenQuery],
  );

  const handleFindSubmit = async (query: string) => {
    if (!query.trim()) {
      return;
    }

    const response = await searchFiles(query);
    if (response.status !== 'completed') {
      return;
    }

    setFindResults(response.results);
    setIsResultLimitReached(response.limitReached);
    if (response.results.length === 0) {
      onNotifyNoResults();
    }
  };

  return (
    <>
      {mountRecoveryState.status === 'recovering' && (
        <div className="absolute top-16 left-4 z-40 max-w-xl">
          <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 shadow-2xl backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-sky-200/80 border-t-transparent animate-spin" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-sky-100">
                  Reconnecting local project folder
                </div>
                <div className="mt-1 text-sm leading-6 text-sky-50/90">
                  BirdCoder is reopening the persisted local folder for this project.
                </div>
                {mountRecoveryState.path && (
                  <div className="mt-2 break-all font-mono text-xs text-sky-100/80">
                    {mountRecoveryState.path}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {mountRecoveryState.status === 'failed' && (
        <div className="absolute top-16 left-4 z-40 max-w-xl">
          <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 shadow-2xl backdrop-blur">
            <div className="flex items-start gap-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-300" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-amber-100">
                  Local project folder needs attention
                </div>
                <div className="mt-1 text-sm leading-6 text-amber-50/90">
                  {mountRecoveryState.message}
                </div>
                {mountRecoveryState.path && (
                  <div className="mt-2 break-all font-mono text-xs text-amber-100/80">
                    {mountRecoveryState.path}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isMountRecoveryActionPending}
                    className="rounded-md border border-amber-200/30 bg-amber-200/10 px-3 py-1.5 text-xs font-semibold text-amber-50 transition-colors hover:bg-amber-200/20 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={onRetryMountRecovery}
                  >
                    {isMountRecoveryActionPending ? 'Retrying...' : 'Retry Connection'}
                  </button>
                  <button
                    type="button"
                    disabled={isMountRecoveryActionPending}
                    className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-100 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={onReimportProjectFolder}
                  >
                    Choose Folder
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isFindVisible && (
        <div className="absolute top-16 right-1/2 translate-x-1/2 w-[32rem] max-h-[80vh] flex flex-col bg-[#18181b] border border-white/10 rounded-lg shadow-2xl z-50 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0">
            <h3 className="text-sm font-medium text-gray-200">{t('app.findInFiles')}</h3>
            <button onClick={onCloseFind} className="text-gray-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="p-4 shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder={t('app.searchPlaceholder')}
                className="w-full bg-[#0e0e11] border border-white/10 rounded-md px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                autoFocus
                onKeyDown={async (event) => {
                  if (event.key === 'Enter') {
                    await handleFindSubmit(event.currentTarget.value);
                  } else if (event.key === 'Escape') {
                    onCloseFind();
                  }
                }}
              />
              {isSearchingFiles && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
          {isResultLimitReached && (
            <div className="px-4 py-2 border-t border-amber-500/20 bg-amber-500/10 text-xs text-amber-200 shrink-0">
              Showing first {findResults.length} matches. Refine your query to narrow the results.
            </div>
          )}
          {findResults.length > 0 && (
            <div className="overflow-y-auto p-2 border-t border-white/5">
              {findResults.map((result, index) => (
                <button
                  key={`${result.path}:${result.line}:${index}`}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-md group flex flex-col gap-1"
                  onClick={() => {
                    onSelectFile(result.path);
                    onCloseFind();
                  }}
                >
                  <div className="text-xs font-medium text-blue-400 group-hover:text-blue-300 truncate">
                    {result.path}:{result.line}
                  </div>
                  <div className="text-sm text-gray-300 truncate font-mono">
                    {result.content}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isQuickOpenVisible && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 w-[600px] bg-[#18181b] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center p-2 border-b border-white/10">
            <Search size={16} className="text-gray-400 ml-2" />
            <input
              type="text"
              autoFocus
              placeholder="Search files by name..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-gray-200 px-3 py-1.5 placeholder:text-gray-500"
              value={quickOpenQuery}
              onChange={(event) => setQuickOpenQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  onCloseQuickOpen();
                } else if (event.key === 'Enter' && quickOpenResults.length > 0) {
                  onSelectFile(quickOpenResults[0].path);
                  onCloseQuickOpen();
                }
              }}
            />
            <button
              className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors"
              onClick={onCloseQuickOpen}
            >
              <X size={14} />
            </button>
          </div>
          {quickOpenResults.length > 0 && (
            <div className="max-h-[300px] overflow-y-auto p-2">
              {quickOpenResults.map((result) => (
                <button
                  key={result.path}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-md group flex items-center gap-3"
                  onClick={() => {
                    onSelectFile(result.path);
                    onCloseQuickOpen();
                  }}
                >
                  <FileCode2 size={14} className="text-gray-500 group-hover:text-blue-400" />
                  <div className="text-sm font-medium text-gray-300 group-hover:text-white truncate">
                    {result.path}
                  </div>
                </button>
              ))}
            </div>
          )}
          {quickOpenQuery && quickOpenResults.length === 0 && (
            <div className="p-4 text-center text-sm text-gray-500">
              No files found matching "{quickOpenQuery}"
            </div>
          )}
        </div>
      )}
    </>
  );
}
