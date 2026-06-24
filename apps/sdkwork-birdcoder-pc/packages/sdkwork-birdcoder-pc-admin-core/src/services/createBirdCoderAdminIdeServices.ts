import type { IAdminDeploymentService } from './interfaces/IAdminDeploymentService.ts';
import type { IAdminPolicyService } from './interfaces/IAdminPolicyService.ts';
import type { IAuditService } from './interfaces/IAuditService.ts';
import type { BirdCoderAdminBackendClient } from './ports/BirdCoderAdminBackendClient.ts';
import { ApiBackedAdminDeploymentService } from './impl/ApiBackedAdminDeploymentService.ts';
import { ApiBackedAdminPolicyService } from './impl/ApiBackedAdminPolicyService.ts';
import { ApiBackedAuditService } from './impl/ApiBackedAuditService.ts';

export interface BirdCoderAdminIdeServices {
  adminDeploymentService: IAdminDeploymentService;
  adminPolicyService: IAdminPolicyService;
  auditService: IAuditService;
}

export function createBirdCoderAdminIdeServices(
  backendClient: BirdCoderAdminBackendClient,
): BirdCoderAdminIdeServices {
  return {
    adminDeploymentService: new ApiBackedAdminDeploymentService({ backendClient }),
    adminPolicyService: new ApiBackedAdminPolicyService({ backendClient }),
    auditService: new ApiBackedAuditService({ backendClient }),
  };
}
