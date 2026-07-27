import { cn } from '../lib/utils';
import {
  resolveProviderVisualIdentity,
  resolveProviderVisualToneClassName,
} from './providerVisualIdentity';

export interface WorkbenchCodeEngineIconProps {
  engineId: string | null | undefined;
  className?: string;
  labelClassName?: string;
  size?: 'sm' | 'md';
}

const SIZE_CLASS_BY_ID = {
  md: 'h-7 min-w-7 px-2 text-[11px]',
  sm: 'h-5 min-w-5 px-1.5 text-[9px]',
} as const;

export function WorkbenchCodeEngineIcon({
  engineId,
  className,
  labelClassName,
  size = 'sm',
}: WorkbenchCodeEngineIconProps) {
  const visualIdentity = resolveProviderVisualIdentity({ engineId });

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded font-semibold uppercase leading-none tracking-normal ring-1 ring-inset',
        SIZE_CLASS_BY_ID[size],
        resolveProviderVisualToneClassName(visualIdentity.tone),
        className,
      )}
      aria-label={visualIdentity.label}
      data-provider-abbreviation={visualIdentity.abbreviation}
      data-provider-identity-icon="true"
      data-provider-id={visualIdentity.id}
      data-provider-tone={visualIdentity.tone}
      title={visualIdentity.label}
    >
      <span className={cn(labelClassName)}>{visualIdentity.abbreviation}</span>
    </span>
  );
}

