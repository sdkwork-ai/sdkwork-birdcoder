import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface IntegrationSettingsPageProps {
  children: ReactNode;
  description: ReactNode;
  title: string;
}

export function IntegrationSettingsPage({
  children,
  description,
  title,
}: IntegrationSettingsPageProps) {
  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-[#141416] px-6 pb-20 pt-[54px] sm:px-10">
      <div className="mx-auto w-full max-w-[616px] animate-in fade-in fill-mode-both">
        <h1 className="text-xl font-semibold leading-7 text-[#ededee]">{title}</h1>
        <div className="mt-1 text-[12px] leading-5 text-[#8e8f93]">{description}</div>
        {children}
      </div>
    </main>
  );
}

interface IntegrationSettingsSectionProps {
  action?: ReactNode;
  children: ReactNode;
  title: string;
}

export function IntegrationSettingsSection({
  action,
  children,
  title,
}: IntegrationSettingsSectionProps) {
  return (
    <section className="mt-9">
      <div className="mb-2.5 flex min-h-7 items-center justify-between gap-3">
        <h2 className="text-[12px] font-semibold text-[#d8d8da]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function IntegrationSettingsCard({
  ariaLabel,
  children,
}: {
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="overflow-hidden rounded-lg border border-white/[0.065] bg-[#222224]"
    >
      {children}
    </div>
  );
}

interface IntegrationSettingsRowProps {
  children: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  title: string;
}

export function IntegrationSettingsRow({
  children,
  description,
  icon,
  title,
}: IntegrationSettingsRowProps) {
  return (
    <div className="flex min-h-[49px] flex-col gap-2 border-b border-white/[0.055] px-3.5 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3 pr-5">
        {icon}
        <div className="min-w-0">
          <div className="text-[12px] font-semibold leading-4 text-[#ededee]">{title}</div>
          {description ? (
            <div className="mt-0.5 text-[11px] leading-[15px] text-[#8e8f93]">
              {description}
            </div>
          ) : null}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

interface IntegrationSettingsButtonProps {
  ariaLabel?: string;
  children: ReactNode;
  disabled?: boolean;
  icon?: LucideIcon;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'default' | 'quiet';
}

export function IntegrationSettingsButton({
  ariaLabel,
  children,
  disabled = false,
  icon: Icon,
  onClick,
  type = 'button',
  variant = 'default',
}: IntegrationSettingsButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:cursor-not-allowed disabled:opacity-45 ${
        variant === 'quiet'
          ? 'text-[#a4a5aa] hover:bg-white/[0.055] hover:text-[#ededee]'
          : 'bg-white/[0.065] text-[#d4d4d6] hover:bg-white/[0.095]'
      }`}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {Icon ? <Icon aria-hidden="true" className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}

interface IntegrationSettingsSelectOption<TValue extends string> {
  label: string;
  value: TValue;
}

interface IntegrationSettingsSelectProps<TValue extends string> {
  ariaLabel: string;
  disabled?: boolean;
  onChange: (value: TValue) => void;
  options: readonly IntegrationSettingsSelectOption<TValue>[];
  value: TValue;
}

export function IntegrationSettingsSelect<TValue extends string>({
  ariaLabel,
  disabled = false,
  onChange,
  options,
  value,
}: IntegrationSettingsSelectProps<TValue>) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        className="h-7 min-w-[110px] appearance-none rounded-md border border-white/[0.06] bg-white/[0.04] pl-2.5 pr-7 text-[11px] text-[#d7d7d9] outline-none hover:bg-white/[0.065] focus:border-blue-400/60 disabled:cursor-not-allowed disabled:opacity-45"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as TValue)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#77787d]"
      />
    </div>
  );
}

interface IntegrationSettingsSwitchProps {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}

export function IntegrationSettingsSwitch({
  checked,
  disabled = false,
  label,
  onCheckedChange,
}: IntegrationSettingsSwitchProps) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`relative h-4 w-7 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400/70 ${
        checked ? 'bg-[#2f8df4]' : 'bg-[#55565a]'
      } disabled:cursor-not-allowed disabled:opacity-45`}
      disabled={disabled}
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

export function IntegrationStatus({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'positive' | 'warning';
}) {
  const color = tone === 'positive'
    ? 'bg-emerald-400'
    : tone === 'warning'
      ? 'bg-red-400'
      : 'bg-[#77787d]';
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] leading-4 text-[#85868b]">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
