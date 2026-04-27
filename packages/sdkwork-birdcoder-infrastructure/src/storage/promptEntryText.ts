function buildPromptEntryPreview(normalizedPromptText: string): string {
  const preview = normalizedPromptText
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 24);
  return preview || 'prompt';
}

function hashPromptText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function normalizeBirdCoderPromptEntryText(text: string): string {
  return text.replace(/\r\n/gu, '\n').replace(/\r/gu, '\n').trim();
}

export function normalizeBirdCoderPromptEntryUseCount(value: unknown): number {
  if (value === undefined || value === null) {
    return 1;
  }

  const normalizeIntegerValue = (integerValue: bigint): number => {
    const min = BigInt(Number.MIN_SAFE_INTEGER);
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    if (integerValue < min || integerValue > max) {
      throw new Error('BirdCoder prompt entry useCount must be a safe integer.');
    }
    return integerValue > 0n ? Number(integerValue) : 1;
  };

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error('BirdCoder prompt entry useCount must be an integer.');
    }
    if (!Number.isSafeInteger(value)) {
      throw new Error(
        'BirdCoder prompt entry useCount received an unsafe JavaScript number; pass a safe integer instead.',
      );
    }
    return value > 0 ? value : 1;
  }

  if (typeof value === 'bigint') {
    return normalizeIntegerValue(value);
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return 1;
    }
    if (!/^[+-]?\d+$/u.test(normalizedValue)) {
      throw new Error('BirdCoder prompt entry useCount must be an integer.');
    }
    return normalizeIntegerValue(BigInt(normalizedValue));
  }

  throw new Error('BirdCoder prompt entry useCount must be a safe integer.');
}

export function buildBirdCoderPromptEntryIdentityParts(
  normalizedPromptText: string,
): readonly [string, string, string] {
  const normalizedText = normalizeBirdCoderPromptEntryText(normalizedPromptText);
  return [
    buildPromptEntryPreview(normalizedText),
    normalizedText.length.toString(36),
    hashPromptText(normalizedText),
  ] as const;
}

export function resolveBirdCoderMonotonicPromptTimestamp(
  candidateTimestamp: string | undefined,
  referenceTimestamps: ReadonlyArray<string>,
): string {
  const parsedCandidate =
    typeof candidateTimestamp === 'string' ? Date.parse(candidateTimestamp) : Number.NaN;
  let nextTimestamp = Number.isNaN(parsedCandidate) ? Date.now() : parsedCandidate;

  for (const referenceTimestamp of referenceTimestamps) {
    const parsedReference = Date.parse(referenceTimestamp);
    if (!Number.isNaN(parsedReference) && nextTimestamp <= parsedReference) {
      nextTimestamp = parsedReference + 1;
    }
  }

  return new Date(nextTimestamp).toISOString();
}
