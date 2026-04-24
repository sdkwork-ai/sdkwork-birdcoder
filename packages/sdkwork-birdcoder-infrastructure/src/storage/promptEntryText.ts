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
