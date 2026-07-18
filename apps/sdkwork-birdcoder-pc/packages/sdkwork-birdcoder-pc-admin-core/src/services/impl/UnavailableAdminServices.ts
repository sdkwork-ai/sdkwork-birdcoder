import type { BirdCoderDeploymentRecordSummary, BirdCoderIamAuditEventSummary, BirdCoderIamPolicySummary } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAdminDeploymentService } from '../interfaces/IAdminDeploymentService.ts';
import type { IAdminPolicyService } from '../interfaces/IAdminPolicyService.ts';
import type { IAuditService } from '../interfaces/IAuditService.ts';

const ADMIN_SURFACE_REQUIRED_MESSAGE =
  'Backend-admin services require the admin shell bootstrap with an explicit backend SDK client.';

export class UnavailableAdminDeploymentService implements IAdminDeploymentService {
  async getDeployments(): Promise<BirdCoderDeploymentRecordSummary[]> {
    throw new Error(ADMIN_SURFACE_REQUIRED_MESSAGE);
  }
}

export class UnavailableAdminPolicyService implements IAdminPolicyService {
  async getPolicies(): Promise<BirdCoderIamPolicySummary[]> {
    throw new Error(ADMIN_SURFACE_REQUIRED_MESSAGE);
  }

  async saveSandboxPolicy(): Promise<BirdCoderIamPolicySummary> {
    throw new Error(ADMIN_SURFACE_REQUIRED_MESSAGE);
  }

  async deleteSandboxPolicy(): Promise<void> {
    throw new Error(ADMIN_SURFACE_REQUIRED_MESSAGE);
  }
}

export class UnavailableAuditService implements IAuditService {
  async getAuditEvents(): Promise<BirdCoderIamAuditEventSummary[]> {
    throw new Error(ADMIN_SURFACE_REQUIRED_MESSAGE);
  }
}

export function createUnavailableAdminDeploymentService(): IAdminDeploymentService {
  return new UnavailableAdminDeploymentService();
}

export function createUnavailableAdminPolicyService(): IAdminPolicyService {
  return new UnavailableAdminPolicyService();
}

export function createUnavailableAuditService(): IAuditService {
  return new UnavailableAuditService();
}
