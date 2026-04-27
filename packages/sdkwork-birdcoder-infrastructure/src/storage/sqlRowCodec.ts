import {
  parseBirdCoderApiJson,
  stringifyBirdCoderLongInteger,
  type BirdCoderEntityDefinition,
  type BirdCoderSchemaColumnDefinition,
} from '@sdkwork/birdcoder-types';
import type { BirdCoderSqlRow } from './sqlPlans.ts';

function coerceJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return parseBirdCoderApiJson(value);
  } catch {
    return {};
  }
}

function coerceCanonicalIdValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error('BirdCoder SQL id field received a non-integer JavaScript number.');
    }
    if (!Number.isSafeInteger(value)) {
      throw new Error(
        'BirdCoder SQL id field received an unsafe JavaScript number; use the exact decimal string instead.',
      );
    }
    return String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  throw new Error('BirdCoder SQL id field must be a string, bigint, or safe integer.');
}

function coerceLongIntegerValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error('BirdCoder SQL bigint field received a non-integer JavaScript number.');
    }
    if (!Number.isSafeInteger(value)) {
      throw new Error(
        'BirdCoder SQL bigint field received an unsafe JavaScript number; use the exact decimal string instead.',
      );
    }
    return String(value);
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    return normalizedValue.length > 0
      ? stringifyBirdCoderLongInteger(normalizedValue)
      : null;
  }

  return stringifyBirdCoderLongInteger(String(value));
}

function coerceIntegerValue(columnName: string, value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error(`BirdCoder SQL int field ${columnName} received a non-integer JavaScript number.`);
    }
    if (!Number.isSafeInteger(value)) {
      throw new Error(
        `BirdCoder SQL int field ${columnName} received an unsafe JavaScript number; use a safe integer instead.`,
      );
    }
    return value;
  }

  if (typeof value === 'bigint') {
    const min = BigInt(Number.MIN_SAFE_INTEGER);
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    if (value < min || value > max) {
      throw new Error(`BirdCoder SQL int field ${columnName} must be a safe integer.`);
    }
    return Number(value);
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return null;
    }
    if (!/^[+-]?\d+$/u.test(normalizedValue)) {
      throw new Error(`BirdCoder SQL int field ${columnName} must be an integer.`);
    }

    const integerValue = BigInt(normalizedValue);
    const min = BigInt(Number.MIN_SAFE_INTEGER);
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    if (integerValue < min || integerValue > max) {
      throw new Error(`BirdCoder SQL int field ${columnName} must be a safe integer.`);
    }
    return Number(integerValue);
  }

  throw new Error(`BirdCoder SQL int field ${columnName} must be a safe integer.`);
}

function coerceDataScopeValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue =
    typeof value === 'bigint' ? value.toString() : String(value).trim().toUpperCase();
  switch (normalizedValue) {
    case '0':
    case 'DEFAULT':
      return 'DEFAULT';
    case '1':
    case 'PRIVATE':
      return 'PRIVATE';
    case '2':
    case 'SHARED':
      return 'SHARED';
    case '3':
    case 'PUBLIC':
      return 'PUBLIC';
    default:
      return normalizedValue || null;
  }
}

function coerceValue(
  column: BirdCoderSchemaColumnDefinition,
  value: unknown,
): unknown {
  if (value === undefined || value === null) {
    return value ?? null;
  }

  if (column.name === 'data_scope') {
    return coerceDataScopeValue(value);
  }

  if (column.logicalType === 'id') {
    return coerceCanonicalIdValue(value);
  }

  switch (column.logicalType) {
    case 'bool':
      if (typeof value === 'boolean') {
        return value;
      }

      if (typeof value === 'bigint') {
        return value !== 0n;
      }

      if (typeof value === 'number') {
        return value !== 0;
      }

      return value === 'true' || value === '1';
    case 'int':
      return coerceIntegerValue(column.name, value);
    case 'bigint':
      return coerceLongIntegerValue(value);
    case 'json':
      return coerceJsonValue(value);
    case 'enum':
    case 'text':
    case 'date':
    case 'timestamp':
    default:
      return value;
  }
}

export function coerceBirdCoderSqlEntityRow(
  definition: BirdCoderEntityDefinition,
  value: unknown,
): BirdCoderSqlRow | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const canonicalId = coerceCanonicalIdValue(record.id);
  if (!canonicalId) {
    return null;
  }

  const row: BirdCoderSqlRow = {};
  for (const column of definition.columns) {
    row[column.name] = coerceValue(column, record[column.name]);
  }

  return row;
}
