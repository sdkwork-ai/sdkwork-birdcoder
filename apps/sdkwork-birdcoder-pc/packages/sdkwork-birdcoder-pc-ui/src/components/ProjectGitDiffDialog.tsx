import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronRight,
  FileDiff,
  FilePlus2,
  FileX2,
  Loader2,
  Minus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { BirdCoderProjectGitDiff } from '@sdkwork/birdcoder-pc-types';
import { useIDEServices } from '@sdkwork/birdcoder-pc-commons/context/IDEContext';

interface ProjectGitDiffDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string | null;
}

type DiffLineKind = 'addition' | 'deletion' | 'context' | 'hunk';

interface DiffLine {
  kind: DiffLineKind;
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

interface DiffFile {
  additions: number;
  deletions: number;
  lines: DiffLine[];
  path: string;
  status: 'added' | 'deleted' | 'modified';
}

const DIFF_FILE_PREFIX = 'diff --git ';

function normalizeDiffPath(value: string) {
  return value.replace(/^"|"$/gu, '').replace(/^(?:a|b)\//u, '');
}

function parseDiffFileHeader(value: string) {
  const match = /^(?<oldPath>"(?:\\.|[^"])*"|\S+) (?<newPath>"(?:\\.|[^"])*"|\S+)$/u.exec(value);
  return normalizeDiffPath(match?.groups?.newPath ?? '');
}

function parseHunkStart(value: string) {
  const match = /^@@ -(?<oldStart>\d+)(?:,\d+)? \+(?<newStart>\d+)(?:,\d+)? @@/u.exec(value);
  return match?.groups
    ? { newLineNumber: Number(match.groups.newStart), oldLineNumber: Number(match.groups.oldStart) }
    : undefined;
}

function parseProjectGitDiff(patch: string): DiffFile[] {
  const files: DiffFile[] = [];
  let currentFile: DiffFile | undefined;
  let oldLineNumber = 0;
  let newLineNumber = 0;

  for (const sourceLine of patch.replace(/\r\n?/gu, '\n').split('\n')) {
    if (sourceLine.startsWith(DIFF_FILE_PREFIX)) {
      const nextPath = parseDiffFileHeader(sourceLine.slice(DIFF_FILE_PREFIX.length));
      currentFile = {
        additions: 0,
        deletions: 0,
        lines: [],
        path: nextPath,
        status: 'modified',
      };
      files.push(currentFile);
      continue;
    }

    if (!currentFile) {
      continue;
    }

    if (sourceLine.startsWith('--- ')) {
      if (sourceLine === '--- /dev/null') {
        currentFile.status = 'added';
      }
      continue;
    }

    if (sourceLine.startsWith('+++ ')) {
      if (sourceLine === '+++ /dev/null') {
        currentFile.status = 'deleted';
      } else {
        currentFile.path = normalizeDiffPath(sourceLine.slice(4));
      }
      continue;
    }

    const hunkStart = parseHunkStart(sourceLine);
    if (hunkStart) {
      oldLineNumber = hunkStart.oldLineNumber;
      newLineNumber = hunkStart.newLineNumber;
      currentFile.lines.push({ content: sourceLine, kind: 'hunk' });
      continue;
    }

    if (sourceLine.startsWith('+') && !sourceLine.startsWith('+++')) {
      currentFile.additions += 1;
      currentFile.lines.push({ content: sourceLine.slice(1), kind: 'addition', newLineNumber });
      newLineNumber += 1;
      continue;
    }

    if (sourceLine.startsWith('-') && !sourceLine.startsWith('---')) {
      currentFile.deletions += 1;
      currentFile.lines.push({ content: sourceLine.slice(1), kind: 'deletion', oldLineNumber });
      oldLineNumber += 1;
      continue;
    }

    if (sourceLine.startsWith(' ')) {
      currentFile.lines.push({
        content: sourceLine.slice(1),
        kind: 'context',
        newLineNumber,
        oldLineNumber,
      });
      oldLineNumber += 1;
      newLineNumber += 1;
    }
  }

  return files;
}

function getFileName(path: string) {
  return path.split('/').filter(Boolean).pop() ?? path;
}

function getDirectoryName(path: string) {
  return path.split('/').filter(Boolean).slice(0, -1).join('/');
}

function DiffStatusIcon({ status }: Pick<DiffFile, 'status'>) {
  if (status === 'added') {
    return <FilePlus2 size={15} className="text-emerald-300" aria-hidden="true" />;
  }
  if (status === 'deleted') {
    return <FileX2 size={15} className="text-rose-300" aria-hidden="true" />;
  }
  return <FileDiff size={15} className="text-amber-200" aria-hidden="true" />;
}

function DiffLineRow({ line }: { line: DiffLine }) {
  if (line.kind === 'hunk') {
    return (
      <div className="mt-3 grid grid-cols-[3.25rem_3.25rem_minmax(0,1fr)] border-y border-sky-300/10 bg-sky-400/[0.08] text-sky-200/80">
        <span className="border-r border-sky-300/10 px-2 text-right select-none" />
        <span className="border-r border-sky-300/10 px-2 text-right select-none" />
        <code className="min-w-0 overflow-hidden px-3 py-1.5 text-[11px] leading-5">{line.content}</code>
      </div>
    );
  }

  const appearance = {
    addition: 'border-l-emerald-400 bg-emerald-400/[0.12] text-emerald-50',
    context: 'border-l-transparent text-slate-300',
    deletion: 'border-l-rose-400 bg-rose-400/[0.12] text-rose-50',
  }[line.kind];
  const marker = line.kind === 'addition' ? '+' : line.kind === 'deletion' ? '-' : ' ';

  return (
    <div className={`grid grid-cols-[3.25rem_3.25rem_minmax(0,1fr)] border-l-2 ${appearance} hover:brightness-110`}>
      <span className="border-r border-white/[0.045] px-2 text-right text-slate-500 select-none">{line.oldLineNumber ?? ''}</span>
      <span className="border-r border-white/[0.045] px-2 text-right text-slate-500 select-none">{line.newLineNumber ?? ''}</span>
      <code className="min-w-0 overflow-x-auto whitespace-pre px-3 leading-6">
        <span className="mr-2 inline-block w-3 select-none opacity-70">{marker}</span>
        {line.content}
      </code>
    </div>
  );
}

export const ProjectGitDiffDialog = memo(function ProjectGitDiffDialog({
  isOpen,
  onClose,
  projectId,
}: ProjectGitDiffDialogProps) {
  const { t } = useTranslation();
  const { gitService } = useIDEServices();
  const normalizedProjectId = projectId?.trim() ?? '';
  const [diff, setDiff] = useState<BirdCoderProjectGitDiff | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fileFilter, setFileFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const loadDiff = useCallback(async () => {
    if (!normalizedProjectId) {
      setDiff(null);
      setErrorMessage(t('code.gitDiffProjectRequired'));
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setDiff(await gitService.getProjectGitDiff(normalizedProjectId));
    } catch (error) {
      setDiff(null);
      setErrorMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : t('code.gitDiffLoadFailed'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [gitService, normalizedProjectId, t]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void loadDiff();
  }, [isOpen, loadDiff]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const files = useMemo(() => parseProjectGitDiff(diff?.patch ?? ''), [diff?.patch]);
  const visibleFiles = useMemo(() => {
    const normalizedFilter = fileFilter.trim().toLocaleLowerCase();
    return normalizedFilter
      ? files.filter((file) => file.path.toLocaleLowerCase().includes(normalizedFilter))
      : files;
  }, [fileFilter, files]);
  const selectedFile = useMemo(
    () => visibleFiles.find((file) => file.path === selectedPath) ?? visibleFiles[0],
    [selectedPath, visibleFiles],
  );
  const totals = useMemo(
    () => files.reduce(
      (summary, file) => ({
        additions: summary.additions + file.additions,
        deletions: summary.deletions + file.deletions,
      }),
      { additions: 0, deletions: 0 },
    ),
    [files],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('app.menu.viewDiff')}
        className="flex h-[min(88vh,56rem)] w-full max-w-[90rem] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#151519] shadow-2xl shadow-black/60"
      >
        <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-[#19191e] px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-blue-300/15 bg-blue-400/10 text-blue-200">
              <FileDiff size={17} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-slate-100">{t('app.menu.viewDiff')}</h2>
              {files.length > 0 ? (
                <p className="mt-0.5 text-xs text-slate-500">
                  {t('code.gitDiffFileCount', { count: files.length })}
                  <span className="mx-2 text-white/15">|</span>
                  <span className="text-emerald-300">+{totals.additions}</span>
                  <span className="ml-2 text-rose-300">-{totals.deletions}</span>
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
              aria-label={t('code.refreshGitDiff')}
              title={t('code.refreshGitDiff')}
              onClick={() => { void loadDiff(); }}
            >
              {isLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              aria-label={t('app.close')}
              title={t('app.close')}
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {diff?.truncated ? (
          <div className="flex shrink-0 items-center gap-2 border-b border-amber-300/15 bg-amber-300/[0.08] px-4 py-2 text-xs text-amber-100">
            <AlertCircle size={14} className="shrink-0 text-amber-300" aria-hidden="true" />
            {t('code.gitDiffTruncated')}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 bg-[#101014]">
          {isLoading && !diff ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 size={17} className="animate-spin" />
              <span>{t('code.loadingGitDiff')}</span>
            </div>
          ) : errorMessage ? (
            <div className="m-4 flex items-start gap-2 rounded-md border border-rose-300/20 bg-rose-400/[0.08] px-3 py-3 text-sm text-rose-100">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{errorMessage}</span>
            </div>
          ) : files.length > 0 ? (
            <div className="grid h-full min-h-0 grid-cols-[minmax(13rem,17rem)_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col border-r border-white/[0.08] bg-[#15151a]">
                <div className="border-b border-white/[0.07] px-3 py-3">
                  <label className="sr-only" htmlFor="project-git-diff-filter">{t('code.filterGitDiffFiles')}</label>
                  <div className="flex h-8 items-center gap-2 rounded-md border border-white/[0.09] bg-[#0e0e12] px-2 text-slate-500 focus-within:border-blue-400/70 focus-within:ring-1 focus-within:ring-blue-400/30">
                    <Search size={14} aria-hidden="true" />
                    <input
                      id="project-git-diff-filter"
                      value={fileFilter}
                      onChange={(event) => setFileFilter(event.target.value)}
                      placeholder={t('code.filterGitDiffFiles')}
                      className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
                    />
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                  {visibleFiles.map((file) => {
                    const isSelected = selectedFile?.path === file.path;
                    return (
                      <button
                        key={file.path}
                        type="button"
                        onClick={() => setSelectedPath(file.path)}
                        className={`group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                          isSelected ? 'bg-blue-400/[0.13] text-slate-100' : 'text-slate-400 hover:bg-white/[0.055] hover:text-slate-200'
                        }`}
                        aria-current={isSelected ? 'true' : undefined}
                      >
                        <DiffStatusIcon status={file.status} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">{getFileName(file.path)}</span>
                          {getDirectoryName(file.path) ? <span className="mt-0.5 block truncate text-[11px] text-slate-600">{getDirectoryName(file.path)}</span> : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] tabular-nums">
                          {file.additions > 0 ? <span className="text-emerald-300">+{file.additions}</span> : null}
                          {file.deletions > 0 ? <span className="text-rose-300">-{file.deletions}</span> : null}
                          <ChevronRight size={13} className={isSelected ? 'text-blue-200' : 'text-slate-700 group-hover:text-slate-500'} aria-hidden="true" />
                        </span>
                      </button>
                    );
                  })}
                  {visibleFiles.length === 0 ? (
                    <div className="px-3 py-8 text-center text-xs text-slate-600">{t('code.noGitDiffFilesMatch')}</div>
                  ) : null}
                </div>
              </aside>

              <section className="flex min-w-0 min-h-0 flex-col bg-[#0d0d11]" aria-label={selectedFile?.path}>
                {selectedFile ? (
                  <>
                    <div className="flex min-h-11 shrink-0 items-center gap-3 border-b border-white/[0.07] bg-[#16161b] px-4">
                      <DiffStatusIcon status={selectedFile.status} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-xs text-slate-200">{selectedFile.path}</div>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                        <span className="inline-flex items-center gap-1 text-emerald-300"><FilePlus2 size={13} aria-hidden="true" />{selectedFile.additions}</span>
                        <span className="inline-flex items-center gap-1 text-rose-300"><Minus size={13} aria-hidden="true" />{selectedFile.deletions}</span>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto font-mono text-xs leading-6 selection:bg-blue-500/40">
                      {selectedFile.lines.map((line, index) => <DiffLineRow key={`${line.kind}-${index}`} line={line} />)}
                    </div>
                  </>
                ) : null}
              </section>
            </div>
          ) : diff?.patch ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500">
              <FileDiff size={22} className="text-slate-600" aria-hidden="true" />
              <span>{t('code.gitDiffUnsupportedFormat')}</span>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">{t('code.noGitChanges')}</div>
          )}
        </div>
      </div>
    </div>
  );
});

ProjectGitDiffDialog.displayName = 'ProjectGitDiffDialog';
