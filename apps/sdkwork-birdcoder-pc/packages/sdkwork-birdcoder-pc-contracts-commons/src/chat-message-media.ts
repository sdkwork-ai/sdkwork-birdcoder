export const BIRDCODER_CHAT_MESSAGE_MAX_MEDIA_SOURCE_CHARACTERS = 4 * 1_024 * 1_024;
export const BIRDCODER_CHAT_MESSAGE_MAX_EXTERNAL_MEDIA_SOURCE_CHARACTERS = 4_096;

export type BirdCoderChatMessageMediaKind = 'audio' | 'image';

export interface BirdCoderChatMessageDataMediaSource {
  kind?: BirdCoderChatMessageMediaKind;
  mimeType: string;
  payload: string;
  source: string;
}

const MIME_TYPE_PATTERN = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/iu;
const DATA_MEDIA_SOURCE_PATTERN = /^data:([^;,]+);base64,(.*)$/isu;
const BASE64_ALPHABET_PATTERN = /^[a-z0-9+/]*={0,2}$/iu;
const SAFE_INLINE_IMAGE_MIME_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export function isBirdCoderChatMessageBase64Payload(value: string): boolean {
  if (!value || !BASE64_ALPHABET_PATTERN.test(value)) {
    return false;
  }
  const paddingStart = value.indexOf('=');
  const unpaddedLength = paddingStart >= 0 ? paddingStart : value.length;
  const paddingLength = value.length - unpaddedLength;
  if (paddingLength > 0) {
    return value.length % 4 === 0
      && (
        (paddingLength === 1 && unpaddedLength % 4 === 3)
        || (paddingLength === 2 && unpaddedLength % 4 === 2)
      );
  }
  return unpaddedLength % 4 !== 1;
}

export function parseBirdCoderChatMessageDataMediaSource(
  value: unknown,
  expectedKind?: BirdCoderChatMessageMediaKind,
  expectedMimeType?: string,
): BirdCoderChatMessageDataMediaSource | null {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > BIRDCODER_CHAT_MESSAGE_MAX_MEDIA_SOURCE_CHARACTERS
  ) {
    return null;
  }
  const source = value.trim();
  if (!source || source.length > BIRDCODER_CHAT_MESSAGE_MAX_MEDIA_SOURCE_CHARACTERS) {
    return null;
  }
  const match = DATA_MEDIA_SOURCE_PATTERN.exec(source);
  if (!match) {
    return null;
  }
  const mimeType = match[1]!.trim().toLowerCase();
  const payload = match[2]!;
  if (!MIME_TYPE_PATTERN.test(mimeType) || !isBirdCoderChatMessageBase64Payload(payload)) {
    return null;
  }
  const kind = mimeType.startsWith('image/')
    ? 'image'
    : mimeType.startsWith('audio/')
      ? 'audio'
      : undefined;
  if (kind === 'image' && !SAFE_INLINE_IMAGE_MIME_TYPES.has(mimeType)) {
    return null;
  }
  if (expectedKind && kind !== expectedKind) {
    return null;
  }
  const normalizedExpectedMimeType = expectedMimeType?.trim().toLowerCase();
  if (normalizedExpectedMimeType && normalizedExpectedMimeType !== mimeType) {
    return null;
  }
  return {
    ...(kind ? { kind } : {}),
    mimeType,
    payload,
    source,
  };
}

export function resolveBirdCoderChatMessageMediaSource(
  value: unknown,
  expectedKind: BirdCoderChatMessageMediaKind,
  expectedMimeType?: string,
): string | undefined {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > BIRDCODER_CHAT_MESSAGE_MAX_MEDIA_SOURCE_CHARACTERS
  ) {
    return undefined;
  }
  const source = value.trim();
  if (!source || source.length > BIRDCODER_CHAT_MESSAGE_MAX_MEDIA_SOURCE_CHARACTERS) {
    return undefined;
  }
  if (/^https?:\/\//iu.test(source) || /^blob:/iu.test(source)) {
    return source.length <= BIRDCODER_CHAT_MESSAGE_MAX_EXTERNAL_MEDIA_SOURCE_CHARACTERS
      ? source
      : undefined;
  }
  return parseBirdCoderChatMessageDataMediaSource(
    source,
    expectedKind,
    expectedMimeType,
  )?.source;
}

export function buildBirdCoderChatMessageDataMediaSource(
  data: unknown,
  mimeType: unknown,
): string | undefined {
  if (typeof data !== 'string' || typeof mimeType !== 'string') {
    return undefined;
  }
  const normalizedMimeType = mimeType.trim().toLowerCase();
  if (
    !MIME_TYPE_PATTERN.test(normalizedMimeType)
    || (
      normalizedMimeType.startsWith('image/')
      && !SAFE_INLINE_IMAGE_MIME_TYPES.has(normalizedMimeType)
    )
    || !isBirdCoderChatMessageBase64Payload(data)
  ) {
    return undefined;
  }
  const source = `data:${normalizedMimeType};base64,${data}`;
  return source.length <= BIRDCODER_CHAT_MESSAGE_MAX_MEDIA_SOURCE_CHARACTERS
    ? source
    : undefined;
}
