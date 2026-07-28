import {
  CircleX,
  FolderOpen,
  Search,
  SquarePen,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  resolveSessionRuntimeStatusLabel,
  SessionRuntimeStatusSlot,
  type SessionRuntimeStatusLabels,
} from '@sdkwork/birdcoder-pc-ui';
import { buildTaskSearchEntries, type TaskSearchEntry } from './taskSearch';

const FOCUSABLE_ELEMENT_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface TaskSearchDialogLabels {
  clearSearch: string;
  newTask: string;
  noTasksFound: string;
  openFolder: string;
  recommendations: string;
  searchFiles: string;
  searchPlaceholder: string;
  selectProjectFirst: string;
  tasks: string;
}

interface TaskSearchDialogProps {
  canCreateTask: boolean;
  canSearchFiles: boolean;
  labels: TaskSearchDialogLabels;
  onClose: () => void;
  onCreateTask: () => void;
  onOpenFolder?: () => void;
  onQueryChange: (query: string) => void;
  onSearchFiles: () => void;
  onSelectTask: (entry: TaskSearchEntry) => void;
  projects: readonly AgentProjectView[];
  query: string;
  returnFocusElement?: HTMLElement | null;
  runtimeStatusLabels: SessionRuntimeStatusLabels;
  selectedProjectId?: string | null;
  selectedSessionId?: string | null;
}

function resolveShortcutModifier(): string {
  if (typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)) {
    return 'Cmd';
  }
  return 'Ctrl';
}

