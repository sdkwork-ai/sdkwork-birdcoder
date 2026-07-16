import {
  RUNTIME_SERVER_ACCESS_TOKEN_HEADER_NAME,
  RUNTIME_SERVER_AUTHORIZATION_HEADER_NAME,
  resolveRuntimeServerSessionHeaders,
} from './runtimeServerSession.ts';

export const SDKWORK_REALTIME_APPLICATION_PROTOCOL = 'sdkwork-realtime-v1';
export const SDKWORK_REALTIME_AUTH_PROTOCOL_PREFIX =
  'sdkwork-realtime-auth-v1.';
export const SDKWORK_REALTIME_ACCESS_PROTOCOL_PREFIX =
  'sdkwork-realtime-access-v1.';

const MAX_REALTIME_TOKEN_UTF8_BYTES = 3_072;
const MAX_REALTIME_ENCODED_TOKEN_LENGTH = 4_096;
const MAX_REALTIME_PROTOCOL_HEADER_LENGTH = 9_216;
const BASE64_BINARY_CHUNK_SIZE = 16_384;

export interface WorkspaceRealtimeDualTokenCredentials {
  accessToken: string;
  authToken: string;
  authorization: string;
}

export type WorkspaceRealtimeSessionHeaderResolver = () => Record<
  string,
  string | undefined
>;

function normalizeHeaderValue(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function hasUnsafeCredentialWhitespace(value: string): boolean {
  return /[\s\u0000-\u001f\u007f]/u.test(value);
}

function isCredentialWithinUtf8Limit(value: string): boolean {
  return new TextEncoder().encode(value).byteLength <= MAX_REALTIME_TOKEN_UTF8_BYTES;
}

export function resolveWorkspaceRealtimeDualTokenCredentials(
  resolveHeaders: WorkspaceRealtimeSessionHeaderResolver =
    resolveRuntimeServerSessionHeaders,
): WorkspaceRealtimeDualTokenCredentials | null {
  const headers = resolveHeaders();
  const authorization = normalizeHeaderValue(
    headers[RUNTIME_SERVER_AUTHORIZATION_HEADER_NAME],
  );
  const accessToken = normalizeHeaderValue(
    headers[RUNTIME_SERVER_ACCESS_TOKEN_HEADER_NAME],
  );
  const authToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;

  if (
    !authorization ||
    !authToken ||
    !accessToken ||
    hasUnsafeCredentialWhitespace(authToken) ||
    hasUnsafeCredentialWhitespace(accessToken) ||
    !isCredentialWithinUtf8Limit(authToken) ||
    !isCredentialWithinUtf8Limit(accessToken)
  ) {
    return null;
  }

  return { accessToken, authToken, authorization };
}

function encodeUtf8Base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let offset = 0; offset < bytes.byteLength; offset += BASE64_BINARY_CHUNK_SIZE) {
    const end = Math.min(offset + BASE64_BINARY_CHUNK_SIZE, bytes.byteLength);
    for (let index = offset; index < end; index += 1) {
      binary += String.fromCharCode(bytes[index] ?? 0);
    }
  }
  const encoded = btoa(binary)
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_')
    .replace(/=+$/u, '');
  if (!encoded || encoded.length > MAX_REALTIME_ENCODED_TOKEN_LENGTH) {
    throw new Error('Workspace realtime credential exceeds the transport limit.');
  }
  return encoded;
}

export function createWorkspaceRealtimeWebSocketProtocols(
  resolveHeaders: WorkspaceRealtimeSessionHeaderResolver =
    resolveRuntimeServerSessionHeaders,
): string[] {
  const credentials = resolveWorkspaceRealtimeDualTokenCredentials(resolveHeaders);
  if (!credentials) {
    throw new Error(
      'Workspace realtime requires a complete authenticated IAM token bundle.',
    );
  }

  const protocols = [
    SDKWORK_REALTIME_APPLICATION_PROTOCOL,
    `${SDKWORK_REALTIME_AUTH_PROTOCOL_PREFIX}${encodeUtf8Base64Url(credentials.authToken)}`,
    `${SDKWORK_REALTIME_ACCESS_PROTOCOL_PREFIX}${encodeUtf8Base64Url(credentials.accessToken)}`,
  ];
  if (protocols.join(', ').length > MAX_REALTIME_PROTOCOL_HEADER_LENGTH) {
    throw new Error('Workspace realtime credentials exceed the handshake limit.');
  }
  return protocols;
}
