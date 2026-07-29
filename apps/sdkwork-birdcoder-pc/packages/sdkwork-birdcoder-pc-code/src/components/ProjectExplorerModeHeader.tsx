import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import type { WorkbenchMode } from '@sdkwork/birdcoder-pc-workbench/workbench/workbenchMode';

interface ProjectExplorerModeHeaderProps {
  activeMode: WorkbenchMode;
  codingModeDescription: string;
  codingModeLabel: string;
  searchLabel: string;
  showSearch: boolean;
  switchModeLabel: string;
  workModeDescription: string;
  workModeLabel: string;
  onModeChange: (mode: WorkbenchMode) => void;
  onToggleSearch: (trigger: HTMLButtonElement) => void;
}

const MODE_OPTIONS: readonly WorkbenchMode[] = ['work', 'coding'];

export function ProjectExplorerModeHeader({
  activeMode,
  codingModeDescription,
  codingModeLabel,
  searchLabel,
  showSearch,
  switchModeLabel,
  workModeDescription,
  workModeLabel,
  onModeChange,
  onToggleSearch,
}: ProjectExplorerModeHeaderProps) {
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isModeMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!modeMenuRef.current?.contains(event.target as Node)) {
        setIsModeMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsModeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModeMenuOpen]);

  return (
    <header
      className="relative z-30 flex h-12 shrink-0 items-center justify-between px-2.5"
      data-sidebar-brand-header="true"
      data-workbench-mode={activeMode}
    >
      <div ref={modeMenuRef} className="relative min-w-0">
        <button
          type="button"
          aria-expanded={isModeMenuOpen}
          aria-haspopup="menu"
          aria-label={switchModeLabel}
          className="flex h-7 max-w-full items-center gap-1 rounded-md px-1.5 text-[15px] font-semibold text-gray-100 transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.06] focus-visible:outline-none"
          data-sidebar-mode-trigger="true"
          onClick={() => setIsModeMenuOpen((isOpen) => !isOpen)}
        >
          <span className="min-w-0 truncate">Birdcoder</span>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={`shrink-0 text-gray-500 transition-transform ${isModeMenuOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isModeMenuOpen ? (
          <div
            className="birdcoder-chrome-menu absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border py-1.5 text-left shadow-2xl backdrop-blur-xl"
            data-sidebar-mode-menu="true"
            role="menu"
          >
            {MODE_OPTIONS.map((mode) => {
              const isSelected = mode === activeMode;
              const label = mode === 'work' ? workModeLabel : codingModeLabel;
              const description = mode === 'work'
                ? workModeDescription
                : codingModeDescription;
              return (
                <button
                  key={mode}
                  type="button"
                  aria-checked={isSelected}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/[0.07] focus-visible:bg-white/[0.07] focus-visible:outline-none"
                  data-sidebar-mode-option={mode}
                  role="menuitemradio"
                  onClick={() => {
                    onModeChange(mode);
                    setIsModeMenuOpen(false);
                  }}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[13px] font-medium text-gray-100">{label}</span>
                    <span className="truncate text-[11px] text-gray-500">{description}</span>
                  </span>
                  {isSelected ? (
                    <Check size={15} className="shrink-0 text-gray-300" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        aria-expanded={showSearch}
        aria-haspopup="dialog"
        aria-label={searchLabel}
        title={searchLabel}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/[0.07] hover:text-gray-200 focus-visible:bg-white/[0.07] focus-visible:text-gray-200 focus-visible:outline-none ${showSearch ? 'bg-white/[0.07] text-gray-200' : ''}`}
        data-sidebar-search-trigger="true"
        onClick={(event) => onToggleSearch(event.currentTarget)}
      >
        <Search size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </header>
  );
}
