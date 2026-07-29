import { Search, X } from 'lucide-react';
import type { PluginSettingsTab, PluginSettingsTabDefinition } from './pluginSettingsTypes';

interface PluginSettingsToolbarProps {
  activeTab: PluginSettingsTab;
  clearSearchLabel: string;
  onActiveTabChange: (tab: PluginSettingsTab) => void;
  onSearchQueryChange: (query: string) => void;
  searchLabel: string;
  searchPlaceholder: string;
  searchQuery: string;
  tabs: readonly PluginSettingsTabDefinition[];
}

export function PluginSettingsToolbar({
  activeTab,
  clearSearchLabel,
  onActiveTabChange,
  onSearchQueryChange,
  searchLabel,
  searchPlaceholder,
  searchQuery,
  tabs,
}: PluginSettingsToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div aria-label={searchLabel} className="flex items-center gap-1" role="tablist">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              aria-label={`${tab.label} ${tab.count}`}
              aria-controls="plugin-settings-capability-list"
              aria-selected={isActive}
              className={`h-7 rounded-md px-2.5 text-[12px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400/70 ${
                isActive
                  ? 'bg-white/[0.075] font-semibold text-[#ededee]'
                  : 'text-[#8e8f93] hover:bg-white/[0.04] hover:text-[#c7c8ca]'
              }`}
              id={`plugin-settings-tab-${tab.id}`}
              key={tab.id}
              onClick={() => onActiveTabChange(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
              <span className={`ml-1 ${isActive ? 'text-[#a9aaae]' : 'text-[#6f7075]'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative w-full sm:w-[168px]">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7e7f84]"
          strokeWidth={1.8}
        />
        <input
          aria-label={searchLabel}
          className="h-8 w-full rounded-md border border-white/[0.11] bg-[#222224] pl-8 pr-8 text-[12px] text-[#ededee] outline-none placeholder:text-[#77787d] transition-colors hover:border-white/[0.17] focus:border-[#3b82f6]/70 focus:ring-1 focus:ring-[#3b82f6]/20"
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={searchPlaceholder}
          type="search"
          value={searchQuery}
        />
        {searchQuery ? (
          <button
            aria-label={clearSearchLabel}
            className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-[#85868b] outline-none hover:bg-white/[0.07] hover:text-[#d4d4d6] focus-visible:ring-2 focus-visible:ring-blue-400/70"
            onClick={() => onSearchQueryChange('')}
            type="button"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
