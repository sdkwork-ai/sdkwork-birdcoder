import type { ReactNode } from 'react';

interface VoiceSettingsSectionProps {
  children: ReactNode;
  title: string;
}

export function VoiceSettingsSection({ children, title }: VoiceSettingsSectionProps) {
  return (
    <section className="mt-7">
      <h2 className="mb-2.5 text-sm font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

export function VoiceSettingsCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.07] bg-[#1b1b1d]">
      {children}
    </div>
  );
}

interface VoiceSettingsRowProps {
  children: ReactNode;
  description: string;
  title: string;
}

export function VoiceSettingsRow({ children, description, title }: VoiceSettingsRowProps) {
  return (
    <div className="flex min-h-12 flex-col gap-2.5 border-b border-white/[0.065] px-4 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 pr-4">
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="mt-0.5 text-xs leading-4 text-[#8b8d92]">{description}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

interface VoiceSettingsSwitchProps {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}

export function VoiceSettingsSwitch({
  checked,
  label,
  onCheckedChange,
}: VoiceSettingsSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="relative h-5 w-9 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400/70"
      style={{ backgroundColor: checked ? '#3b82f6' : '#3a3b3f' }}
      onClick={() => onCheckedChange(!checked)}
    >
      <span
        aria-hidden="true"
        className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
        style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
      />
    </button>
  );
}

interface VoiceStatusBadgeProps {
  label: string;
  tone?: 'neutral' | 'positive' | 'warning';
}

export function VoiceStatusBadge({ label, tone = 'neutral' }: VoiceStatusBadgeProps) {
  const toneClass = {
    neutral: 'bg-white/[0.065] text-[#b7b8bc]',
    positive: 'bg-emerald-500/10 text-emerald-300',
    warning: 'bg-amber-500/10 text-amber-300',
  }[tone];

  return (
    <span className={`inline-flex min-h-6 items-center rounded-md px-2 text-xs font-medium ${toneClass}`}>
      {label}
    </span>
  );
}
