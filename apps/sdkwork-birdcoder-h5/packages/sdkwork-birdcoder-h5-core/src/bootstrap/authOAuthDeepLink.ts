import { BIRDCODER_AUTH_BASE_PATH } from '@sdkwork/birdcoder-pc-auth';

export const BIRDCODER_H5_OAUTH_SCHEME = 'birdcoderh5';
export const BIRDCODER_H5_OAUTH_CALLBACK_AUTHORITY = 'auth';
export const BIRDCODER_H5_OAUTH_CALLBACK_PATH = '/oauth/callback';

export function buildBirdCoderH5OAuthCallbackReturnUrl(provider?: string): string {
  const url = new URL(
    `${BIRDCODER_H5_OAUTH_SCHEME}://${BIRDCODER_H5_OAUTH_CALLBACK_AUTHORITY}${BIRDCODER_H5_OAUTH_CALLBACK_PATH}`,
  );
  const normalizedProvider = provider?.trim();
  if (normalizedProvider) {
    url.searchParams.set('provider', normalizedProvider);
  }
  return url.toString();
}

function joinAuthPath(path: string, search: string): string {
  const normalizedPath = path.replace(/\/+$/, '') || '/';
  return search ? `${normalizedPath}${search}` : normalizedPath;
}

function isBirdCoderAuthPath(path: string): boolean {
  const normalized = path.replace(/\/+$/, '') || '/';
  return normalized === BIRDCODER_AUTH_BASE_PATH
    || normalized.startsWith(`${BIRDCODER_AUTH_BASE_PATH}/`);
}

export function normalizeBirdCoderH5AuthDeepLinkPath(rawUrl: string): string | null {
  try {
    const uri = new URL(rawUrl);
    const search = uri.search || '';
    const candidates = [
      joinAuthPath(uri.pathname, search),
      uri.host ? joinAuthPath(`/${uri.host}${uri.pathname}`, search) : '',
      uri.host && !uri.pathname ? joinAuthPath(`/${uri.host}`, search) : '',
    ];

    for (const candidate of candidates) {
      if (isBirdCoderAuthPath(candidate)) {
        return candidate;
      }
    }
  } catch {
    return null;
  }

  return null;
}
