const PROJECT_BUSINESS_CODE_PREFIX = 'PROJ';
const PROJECT_BUSINESS_CODE_MAX_LENGTH = 64;
const PROJECT_BUSINESS_NAME_MAX_LENGTH = 255;

function truncate(value: string, maxLength: number): string {
  return [...value].slice(0, maxLength).join('');
}

function takeTail(value: string, maxLength: number): string {
  const characters = [...value];
  return characters.slice(Math.max(0, characters.length - maxLength)).join('');
}

function joinBusinessCodeParts(parts: readonly string[]): string {
  return parts.filter((part) => part.length > 0).join('-');
}

function buildBusinessCodeWithRequiredSuffix(
  prefix: string,
  primarySegment: string,
  fallbackSegment: string,
  maxLength: number,
): string {
  const suffixSegment =
    fallbackSegment.length > maxLength ? takeTail(fallbackSegment, maxLength) : fallbackSegment;

  if (!primarySegment) {
    const composed = joinBusinessCodeParts([prefix, suffixSegment]);
    if (composed.length <= maxLength) {
      return composed;
    }

    const maxPrefixLength = maxLength - suffixSegment.length - 1;
    if (prefix && maxPrefixLength > 0) {
      return joinBusinessCodeParts([
        truncate(prefix, maxPrefixLength).replace(/-+$/u, ''),
        suffixSegment,
      ]);
    }
    return takeTail(suffixSegment, maxLength);
  }

  const separatorCount = prefix ? 2 : 1;
  const fixedLength = prefix.length + separatorCount + suffixSegment.length;
  if (fixedLength >= maxLength) {
    const composed = joinBusinessCodeParts([prefix, suffixSegment]);
    if (composed.length <= maxLength) {
      return composed;
    }
    return takeTail(suffixSegment, maxLength);
  }

  const maxPrimaryLength = maxLength - fixedLength;
  const primaryHead = truncate(primarySegment, maxPrimaryLength).replace(/-+$/u, '');
  return joinBusinessCodeParts([prefix, primaryHead, suffixSegment]);
}

export function sanitizeBirdCoderBusinessCodeSegment(value: string): string {
  let normalized = '';
  let previousWasSeparator = false;

  for (const character of value) {
    const codePoint = character.codePointAt(0);
    const isDigit = codePoint !== undefined && codePoint >= 48 && codePoint <= 57;
    const isUpper = codePoint !== undefined && codePoint >= 65 && codePoint <= 90;
    const isLower = codePoint !== undefined && codePoint >= 97 && codePoint <= 122;

    if (isDigit || isUpper || isLower) {
      normalized += isLower ? character.toUpperCase() : character;
      previousWasSeparator = false;
    } else if (!previousWasSeparator) {
      normalized += '-';
      previousWasSeparator = true;
    }
  }

  return normalized.replace(/^-+|-+$/gu, '');
}

export function buildBirdCoderBusinessCode({
  fallbackId,
  maxLength = PROJECT_BUSINESS_CODE_MAX_LENGTH,
  prefix,
  primaryValue,
}: {
  fallbackId: string;
  maxLength?: number;
  prefix: string;
  primaryValue: string;
}): string {
  const normalizedPrefix = sanitizeBirdCoderBusinessCodeSegment(prefix);
  const primarySegment = sanitizeBirdCoderBusinessCodeSegment(primaryValue);
  const fallbackSegment = sanitizeBirdCoderBusinessCodeSegment(fallbackId);

  if (fallbackSegment) {
    return buildBusinessCodeWithRequiredSuffix(
      normalizedPrefix,
      primarySegment,
      fallbackSegment,
      maxLength,
    );
  }

  if (!primarySegment) {
    return truncate(normalizedPrefix, maxLength);
  }

  const seed = primarySegment || normalizedPrefix;
  return truncate(joinBusinessCodeParts([normalizedPrefix, seed]), maxLength);
}

export function buildBirdCoderProjectBusinessCode({
  name,
  projectId,
  rootPath,
}: {
  name: string;
  projectId: string;
  rootPath?: string | null;
}): string {
  const primaryValue = rootPath?.trim() || name;
  return buildBirdCoderBusinessCode({
    fallbackId: projectId,
    prefix: PROJECT_BUSINESS_CODE_PREFIX,
    primaryValue,
  });
}

export function buildBirdCoderProjectBusinessName({
  name,
  projectId,
}: {
  name: string;
  projectId: string;
}): string {
  const normalizedName = name.trim() || projectId.trim() || PROJECT_BUSINESS_CODE_PREFIX;
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    return truncate(normalizedName, PROJECT_BUSINESS_NAME_MAX_LENGTH);
  }

  const suffix = ` [${normalizedProjectId}]`;
  if (suffix.length >= PROJECT_BUSINESS_NAME_MAX_LENGTH) {
    return takeTail(normalizedProjectId, PROJECT_BUSINESS_NAME_MAX_LENGTH);
  }

  const maxNameLength = PROJECT_BUSINESS_NAME_MAX_LENGTH - suffix.length;
  const nameHead = truncate(normalizedName, maxNameLength).trimEnd();
  return `${nameHead || PROJECT_BUSINESS_CODE_PREFIX}${suffix}`;
}
