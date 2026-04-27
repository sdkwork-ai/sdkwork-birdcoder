import { BIRDCODER_LONG_INTEGER_JSON_SCALAR_KEYS } from './data.ts';

const MAX_SAFE_JSON_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_JSON_INTEGER = -MAX_SAFE_JSON_INTEGER;
const MIN_UNSAFE_JSON_INTEGER_DIGITS = 16;

function isDigit(value: string | undefined): boolean {
  return value !== undefined && value >= '0' && value <= '9';
}

function shouldPreserveIntegerTokenAsString(token: string): boolean {
  const digits = token.startsWith('-') ? token.slice(1) : token;
  if (digits.length < MIN_UNSAFE_JSON_INTEGER_DIGITS) {
    return false;
  }

  try {
    const value = BigInt(token);
    return value > MAX_SAFE_JSON_INTEGER || value < MIN_SAFE_JSON_INTEGER;
  } catch {
    return false;
  }
}

function quoteUnsafeJsonIntegerTokens(rawJson: string): string {
  let index = 0;
  let inString = false;
  let escaped = false;
  let segmentStart = 0;
  let rewrittenParts: string[] | null = null;

  while (index < rawJson.length) {
    const char = rawJson[index]!;

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      index += 1;
      continue;
    }

    if (char === '"') {
      inString = true;
      index += 1;
      continue;
    }

    if (char !== '-' && !isDigit(char)) {
      index += 1;
      continue;
    }

    const tokenStart = index;
    let cursor = index;
    if (rawJson[cursor] === '-') {
      cursor += 1;
    }

    if (!isDigit(rawJson[cursor])) {
      index += 1;
      continue;
    }

    if (rawJson[cursor] === '0') {
      cursor += 1;
    } else {
      while (isDigit(rawJson[cursor])) {
        cursor += 1;
      }
    }

    const integerEnd = cursor;
    if (rawJson[cursor] === '.') {
      cursor += 1;
      while (isDigit(rawJson[cursor])) {
        cursor += 1;
      }
    }

    if (rawJson[cursor] === 'e' || rawJson[cursor] === 'E') {
      cursor += 1;
      if (rawJson[cursor] === '+' || rawJson[cursor] === '-') {
        cursor += 1;
      }
      while (isDigit(rawJson[cursor])) {
        cursor += 1;
      }
    }

    const integerToken = rawJson.slice(tokenStart, integerEnd);
    const hasFractionOrExponent = cursor !== integerEnd;
    if (!hasFractionOrExponent && shouldPreserveIntegerTokenAsString(integerToken)) {
      rewrittenParts ??= [];
      rewrittenParts.push(rawJson.slice(segmentStart, tokenStart), `"${integerToken}"`);
      segmentStart = cursor;
    }
    index = cursor;
  }

  if (!rewrittenParts) {
    return rawJson;
  }

  rewrittenParts.push(rawJson.slice(segmentStart));
  return rewrittenParts.join('');
}

function isCanonicalIdentifierScalarKey(key: string): boolean {
  return key === 'id' || key.endsWith('Id') || key.endsWith('ID') || key.endsWith('_id');
}

function isCanonicalIdentifierArrayKey(key: string): boolean {
  return key === 'ids' || key === 'IDs' || key.endsWith('Ids') || key.endsWith('IDs') || key.endsWith('_ids');
}

function isCanonicalIdentifierKey(key: string): boolean {
  return isCanonicalIdentifierScalarKey(key) || isCanonicalIdentifierArrayKey(key);
}

function isCanonicalLongIntegerScalarKey(key: string): boolean {
  return BIRDCODER_LONG_INTEGER_JSON_SCALAR_KEYS.has(key);
}

function isCanonicalLongIntegerJsonKey(key: string): boolean {
  return isCanonicalIdentifierKey(key) || isCanonicalLongIntegerScalarKey(key);
}

export function isBirdCoderCanonicalLongIntegerJsonKey(key: string): boolean {
  return isCanonicalLongIntegerJsonKey(key);
}

