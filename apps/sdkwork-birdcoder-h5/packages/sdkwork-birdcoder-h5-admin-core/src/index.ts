import {resolveBaseUrlWithAlignProtocol} from '@sdkwork/sdk-common';

export const H5_ADMIN_CORE_VERSION = '0.1.0';

export interface AdminConfig {
  apiBaseUrl: string;
  operatorId: string;
}

export function createDefaultAdminConfig(): AdminConfig {
  return {
    apiBaseUrl: resolveBaseUrlWithAlignProtocol().url,
    operatorId: '',
  };
}

export {} from './sdk/index.ts';
