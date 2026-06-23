import {
  normalizeBirdCoderServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
} from '@sdkwork/birdcoder-h5-core';

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

export {
  normalizeBirdCoderServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
};
