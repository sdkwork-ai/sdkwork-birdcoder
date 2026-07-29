import type { LucideIcon } from 'lucide-react';

import type { SettingsTab } from './settingsSidebarNavigation';

interface SettingsSidebarItemProps {
  icon: LucideIcon;
  isActive: boolean;
  label: string;
  onSelect: (tab: SettingsTab) => void;
  tab: SettingsTab;
}

export function SettingsSidebarItem({
  icon: Icon,
  isActive,
  label,
  onSelect,
  tab,
}: SettingsSidebarItemProps) {
  return (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      className={`flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--sdk-color-border-focus)] ${
        isActive
          ? 'bg-[var(--birdcoder-chrome-selection)] text-[var(--sdk-color-text-primary)]'
          : 'text-[var(--sdk-color-text-secondary)] hover:bg-[var(--birdcoder-chrome-surface-hover)] hover:text-[var(--sdk-color-text-primary)]'
      }`}
      onClick={() => onSelect(tab)}
      title={label}
    >
      <Icon aria-hidden="true" className="h-[15px] w-[15px] shrink-0" strokeWidth={1.8} />
      <span className="truncate font-medium">{label}</span>
    </button>
  );
}
