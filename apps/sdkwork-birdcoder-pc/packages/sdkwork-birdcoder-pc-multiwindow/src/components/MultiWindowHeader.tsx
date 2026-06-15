import { MessageSquare, Monitor, Plus } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  MAX_MULTI_WINDOW_PANES,
  MULTI_WINDOW_LAYOUT_COUNTS,
  type MultiWindowLayoutCount,
} from '../runtime/multiWindowLayout.ts';
import type {
  MultiWindowDispatchState,
  MultiWindowGlobalMode,
} from '../types.ts';

interface MultiWindowHeaderProps {
  dispatchablePaneCount: number;
  dispatchState: MultiWindowDispatchState;
  windowCount: number;
  onAddWindow: () => void;
  onSetAllPaneModes: (mode: MultiWindowGlobalMode) => void;
  onWindowCountChange: (count: MultiWindowLayoutCount) => void;
}

function resolveDispatchTone(dispatchState: MultiWindowDispatchState): string {
  if (dispatchState === 'success') {
    return 'text-emerald-300';
  }
  if (dispatchState === 'failed' || dispatchState === 'partial-failure') {
    return 'text-red-300';
  }
  if (dispatchState === 'running') {
    return 'text-blue-300';
  }
  if (dispatchState === 'cancelled') {
    return 'text-amber-300';
  }
  return 'text-gray-500';
}

export const MultiWindowHeader = memo(function MultiWindowHeader({
  dispatchablePaneCount,
  dispatchState,
  windowCount,
  onAddWindow,
  onSetAllPaneModes,
  onWindowCountChange,
}: MultiWindowHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="shrink-0 border-b border-white/[0.08] bg-[#101114]/95 px-3 py-2 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-end gap-2">
        <div className="flex h-8 items-center rounded-lg border border-white/10 bg-white/[0.03] p-1">
          {MULTI_WINDOW_LAYOUT_COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              className={`h-6 min-w-7 rounded-md px-2 text-xs font-medium transition-colors ${
                count === windowCount
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:bg-white/5 hover:text-gray-200'
              }`}
              onClick={() => onWindowCountChange(count)}
              title={t('multiWindow.windowCountOption', { count })}
            >
              {count}
            </button>
          ))}
        </div>

        <div className="flex h-8 items-center rounded-lg border border-white/10 bg-white/[0.03] p-1">
          <button
            type="button"
            className="flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            onClick={() => onSetAllPaneModes('chat')}
            title={t('multiWindow.allChat')}
          >
            <MessageSquare size={13} />
            {t('multiWindow.chatMode')}
          </button>
          <button
            type="button"
            className="flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            onClick={() => onSetAllPaneModes('preview')}
            title={t('multiWindow.allPreview')}
          >
            <Monitor size={13} />
            {t('multiWindow.previewMode')}
          </button>
        </div>

        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-lg bg-white/10 px-3 text-xs font-medium text-gray-200 transition-colors hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
          disabled={windowCount >= MAX_MULTI_WINDOW_PANES}
          onClick={onAddWindow}
        >
          <Plus size={14} />
          {t('multiWindow.addWindow')}
        </button>
        <span className="hidden h-8 items-center rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-[11px] text-gray-400 md:inline-flex">
          {t('multiWindow.readyWindowCount', {
            ready: dispatchablePaneCount,
            total: windowCount,
          })}
        </span>
        <span className={`hidden h-8 items-center rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-[11px] sm:inline-flex ${resolveDispatchTone(dispatchState)}`}>
          {t(`multiWindow.dispatchState.${dispatchState}`)}
        </span>
      </div>
    </header>
  );
});

MultiWindowHeader.displayName = 'MultiWindowHeader';
