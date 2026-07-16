import type { BirdCoderNativeSessionAttributes } from '@sdkwork/birdcoder-pc-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeMetadataKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function isSensitiveMetadataKey(key: string): boolean {
  const normalized = normalizeMetadataKey(key);
  if (
    [
      'authorization',
      'content',
      'credential',
      'credentials',
      'env',
      'environment',
      'events',
      'input',
      'message',
      'messages',
      'output',
      'password',
      'prompt',
      'secret',
      'transcript',
    ].includes(normalized)
  ) {
    return true;
  }

  return (
    normalized.includes('apikey') ||
    normalized.includes('accesstoken') ||
    normalized.includes('authtoken') ||
    normalized.includes('privatekey') ||
    normalized.includes('refreshtoken') ||
    normalized.includes('credential') ||
    normalized.includes('handle') ||
    normalized.includes('fingerprint') ||
    normalized.includes('cipher') ||
    normalized.includes('locator') ||
    normalized.includes('cwd') ||
    normalized.includes('directory') ||
    normalized.includes('path') ||
    normalized === 'dir' ||
    normalized === 'home' ||
    normalized === 'root' ||
    normalized.endsWith('dir') ||
    normalized.endsWith('root')
  );
}

function looksLikeSensitivePath(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.startsWith('/') ||
    trimmed.startsWith('\\\\') ||
    trimmed.startsWith('file://') ||
    /^[a-z]:/i.test(trimmed)
  );
}

function sanitizeMetadataValue(value: unknown): unknown | undefined {
  if (Array.isArray(value)) {
    return value
      .map(sanitizeMetadataValue)
      .filter((item): item is Exclude<typeof item, undefined> => item !== undefined);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, nestedValue]) => {
        if (isSensitiveMetadataKey(key)) {
          return [];
        }
        const sanitizedValue = sanitizeMetadataValue(nestedValue);
        return sanitizedValue === undefined ? [] : [[key, sanitizedValue]];
      }),
    );
  }

  return typeof value === 'string' && looksLikeSensitivePath(value) ? undefined : value;
}

export function sanitizeBirdCoderNativeSessionMetadata(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nestedValue]) => {
      if (isSensitiveMetadataKey(key)) {
        return [];
      }
      const sanitizedValue = sanitizeMetadataValue(nestedValue);
      return sanitizedValue === undefined ? [] : [[key, sanitizedValue]];
    }),
  );
}

export function sanitizeBirdCoderNativeSessionGitRepositoryUrl(
  value: unknown,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  const authority = normalized.split('://')[1]?.split('/')[0];
  const hasUriUserInfo = authority?.includes('@') ?? false;
  const isSafeScpRemote =
    normalized.startsWith('git@') &&
    normalized.slice(4).includes(':') &&
    !normalized.slice(4).includes('@');
  const isSafe =
    normalized.length > 0 &&
    normalized.length <= 2048 &&
    !/[\u0000-\u001f\s]/.test(normalized) &&
    !normalized.includes('?') &&
    !normalized.includes('#') &&
    !hasUriUserInfo &&
    (normalized.startsWith('https://') ||
      (normalized.startsWith('ssh://') && !normalized.includes('@')) ||
      normalized.startsWith('git://') ||
      isSafeScpRemote);

  return isSafe ? normalized : undefined;
}

export function sanitizeBirdCoderNativeSessionAttributes(
  attributes: BirdCoderNativeSessionAttributes,
): BirdCoderNativeSessionAttributes {
  return {
    ...attributes,
    gitRepositoryUrl: sanitizeBirdCoderNativeSessionGitRepositoryUrl(
      attributes.gitRepositoryUrl,
    ),
    metadata: sanitizeBirdCoderNativeSessionMetadata(attributes.metadata),
  };
}
