import { AlertCircle, Loader2, RefreshCw, SearchX } from 'lucide-react';
import type { PluginSettingsCapabilityItem, PluginSettingsTab } from './pluginSettingsTypes';
import { PluginCapabilityRow } from './PluginCapabilityRow';

interface PluginCapabilityListProps {
  activeTab: PluginSettingsTab;
  disabledCapabilityIds: ReadonlySet<string>;
  emptyDescription: string;
  emptyTitle: string;
  errorDescription: string;
  errorTitle: string;
  getPreferenceId: (item: PluginSettingsCapabilityItem) => string;
  isLoading: boolean;
  items: readonly PluginSettingsCapabilityItem[];
  loadingLabel: string;
  onEnabledChange: (item: PluginSettingsCapabilityItem, enabled: boolean) => void;
  onRetry: () => void;
  retryLabel: string;
  unavailableLabel: string;
}

export function PluginCapabilityList({
  activeTab,
  disabledCapabilityIds,
  emptyDescription,
  emptyTitle,
  errorDescription,
  errorTitle,
  getPreferenceId,
  isLoading,
  items,
  loadingLabel,
  onEnabledChange,
  onRetry,
  retryLabel,
  unavailableLabel,
}: PluginCapabilityListProps) {
  if (isLoading) {
    return (
      <div className="flex min-h-28 items-center justify-center gap-2 text-[12px] text-[#85868b]" role="status">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        {loadingLabel}
      </div>
    );
  }

  if (errorDescription && items.length === 0) {
    return (
      <div className="flex min-h-36 flex-col items-center justify-center text-center" role="alert">
        <AlertCircle aria-hidden="true" className="mb-2 h-5 w-5 text-amber-300/80" />
        <p className="text-[12px] font-semibold text-[#d7d7d9]">{errorTitle}</p>
        <p className="mt-1 max-w-sm text-[11px] leading-4 text-[#7f8085]">{errorDescription}</p>
        <button
          className="mt-3 inline-flex h-7 items-center gap-1.5 rounded-md border border-white/[0.1] px-2.5 text-[11px] text-[#b7b8bc] outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-blue-400/70"
          onClick={onRetry}
          type="button"
        >
          <RefreshCw aria-hidden="true" className="h-3 w-3" />
          {retryLabel}
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-36 flex-col items-center justify-center text-center">
        <SearchX aria-hidden="true" className="mb-2 h-5 w-5 text-[#6f7075]" />
        <p className="text-[12px] font-semibold text-[#c8c8cb]">{emptyTitle}</p>
        <p className="mt-1 text-[11px] text-[#77787d]">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div
      aria-labelledby={`plugin-settings-tab-${activeTab}`}
      id="plugin-settings-capability-list"
      role="tabpanel"
    >
      {items.map((item) => {
        const preferenceId = getPreferenceId(item);
        const enabled = item.capability.status !== 'unavailable'
          && !disabledCapabilityIds.has(preferenceId);
        return (
          <PluginCapabilityRow
            activeTab={activeTab}
            enabled={enabled}
            item={item}
            key={preferenceId}
            onEnabledChange={(nextEnabled) => onEnabledChange(item, nextEnabled)}
            unavailableLabel={unavailableLabel}
          />
        );
      })}
    </div>
  );
}
