export type WorkbenchLongIntegerString = string;

export type WorkbenchEntityId = WorkbenchLongIntegerString;

export function stringifyWorkbenchLongInteger(value: unknown): WorkbenchLongIntegerString {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(Math.trunc(value)) : '0';
  }
  const normalized = typeof value === 'string' ? value.trim() : '';
  return /^-?\d+$/u.test(normalized) ? normalized : '0';
}

export function compareWorkbenchLongIntegers(left: unknown, right: unknown): number {
  const leftValue = BigInt(stringifyWorkbenchLongInteger(left));
  const rightValue = BigInt(stringifyWorkbenchLongInteger(right));
  return leftValue === rightValue ? 0 : leftValue < rightValue ? -1 : 1;
}

export { BIRDCODER_DATA_SCOPES as WORKBENCH_DATA_SCOPES } from './dataScopes.ts';
export type { BirdCoderDataScope as WorkbenchDataScope } from './dataScopes.ts';
