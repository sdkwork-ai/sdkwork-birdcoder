import {
  normalizeBirdCoderServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
} from '@sdkwork/birdcoder-pc-shell-runtime';

export function createRuntime(options: {
  configuredApiBaseUrl?: string;
  storedApiBaseUrl?: string;
} = {}) {
  const apiBaseUrl = resolveBirdCoderBootstrapServerBaseUrl({
    configuredApiBaseUrl: normalizeBirdCoderServerBaseUrl(options.configuredApiBaseUrl),
    storedApiBaseUrl: normalizeBirdCoderServerBaseUrl(options.storedApiBaseUrl),
  });

  return {
    apiBaseUrl,
  };
}
