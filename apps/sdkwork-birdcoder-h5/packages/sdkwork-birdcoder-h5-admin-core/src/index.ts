export const H5_ADMIN_CORE_VERSION = '0.1.0';

export interface AdminConfig {
  apiBaseUrl: string;
  operatorId: string;
}

export function createDefaultAdminConfig(): AdminConfig {
  return {
    apiBaseUrl: 'http://localhost:3000',
    operatorId: '',
  };
}

export {
  createBirdCoderH5BackendSdkClient,
  type BirdCoderH5BackendSdkClient,
} from './sdk/backendSdkClient.ts';
export {
  createBirdCoderMembershipBackendSdkClient,
  type CreateBirdCoderMembershipBackendSdkClientOptions,
} from './sdk/index.ts';
