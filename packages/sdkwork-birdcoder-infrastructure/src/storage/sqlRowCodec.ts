import type {
  BirdCoderEntityDefinition,
  BirdCoderLogicalColumnType,
} from '@sdkwork/birdcoder-types';
import type { BirdCoderSqlRow } from './sqlPlans.ts';

function coerceJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function coerceValue(
  logicalType: BirdCoderLogicalColumnType,
  value: unknown,
): unknown {
  if (value === undefined || value === null) {
    return value ?? null;
  }

  switch (logicalType) {
    case 'bool':
      if (typeof value === 'boolean') {
        return value;
      }

      if (typeof value === 'number') {
        return value !== 0;
      }

      return value === 'true' || value === '1';
    case 'int':
    case 'bigint':
      return typeof value === 'number' ? value : Number(value);
    case 'json':
      return coerceJsonValue(value);
    case 'enum':
    case 'id':
    case 'text':
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
  if (typeof record.id !== 'string') {
    return null;
  }

  const row: BirdCoderSqlRow = {};
  for (const column of definition.columns) {
    row[column.name] = coerceValue(column.logicalType, record[column.name]);
  }

  return row;
}
