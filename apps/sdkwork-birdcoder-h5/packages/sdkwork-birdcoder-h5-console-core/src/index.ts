import { resolveBaseUrlWithAlignProtocol } from '@sdkwork/sdk-common';

export const H5_CONSOLE_CORE_VERSION = '0.1.0';

export interface ConsoleConfig {
  apiBaseUrl: string;
  tenantId: string;
}

export function createDefaultConsoleConfig(): ConsoleConfig {
  return {
    apiBaseUrl: resolveBaseUrlWithAlignProtocol().url,
    tenantId: '',
  };
}
