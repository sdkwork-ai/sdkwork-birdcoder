import React from 'react';

import { getWorkbenchCodeEngineDefinition } from '@sdkwork/birdcoder-codeengine';

import { cn } from '../lib/utils';

export interface WorkbenchCodeEngineIconProps {
  engineId: string | null | undefined;
  className?: string;
  labelClassName?: string;
  size?: 'sm' | 'md';
}

const THEME_CLASS_BY_ID = {
  amber: {
    container: 'bg-amber-500/15 text-amber-300 ring-amber-500/20',
    label: 'text-amber-200',
  },
  blue: {
    container: 'bg-blue-500/15 text-blue-300 ring-blue-500/20',
    label: 'text-blue-200',
  },
  emerald: {
    container: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/20',
    label: 'text-emerald-200',
  },
  violet: {
    container: 'bg-violet-500/15 text-violet-300 ring-violet-500/20',
    label: 'text-violet-200',
  },
} as const;

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
  const engine = getWorkbenchCodeEngineDefinition(engineId);
  const themeClasses = THEME_CLASS_BY_ID[engine.theme];

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-semibold uppercase tracking-[0.12em] ring-1',
        SIZE_CLASS_BY_ID[size],
        themeClasses.container,
        className,
      )}
      title={engine.label}
      aria-label={engine.label}
    >
      <span className={cn(themeClasses.label, labelClassName)}>{engine.monogram}</span>
    </span>
  );
}