function normalizeParsedJsonIdentifierFields(value: unknown, key?: string): unknown {
  if (
    key &&
    isCanonicalLongIntegerJsonKey(key) &&
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value)
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    const itemKey = key && isCanonicalIdentifierArrayKey(key) ? key : undefined;
    for (let index = 0; index < value.length; index += 1) {
      const item = value[index];
      const normalizedItem = normalizeParsedJsonIdentifierFields(item, itemKey);
      if (normalizedItem !== item) {
        value[index] = normalizedItem;
      }
    }
    return value;
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const normalizedRecord = value as Record<string, unknown>;
  for (const [entryKey, entryValue] of Object.entries(value)) {
    const normalizedValue = normalizeParsedJsonIdentifierFields(entryValue, entryKey);
    if (normalizedValue !== entryValue) {
      normalizedRecord[entryKey] = normalizedValue;
    }
  }

  return value;
}

export function parseBirdCoderApiJson<T = unknown>(rawJson: string): T {
  const parsed = JSON.parse(quoteUnsafeJsonIntegerTokens(rawJson)) as unknown;
  return normalizeParsedJsonIdentifierFields(parsed) as T;
}

function normalizeOutboundJsonNumber(value: number, key: string): string {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`BirdCoder API Long field ${key} must be an integer.`);
  }

  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `BirdCoder API Long field ${key} received an unsafe JavaScript number; pass the exact decimal string instead.`,
    );
  }

  return String(value);
}

function normalizeOutboundPlainJsonNumber(value: number, key: string | undefined): number {
  if (!Number.isFinite(value)) {
    throw new Error(
      `BirdCoder API JSON field ${key ?? '<root>'} must be a finite number.`,
    );
  }

  if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
    throw new Error(
      `BirdCoder API JSON field ${key ?? '<root>'} received an unsafe JavaScript number; pass the exact decimal string instead.`,
    );
  }

  return value;
}

function normalizeOutboundQueryNumber(value: number, key: string): string {
  if (isCanonicalLongIntegerJsonKey(key)) {
    return normalizeOutboundJsonNumber(value, key);
  }

  if (!Number.isFinite(value)) {
    throw new Error(`BirdCoder API query field ${key} must be a finite number.`);
  }

  if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
    throw new Error(
      `BirdCoder API query field ${key} received an unsafe JavaScript number; pass the exact decimal string instead.`,
    );
  }

  return String(value);
}

export function normalizeBirdCoderApiQueryValue(
  key: string,
  value: unknown,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }

  if (typeof value === 'number') {
    return normalizeOutboundQueryNumber(value, key);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'boolean') {
    return String(value);
  }

  throw new Error(
    `BirdCoder API query field ${key} must be a string, number, bigint, boolean, null, or undefined.`,
  );
}

function normalizeOutboundJsonValue(
  value: unknown,
  key: string | undefined,
  parentKey: string | undefined,
  seen: WeakSet<object>,
): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  const effectiveKey =
    key ?? (isCanonicalIdentifierArrayKey(parentKey ?? '') ? parentKey : undefined);

  if (
    effectiveKey &&
    isCanonicalLongIntegerJsonKey(effectiveKey) &&
    typeof value === 'number'
  ) {
    return normalizeOutboundJsonNumber(value, effectiveKey);
  }

  if (typeof value === 'number') {
    return normalizeOutboundPlainJsonNumber(value, key);
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new Error('BirdCoder API JSON payload cannot contain circular references.');
    }

    seen.add(value);
    try {
      return value.map((item) =>
        normalizeOutboundJsonValue(item, undefined, key, seen),
      );
    } finally {
      seen.delete(value);
    }
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if (value instanceof Date) {
    return value.toJSON();
  }

  if (seen.has(value)) {
    throw new Error('BirdCoder API JSON payload cannot contain circular references.');
  }

  seen.add(value);
  try {
    const maybeSerializable = value as { toJSON?: unknown };
    if (typeof maybeSerializable.toJSON === 'function') {
      return normalizeOutboundJsonValue(
        maybeSerializable.toJSON(),
        key,
        parentKey,
        seen,
      );
    }

    const normalizedRecord: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      normalizedRecord[entryKey] = normalizeOutboundJsonValue(
        entryValue,
        entryKey,
        undefined,
        seen,
      );
    }
    return normalizedRecord;
  } finally {
    seen.delete(value);
  }
}

export function stringifyBirdCoderApiJson(value: unknown): string {
  return JSON.stringify(
    normalizeOutboundJsonValue(value, undefined, undefined, new WeakSet()),
  );
}
