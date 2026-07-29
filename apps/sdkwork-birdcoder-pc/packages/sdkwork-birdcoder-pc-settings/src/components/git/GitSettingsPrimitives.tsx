import type { ReactNode } from 'react';

export function GitSettingsCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.065] bg-[#222224]">
      {children}
    </div>
  );
}

interface GitSettingsRowProps {
  children: ReactNode;
  description: ReactNode;
  title: string;
}

export function GitSettingsRow({ children, description, title }: GitSettingsRowProps) {
  return (
    <div className="flex min-h-[49px] flex-col gap-2 border-b border-white/[0.055] px-3.5 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 pr-5">
        <div className="text-[12px] font-semibold leading-4 text-[#ededee]">{title}</div>
        <div className="mt-0.5 text-[11px] leading-[15px] text-[#8e8f93]">{description}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

interface GitSettingsSwitchProps {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}

export function GitSettingsSwitch({
  checked,
  label,
  onCheckedChange,
}: GitSettingsSwitchProps) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`relative h-4 w-7 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400/70 ${
        checked ? 'bg-[#2f8df4]' : 'bg-[#55565a]'
      }`}
      onClick={() => onCheckedChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-3.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

interface GitSegmentedControlOption<TValue extends string> {
  label: string;
  value: TValue;
}

interface GitSegmentedControlProps<TValue extends string> {
  ariaLabel: string;
  onChange: (value: TValue) => void;
  options: readonly GitSegmentedControlOption<TValue>[];
  value: TValue;
}

export function GitSegmentedControl<TValue extends string>({
  ariaLabel,
  onChange,
  options,
  value,
}: GitSegmentedControlProps<TValue>) {
  return (
    <div aria-label={ariaLabel} className="flex items-center gap-0.5" role="radiogroup">
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            aria-checked={isSelected}
            className={`h-6 rounded-md px-2 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400/70 ${
              isSelected
                ? 'bg-white/[0.075] font-medium text-[#e5e5e7]'
                : 'text-[#929398] hover:bg-white/[0.04] hover:text-[#c7c8ca]'
            }`}
            key={option.value}
            onClick={() => onChange(option.value)}
            role="radio"
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
