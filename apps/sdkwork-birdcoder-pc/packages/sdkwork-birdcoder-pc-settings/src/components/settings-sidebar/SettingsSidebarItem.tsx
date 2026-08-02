import type { LucideIcon } from 'lucide-react';
import type { KeyboardEvent } from 'react';

import type { SettingsTab } from './settingsSidebarNavigation';

interface SettingsSidebarItemProps {
  icon: LucideIcon;
  isActive: boolean;
  isCollapsed: boolean;
  label: string;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, tab: SettingsTab) => void;
  onSelect: (tab: SettingsTab) => void;
  tab: SettingsTab;
}

export function SettingsSidebarItem({
  icon: Icon,
  isActive,
  isCollapsed,
  label,
  onKeyDown,
  onSelect,
  tab,
}: SettingsSidebarItemProps) {
  return (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      aria-label={label}
      className={`flex h-8 w-full min-w-0 items-center rounded-md text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--sdk-color-border-focus)] ${
        isCollapsed ? 'justify-center px-0' : 'gap-2 px-2 text-left'
      } ${
        isActive
          ? 'bg-[var(--birdcoder-chrome-selection)] text-[var(--sdk-color-text-primary)]'
          : 'text-[var(--sdk-color-text-secondary)] hover:bg-[var(--birdcoder-chrome-surface-hover)] hover:text-[var(--sdk-color-text-primary)]'
      }`}
      data-settings-tab={tab}
      onClick={() => onSelect(tab)}
      onKeyDown={(event) => onKeyDown(event, tab)}
      title={label}
    >
      <Icon aria-hidden="true" className="h-[15px] w-[15px] shrink-0" strokeWidth={1.8} />
      <span className={isCollapsed ? 'sr-only' : 'truncate font-medium'}>{label}</span>
    </button>
  );
}
