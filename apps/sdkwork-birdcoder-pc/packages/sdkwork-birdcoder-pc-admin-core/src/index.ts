export const PC_ADMIN_CORE_VERSION = '0.1.0';

export interface AdminConfig {
  apiBaseUrl: string;
  operatorId: string;
}

export function createDefaultAdminConfig(): AdminConfig {
  return {
    apiBaseUrl: 'http://localhost:10240',
    operatorId: '',
  };
}
