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

export type {
  CodeEngineSandboxAccessMode,
  CodeEngineSandboxScopeType,
  IAdminPolicyService,
  SaveCodeEngineSandboxPolicyInput,
} from './services/interfaces/IAdminPolicyService.ts';
export type { IAuditService } from './services/interfaces/IAuditService.ts';
export {
  createUnavailableAdminPolicyService,
  createUnavailableAuditService,
} from './services/impl/UnavailableAdminServices.ts';
export {
  createBirdCoderMembershipBackendSdkClient,
  type CreateBirdCoderMembershipBackendSdkClientOptions,
} from './sdk/membershipBackendSdkClient.ts';

export * from './hooks/useAdminPolicies.ts';
export * from './hooks/useAuditEvents.ts';
