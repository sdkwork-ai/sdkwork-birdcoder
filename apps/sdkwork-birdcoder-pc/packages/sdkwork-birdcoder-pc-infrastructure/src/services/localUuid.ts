import { uuid } from '@sdkwork/utils/id';

/**
 * Generates a UUID v4 string using the SDKWork utils library.
 * Replaces the former hand-rolled Web Crypto fallback with the
 * centrally maintained `@sdkwork/utils/id` implementation.
 */
export function createBirdCoderLocalUuidV4(): string {
  return uuid();
}
