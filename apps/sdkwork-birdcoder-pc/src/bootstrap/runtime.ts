import {
  normalizeBirdCoderServerBaseUrl,
  resolveBirdCoderBootstrapServerBaseUrl,
} from '@sdkwork/birdcoder-pc-shell-runtime';

export function createRuntime(options: {
  configuredApplicationApiBaseUrl?: string;
  platformApiGatewayBaseUrl?: string;
  storedApiBaseUrl?: string;
} = {}) {
  const applicationApiBaseUrl = resolveBirdCoderBootstrapServerBaseUrl({
    configuredApiBaseUrl: normalizeBirdCoderServerBaseUrl(
      options.configuredApplicationApiBaseUrl,
    ),
    storedApiBaseUrl: normalizeBirdCoderServerBaseUrl(options.storedApiBaseUrl),
  });

  return {
    applicationApiBaseUrl,
    platformApiGatewayBaseUrl: options.platformApiGatewayBaseUrl,
  };
}
