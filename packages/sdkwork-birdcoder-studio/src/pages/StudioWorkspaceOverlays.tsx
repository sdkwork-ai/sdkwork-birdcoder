import { type FileNode } from '@sdkwork/birdcoder-ui';
import { FileCode2, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  collectStudioQuickOpenResults,
  type StudioWorkspaceSearchResult,
} from './studioFileSearch';

interface StudioWorkspaceOverlaysProps {
  files: FileNode[];
  isFindVisible: boolean;
  isQuickOpenVisible: boolean;
  searchFiles: (query: string) => Promise<StudioWorkspaceSearchResult[]>;
  onSelectFile: (path: string) => void;
  onCloseFind: () => void;
  onCloseQuickOpen: () => void;
  onNotifyNoResults: () => void;
}

export function StudioWorkspaceOverlays({
  files,
  isFindVisible,
  isQuickOpenVisible,
  searchFiles,
  onSelectFile,
  onCloseFind,
  onCloseQuickOpen,
  onNotifyNoResults,
}: StudioWorkspaceOverlaysProps) {
  const { t } = useTranslation();
  const [findResults, setFindResults] = useState<StudioWorkspaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState('');

  useEffect(() => {
    if (isFindVisible) {
      setFindResults([]);
      setIsSearching(false);
    }
  }, [isFindVisible]);

  useEffect(() => {
    if (isQuickOpenVisible) {
      setQuickOpenQuery('');
    }
  }, [isQuickOpenVisible]);

  const quickOpenResults = useMemo(
    () => collectStudioQuickOpenResults(files, quickOpenQuery, t('studio.fileMatch')),
    [files, quickOpenQuery, t],
  );

  const handleFindSubmit = async (query: string) => {
    if (!query.trim()) {
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchFiles(query);
      setFindResults(results);
      if (results.length === 0) {
        onNotifyNoResults();
      }
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <>
      {isFindVisible && (
        <div className="absolute top-16 right-1/2 translate-x-1/2 w-[32rem] max-h-[80vh] flex flex-col bg-[#18181b] border border-white/10 rounded-lg shadow-2xl z-50 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0">
            <h3 className="text-sm font-medium text-gray-200">{t('studio.findInFiles')}</h3>
            <button onClick={onCloseFind} className="text-gray-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="p-4 shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder={t('studio.searchPlaceholder')}
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
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
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
              placeholder={t('studio.searchFilesByName')}
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
              {t('studio.noMatchingFiles')}
            </div>
          )}
        </div>
      )}
    </>
  );
}
