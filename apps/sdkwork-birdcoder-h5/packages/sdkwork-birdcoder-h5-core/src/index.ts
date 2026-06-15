export const H5_CORE_VERSION = '0.1.0';

export interface H5CoreConfig {
  apiBaseUrl: string;
  appVersion: string;
  environment: string;
}

export function createDefaultConfig(): H5CoreConfig {
  return {
    apiBaseUrl: 'http://localhost:3000',
    appVersion: '0.1.0',
    environment: 'development',
  };
}
