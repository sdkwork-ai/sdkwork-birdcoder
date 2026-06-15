export const MULTI_WINDOW_LAYOUT_COUNTS = [2, 3, 4, 6, 8] as const;
export type MultiWindowLayoutCount = (typeof MULTI_WINDOW_LAYOUT_COUNTS)[number];

export const DEFAULT_MULTI_WINDOW_ACTIVE_WINDOW_COUNT = 0;
export const DEFAULT_MULTI_WINDOW_LAYOUT_COUNT: MultiWindowLayoutCount = 4;
export const MAX_MULTI_WINDOW_PANES = 8;

export function isMultiWindowLayoutCount(value: number): value is MultiWindowLayoutCount {
  return MULTI_WINDOW_LAYOUT_COUNTS.includes(value as MultiWindowLayoutCount);
}

export function normalizeMultiWindowLayoutCount(value: number | null | undefined): MultiWindowLayoutCount {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return MULTI_WINDOW_LAYOUT_COUNTS[0];
  }

  const normalizedValue = Math.max(0, Math.floor(value));
  if (isMultiWindowLayoutCount(normalizedValue)) {
    return normalizedValue;
  }

  return (
    MULTI_WINDOW_LAYOUT_COUNTS.find((candidate) => candidate >= normalizedValue) ??
    MULTI_WINDOW_LAYOUT_COUNTS[MULTI_WINDOW_LAYOUT_COUNTS.length - 1]
  );
}

export function normalizeMultiWindowActiveWindowCount(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_MULTI_WINDOW_ACTIVE_WINDOW_COUNT;
  }

  return Math.max(0, Math.min(MAX_MULTI_WINDOW_PANES, Math.floor(value)));
}

export function resolveMultiWindowGridClassName(windowCount: number): string {
  if (windowCount <= 2) {
    return 'grid-cols-1 xl:grid-cols-2';
  }
  if (windowCount === 3) {
    return 'grid-cols-1 lg:grid-cols-3';
  }
  if (windowCount === 4) {
    return 'grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4';
  }
  if (windowCount === 6) {
    return 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-3';
  }
  return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4';
}
