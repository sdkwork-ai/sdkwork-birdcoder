import { Blocks, ServerCog, Sparkles } from 'lucide-react';
import type { PluginSettingsCapabilityItem, PluginSettingsTab } from './pluginSettingsTypes';

interface PluginCapabilityRowProps {
  activeTab: PluginSettingsTab;
  enabled: boolean;
  item: PluginSettingsCapabilityItem;
  onEnabledChange: (enabled: boolean) => void;
  unavailableLabel: string;
}

const CAPABILITY_ICON = {
  plugins: Blocks,
  mcp: ServerCog,
  skills: Sparkles,
} as const;

export function PluginCapabilityRow({
  activeTab,
  enabled,
  item,
  onEnabledChange,
  unavailableLabel,
}: PluginCapabilityRowProps) {
  const Icon = CAPABILITY_ICON[activeTab];
  const isUnavailable = item.capability.status === 'unavailable';

  return (
    <div className="flex min-h-[52px] items-center gap-3 border-b border-white/[0.045] px-1 py-2.5 last:border-b-0">
      <span
        aria-hidden="true"
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
          activeTab === 'plugins'
            ? 'border-sky-300/25 bg-sky-400/90 text-white'
            : activeTab === 'mcp'
              ? 'border-emerald-300/15 bg-emerald-500/10 text-emerald-300'
              : 'border-fuchsia-300/15 bg-fuchsia-500/10 text-fuchsia-300'
        }`}
      >
        <Icon className="h-4 w-4" strokeWidth={1.9} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold leading-4 text-[#ededee]">
          {item.capability.name}
        </span>
        <span className="mt-0.5 block truncate text-[11px] leading-4 text-[#87888d]">
          {item.capability.description}
        </span>
      </span>

      {isUnavailable ? (
        <span className="shrink-0 text-[11px] text-[#77787d]">{unavailableLabel}</span>
      ) : null}
      <button
        aria-checked={enabled}
        aria-label={item.capability.name}
        className={`relative h-4 w-7 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400/70 ${
          enabled ? 'bg-[#2f8df4]' : 'bg-[#55565a]'
        } ${isUnavailable ? 'cursor-not-allowed opacity-40' : ''}`}
        disabled={isUnavailable}
        onClick={() => onEnabledChange(!enabled)}
        role="switch"
        type="button"
      >
        <span
          aria-hidden="true"
          className={`absolute left-0 top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
            enabled ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