export function TaskSearchDialog({
  canCreateTask,
  canSearchFiles,
  labels,
  onClose,
  onCreateTask,
  onOpenFolder,
  onQueryChange,
  onSearchFiles,
  onSelectTask,
  projects,
  query,
  returnFocusElement,
  runtimeStatusLabels,
  selectedProjectId,
  selectedSessionId,
}: TaskSearchDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const resultListId = useId();
  const titleId = useId();
  const selectProjectFirstDescriptionId = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const shortcutModifier = resolveShortcutModifier();
  const entries = useMemo(
    () => buildTaskSearchEntries(projects, query),
    [projects, query],
  );
  const activeOptionId = entries[activeIndex]
    ? `${resultListId}-option-${activeIndex}`
    : undefined;

  useEffect(() => {
    previousFocusRef.current = returnFocusElement
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const animationFrame = window.requestAnimationFrame(() => inputRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(animationFrame);
      previousFocusRef.current?.focus();
    };
  }, [returnFocusElement]);

  useEffect(() => {
    const selectedIndex = query.trim()
      ? 0
      : entries.findIndex(
          (entry) =>
            entry.projectId === selectedProjectId &&
            entry.session.id === selectedSessionId,
        );
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [entries, query, selectedProjectId, selectedSessionId]);

  useEffect(() => {
    const activeResult = listRef.current?.querySelector<HTMLElement>(
      `[data-task-search-index="${activeIndex}"]`,
    );
    activeResult?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const selectEntry = (entry: TaskSearchEntry | undefined) => {
    if (entry) {
      onSelectTask(entry);
    }
  };

  const handleKeyboardNavigation = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const hasCommandModifier = (event.ctrlKey || event.metaKey) && !event.altKey;
    const eventTarget = event.target;
    const isResultNavigationTarget =
      eventTarget === inputRef.current ||
      (eventTarget instanceof Element &&
        eventTarget.closest('[data-task-search-result="true"]') !== null);
    if (hasCommandModifier && /^[1-9]$/u.test(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      const entry = entries[Number(event.key) - 1];
      if (entry) {
        selectEntry(entry);
      }
      return;
    }
    if (hasCommandModifier && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      event.stopPropagation();
      if (canCreateTask) {
        onCreateTask();
      }
      return;
    }
    if (hasCommandModifier && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      event.stopPropagation();
      onOpenFolder?.();
      return;
    }
    if (hasCommandModifier && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      event.stopPropagation();
      if (canSearchFiles) {
        onSearchFiles();
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown' && entries.length > 0 && isResultNavigationTarget) {
      event.preventDefault();
      setActiveIndex((previousIndex) => (previousIndex + 1) % entries.length);
      return;
    }
    if (event.key === 'ArrowUp' && entries.length > 0 && isResultNavigationTarget) {
      event.preventDefault();
      setActiveIndex((previousIndex) =>
        previousIndex <= 0 ? entries.length - 1 : previousIndex - 1,
      );
      return;
    }
    if (event.key === 'Home' && entries.length > 0 && isResultNavigationTarget) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === 'End' && entries.length > 0 && isResultNavigationTarget) {
      event.preventDefault();
      setActiveIndex(entries.length - 1);
      return;
    }
    if (event.key === 'Enter' && entries.length > 0 && isResultNavigationTarget) {
      event.preventDefault();
      selectEntry(entries[activeIndex] ?? entries[0]);
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENT_SELECTOR) ?? [],
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (!firstElement || !lastElement) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/65 p-3 pt-[4vh] backdrop-blur-[2px] sm:px-6 sm:pb-6 sm:pt-[4vh]"
      data-task-search-backdrop="true"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex max-h-[calc(100vh-8vh)] max-h-[calc(100dvh-8vh)] w-full max-w-[780px] flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#29292c] text-gray-100 shadow-2xl shadow-black/70"
        data-task-search-dialog="true"
        role="dialog"
        onKeyDown={handleKeyboardNavigation}
      >
        <h2 id={titleId} className="sr-only">{labels.searchPlaceholder}</h2>
        <span id={selectProjectFirstDescriptionId} className="sr-only">
          {labels.selectProjectFirst}
        </span>
        <div className="shrink-0 px-5 pb-6 pt-3">
          <div className="flex h-10 items-center gap-2">
            <input
              ref={inputRef}
              aria-activedescendant={activeOptionId}
              aria-autocomplete="list"
              aria-controls={resultListId}
              aria-expanded="true"
              aria-label={labels.searchPlaceholder}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-xl font-medium text-white outline-none placeholder:text-gray-400"
              placeholder={labels.searchPlaceholder}
              role="combobox"
              type="text"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
            {query ? (
              <button
                type="button"
                aria-label={labels.clearSearch}
                title={labels.clearSearch}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                onClick={() => {
                  onQueryChange('');
                  inputRef.current?.focus();
                }}
              >
                <CircleX size={16} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto px-2 pb-3">
          <section aria-labelledby={`${titleId}-tasks`}>
            <h3
              id={`${titleId}-tasks`}
              className="px-3 pb-2 text-base font-semibold text-gray-400"
            >
              {labels.tasks}
            </h3>
            <div
              ref={listRef}
              id={resultListId}
              aria-label={labels.tasks}
              role="listbox"
            >
              {entries.length > 0 ? entries.map((entry, index) => {
                const isActive = activeIndex === index;
                const isCurrent =
                  entry.projectId === selectedProjectId &&
                  entry.session.id === selectedSessionId;
                return (
                  <button
                    key={`${entry.projectId}:${entry.session.id}`}
                    id={`${resultListId}-option-${index}`}
                    type="button"
                    aria-keyshortcuts={`Control+${index + 1} Meta+${index + 1}`}
                    aria-selected={isActive}
                    className={`grid h-[47px] w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-[18px] px-3 text-left text-[17px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/25 sm:grid-cols-[28px_minmax(0,1fr)_150px_auto] ${
                      isActive
                        ? 'bg-white/[0.11] text-white'
                        : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                    }`}
                    data-task-search-current={isCurrent ? 'true' : undefined}
                    data-task-search-index={index}
                    data-task-search-result="true"
                    role="option"
                    tabIndex={-1}
                    onClick={() => selectEntry(entry)}
                    onFocus={() => setActiveIndex(index)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <span className="flex h-7 w-7 items-center justify-center">
                      <SessionRuntimeStatusSlot
                        label={resolveSessionRuntimeStatusLabel(
                          entry.session.runtimeStatus,
                          runtimeStatusLabels,
                        )}
                        runtimeStatus={entry.session.runtimeStatus}
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {entry.session.title}
                    </span>
                    <span
                      className="hidden w-[150px] truncate text-base text-gray-400/80 sm:block"
                      title={entry.projectName}
                    >
                      {entry.projectName}
                    </span>
                    <kbd className="shrink-0 rounded-lg bg-white/[0.07] px-2 py-1 text-sm font-medium text-gray-400">
                      {shortcutModifier}+{index + 1}
                    </kbd>
                  </button>
                );
              }) : (
                <div
                  className="flex min-h-24 items-center justify-center px-4 text-sm text-gray-500"
                  data-task-search-empty="true"
                  role="status"
                >
                  {labels.noTasksFound}
                </div>
              )}
            </div>
          </section>

          <section className="mt-2" aria-labelledby={`${titleId}-recommendations`}>
            <h3
              id={`${titleId}-recommendations`}
              className="px-3 pb-2 text-base font-semibold text-gray-400"
            >
              {labels.recommendations}
            </h3>
            <div className="space-y-0.5">
              <button
                type="button"
                aria-describedby={!canCreateTask ? selectProjectFirstDescriptionId : undefined}
                aria-keyshortcuts="Control+N Meta+N"
                className="grid h-[47px] w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-[18px] px-3 text-left text-[17px] text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canCreateTask}
                title={canCreateTask ? undefined : labels.selectProjectFirst}
                onClick={onCreateTask}
              >
                <SquarePen size={20} className="justify-self-center text-gray-400" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-medium">{labels.newTask}</span>
                <kbd className="shrink-0 rounded-lg bg-white/[0.07] px-2 py-1 text-sm text-gray-400">
                  {shortcutModifier}+N
                </kbd>
              </button>
              {onOpenFolder ? (
                <button
                  type="button"
                  aria-keyshortcuts="Control+O Meta+O"
                  className="grid h-[47px] w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-[18px] px-3 text-left text-[17px] text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                  onClick={onOpenFolder}
                >
                  <FolderOpen size={20} className="justify-self-center text-gray-400" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-medium">{labels.openFolder}</span>
                  <kbd className="shrink-0 rounded-lg bg-white/[0.07] px-2 py-1 text-sm text-gray-400">
                    {shortcutModifier}+O
                  </kbd>
                </button>
              ) : null}
              <button
                type="button"
                aria-describedby={!canSearchFiles ? selectProjectFirstDescriptionId : undefined}
                aria-keyshortcuts="Control+P Meta+P"
                className="grid h-[47px] w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-[18px] px-3 text-left text-[17px] text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canSearchFiles}
                title={canSearchFiles ? undefined : labels.selectProjectFirst}
                onClick={onSearchFiles}
              >
                <Search size={20} className="justify-self-center text-gray-400" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-medium">{labels.searchFiles}</span>
                <kbd className="shrink-0 rounded-lg bg-white/[0.07] px-2 py-1 text-sm text-gray-400">
                  {shortcutModifier}+P
                </kbd>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
