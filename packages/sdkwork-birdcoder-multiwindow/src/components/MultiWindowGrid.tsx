import type { WorkbenchPreferences } from '@sdkwork/birdcoder-commons';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PanelsTopLeft, Plus } from 'lucide-react';

import {
  resolveMultiWindowGridClassName,
} from '../runtime/multiWindowLayout.ts';
import type {
  MultiWindowDispatchPaneResult,
} from '../runtime/multiWindowDispatch.ts';
import type {
  MultiWindowPaneDispatchability,
} from '../runtime/multiWindowDispatchability.ts';
import type {
  MultiWindowPaneBinding,
  MultiWindowPaneConfig,
} from '../types.ts';
import { MultiWindowPane } from './MultiWindowPane.tsx';

interface MultiWindowGridProps {
  bindingsByPaneId: ReadonlyMap<string, MultiWindowPaneBinding>;
  dispatchResultsByPaneId: ReadonlyMap<string, MultiWindowDispatchPaneResult>;
  paneDispatchabilityByPaneId: ReadonlyMap<string, MultiWindowPaneDispatchability>;
  panes: readonly MultiWindowPaneConfig[];
  preferences: WorkbenchPreferences;
  retryableFailedPaneIds: ReadonlySet<string>;
  windowCount: number;
  onAddWindow: () => void;
  onClosePane: (paneId: string) => void;
  onOpenSessionPicker: (paneId: string) => void;
  onPaneChange: (pane: MultiWindowPaneConfig) => void;
  onRetryPane: (paneId: string) => void;
}

export const MultiWindowGrid = memo(function MultiWindowGrid({
  bindingsByPaneId,
  dispatchResultsByPaneId,
  paneDispatchabilityByPaneId,
  panes,
  preferences,
  retryableFailedPaneIds,
  windowCount,
  onAddWindow,
  onClosePane,
  onOpenSessionPicker,
  onPaneChange,
  onRetryPane,
}: MultiWindowGridProps) {
  const { t } = useTranslation();
  const visiblePanes = panes.slice(0, windowCount);

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#0e0e11] p-3">
      {visiblePanes.length === 0 ? (
        <div className="flex min-h-full items-center justify-center">
          <div className="flex max-w-sm flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/[0.06] text-blue-200 ring-1 ring-white/10">
              <PanelsTopLeft size={22} />
            </div>
            <div className="mt-4 text-sm font-semibold text-gray-100">{t('multiWindow.emptyTitle')}</div>
            <div className="mt-2 text-xs leading-5 text-gray-500">{t('multiWindow.emptyDescription')}</div>
            <button
              type="button"
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-500"
              onClick={onAddWindow}
            >
              <Plus size={14} />
              {t('multiWindow.addWindow')}
            </button>
          </div>
        </div>
      ) : (
      <div
        className={`grid min-h-full auto-rows-[minmax(360px,1fr)] gap-3 ${resolveMultiWindowGridClassName(windowCount)}`}
      >
        {visiblePanes.map((pane, paneIndex) => (
          <MultiWindowPane
            key={pane.id}
            binding={bindingsByPaneId.get(pane.id) ?? null}
            canRetryPane={retryableFailedPaneIds.has(pane.id)}
            dispatchability={paneDispatchabilityByPaneId.get(pane.id)}
            dispatchResult={dispatchResultsByPaneId.get(pane.id)}
            pane={pane}
            paneIndex={paneIndex}
            preferences={preferences}
            runtimeStatus={dispatchResultsByPaneId.get(pane.id)?.status ?? 'idle'}
            runtimeStatusMessage={dispatchResultsByPaneId.get(pane.id)?.errorMessage}
            onChange={onPaneChange}
            onClose={() => onClosePane(pane.id)}
            onOpenSessionPicker={() => onOpenSessionPicker(pane.id)}
            onRetryPane={() => onRetryPane(pane.id)}
          />
        ))}
      </div>
      )}
    </div>
  );
});

MultiWindowGrid.displayName = 'MultiWindowGrid';
