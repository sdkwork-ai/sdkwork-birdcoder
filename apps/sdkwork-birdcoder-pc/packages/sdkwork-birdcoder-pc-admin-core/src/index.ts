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

export type { IAdminDeploymentService } from './services/interfaces/IAdminDeploymentService.ts';
export type { IAdminPolicyService } from './services/interfaces/IAdminPolicyService.ts';
export type { IAuditService } from './services/interfaces/IAuditService.ts';
export type { BirdCoderAdminBackendClient } from './services/ports/BirdCoderAdminBackendClient.ts';
export {
  ApiBackedAdminDeploymentService,
  type ApiBackedAdminDeploymentServiceOptions,
} from './services/impl/ApiBackedAdminDeploymentService.ts';
export {
  ApiBackedAdminPolicyService,
  type ApiBackedAdminPolicyServiceOptions,
} from './services/impl/ApiBackedAdminPolicyService.ts';
export {
  ApiBackedAuditService,
  type ApiBackedAuditServiceOptions,
} from './services/impl/ApiBackedAuditService.ts';

export * from './hooks/useAdminDeployments.ts';
export * from './hooks/useAdminPolicies.ts';
export * from './hooks/useAuditEvents.ts';
