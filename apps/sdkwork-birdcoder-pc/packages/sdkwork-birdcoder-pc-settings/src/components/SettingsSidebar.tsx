import { useMemo, useState } from 'react';
import { ArrowLeft, LogOut, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { SettingsSidebarItem } from './settings-sidebar/SettingsSidebarItem';
import {
  SETTINGS_NAVIGATION_GROUPS,
  type SettingsTab,
} from './settings-sidebar/settingsSidebarNavigation';

export type { SettingsTab } from './settings-sidebar/settingsSidebarNavigation';

interface SettingsSidebarProps {
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
  onBack?: () => void;
  onLogout: () => void;
}

export function SettingsSidebar({ activeTab, setActiveTab, onBack, onLogout }: SettingsSidebarProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const visibleGroups = useMemo(
    () => SETTINGS_NAVIGATION_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        t(item.labelKey).toLocaleLowerCase().includes(normalizedSearchQuery),
      ),
    })).filter((group) => group.items.length > 0),
    [normalizedSearchQuery, t],
  );

  return (
    <aside
      className="relative flex h-full w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#1b1d21] text-sm xl:w-[292px]"
      aria-label={t('settings.sidebar.navigationLabel')}
    >
      <div className="shrink-0 px-2 pb-2 pt-2">
        {onBack ? (
          <button
            type="button"
            className="mb-2 flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-[#a8aaae] outline-none transition-colors hover:bg-white/[0.055] hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400/70"
            onClick={onBack}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span className="truncate">{t('common.backToApp')}</span>
          </button>
        ) : null}

        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#85878c]"
            strokeWidth={1.8}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label={t('settings.sidebar.searchPlaceholder')}
            placeholder={t('settings.sidebar.searchPlaceholder')}
            className="h-8 w-full rounded-md border border-white/[0.075] bg-white/[0.045] pl-8 pr-8 text-xs text-white outline-none placeholder:text-[#7d7f84] transition-colors hover:border-white/[0.12] focus:border-blue-400/60 focus:bg-white/[0.06] focus:ring-1 focus:ring-blue-400/30"
          />
          {searchQuery ? (
            <button
              type="button"
              aria-label={t('settings.sidebar.clearSearch')}
              className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-[#85878c] outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400/70"
              onClick={() => setSearchQuery('')}
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label={t('settings.sidebar.navigationLabel')}>
        {visibleGroups.map((group) => (
          <section key={group.id} className="mt-2" aria-labelledby={`settings-group-${group.id}`}>
            <h2
              id={`settings-group-${group.id}`}
              className="px-2 pb-1 pt-1 text-[11px] font-medium text-[#777a80]"
            >
              {t(group.labelKey)}
            </h2>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SettingsSidebarItem
                  key={item.id}
                  icon={item.icon}
                  isActive={activeTab === item.id}
                  label={t(item.labelKey)}
                  onSelect={setActiveTab}
                  tab={item.id}
                />
              ))}
            </div>
          </section>
        ))}

        {visibleGroups.length === 0 ? (
          <div className="px-2 py-8 text-center text-xs text-[#85878c]">
            {t('settings.sidebar.noResults')}
          </div>
        ) : null}
      </nav>

      <div className="shrink-0 border-t border-white/[0.06] p-2">
        <button
          type="button"
          onClick={onLogout}
          className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-[#d2d3d6] outline-none transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-400/70"
        >
          <LogOut aria-hidden="true" className="h-[15px] w-[15px] shrink-0" strokeWidth={1.8} />
          <span className="truncate font-medium">{t('common.signOut')}</span>
        </button>
      </div>
    </aside>
  );
}
