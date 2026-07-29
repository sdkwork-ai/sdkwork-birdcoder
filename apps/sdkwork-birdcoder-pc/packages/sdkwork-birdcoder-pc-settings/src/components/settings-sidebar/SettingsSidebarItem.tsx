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
      className={`flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400/70 ${
        isActive
          ? 'bg-white/[0.10] text-white'
          : 'text-[#d2d3d6] hover:bg-white/[0.055] hover:text-white'
      }`}
      onClick={() => onSelect(tab)}
      title={label}
    >
      <Icon aria-hidden="true" className="h-[15px] w-[15px] shrink-0" strokeWidth={1.8} />
      <span className="truncate font-medium">{label}</span>
    </button>
  );
}
