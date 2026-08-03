import { getBirdCoderGlobalTokenManager } from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import { getStoredAppSessionAuthToken } from '@sdkwork/birdcoder-pc-core/appSessionToken';

import { readBirdCoderRuntimeEnv } from './sdkBaseUrls.ts';

/**
 * BirdCoder official model relay configuration.
 *
 * The recommended default model configuration routes every Agent provider
 * through the BirdCoder platform relay (`https://api.birdcoder.com`) instead
 * of vendor-direct endpoints, and authenticates with the current logged-in
 * session auth token as the API key. The relay domain can be overridden per
 * environment (staging/standalone) through the standard runtime env surface;
 * see `sdkBaseUrls.ts` for the shared env resolution conventions.
 */
export const BIRDCODER_OFFICIAL_MODEL_RELAY_BASE_URL = 'https://api.birdcoder.com';
const BIRDCODER_MODEL_RELAY_HTTP_ENV = 'VITE_SDKWORK_BIRDCODER_MODEL_RELAY_HTTP_URL';

export type BirdCoderModelVendorProtocol =
  | 'openai_compatible'
  | 'anthropic_messages'
  | 'google_gemini';

const VENDOR_PROTOCOL_BY_CODE: Readonly<Record<string, BirdCoderModelVendorProtocol>> = {
  anthropic: 'anthropic_messages',
  google: 'google_gemini',
  openai: 'openai_compatible',
};

const KNOWN_VENDOR_CODES = new Set(Object.keys(VENDOR_PROTOCOL_BY_CODE));

/**
 * Maps a vendor code to its wire protocol. Every provider CLI appends its
 * protocol path to the relay root, so unknown vendors default to the
 * OpenAI-compatible convention used by most relays.
 */
export function resolveBirdCoderVendorProtocol(
  vendorCode: string | null | undefined,
): BirdCoderModelVendorProtocol {
  const normalizedCode = vendorCode?.trim().toLowerCase() ?? '';
  return VENDOR_PROTOCOL_BY_CODE[normalizedCode] ?? 'openai_compatible';
}

function normalizeRelayBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/u, '');
  try {
    const parsedUrl = new URL(normalized);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('must use the HTTP or HTTPS protocol');
    }
    if (parsedUrl.username || parsedUrl.password) {
      throw new Error('must not contain embedded credentials');
    }
  } catch (error) {
    throw new Error(
      `BirdCoder model relay base URL must be an absolute HTTP(S) URL without credentials (${error instanceof Error ? error.message : String(error)}).`,
    );
  }
  return normalized;
}

function readConfiguredBirdCoderModelRelayBaseUrl(): string | undefined {
  const configured = readBirdCoderRuntimeEnv(BIRDCODER_MODEL_RELAY_HTTP_ENV)?.trim();
  return configured ? normalizeRelayBaseUrl(configured) : undefined;
}

/**
 * Resolves the BirdCoder official model relay base URL for a vendor protocol.
 *
 * Protocol path conventions mirror how each external CLI appends its wire
 * paths to a base URL:
 * - `openai_compatible` and the Codex Responses API append `/responses`
 *   (and `/chat/completions`) to `<root>/v1`.
 * - `anthropic_messages` SDKs append `/v1/messages` to the root.
 * - `google_gemini` SDKs append `/v1beta/...` to the root (the gemini-cli
 *   `GOOGLE_GEMINI_BASE_URL` gateway convention uses a root URL; the SDK
 *   adds the API version path itself).
 */
export function resolveBirdCoderModelRelayBaseUrl(
  protocol?: BirdCoderModelVendorProtocol | null,
): string {
  const relayRoot = readConfiguredBirdCoderModelRelayBaseUrl()
    ?? BIRDCODER_OFFICIAL_MODEL_RELAY_BASE_URL;
  switch (protocol ?? 'openai_compatible') {
    case 'anthropic_messages':
    case 'google_gemini':
      return relayRoot;
    case 'openai_compatible':
    default:
      return `${relayRoot}/v1`;
  }
}

/**
 * Resolves the API key used by the official BirdCoder model relay: the
 * current logged-in session auth token. Falls back to the persisted session
 * token when the in-memory token manager has not been hydrated yet.
 */
export function resolveBirdCoderModelRelayApiKey(): string {
  const liveToken = getBirdCoderGlobalTokenManager().getAuthToken()?.trim();
  if (liveToken) {
    return liveToken;
  }
  return getStoredAppSessionAuthToken()?.trim() ?? '';
}

/** True when the vendor is a first-party BirdCoder official vendor. */
export function isKnownBirdCoderModelVendor(vendorCode: string | null | undefined): boolean {
  return KNOWN_VENDOR_CODES.has(vendorCode?.trim().toLowerCase() ?? '');
}
