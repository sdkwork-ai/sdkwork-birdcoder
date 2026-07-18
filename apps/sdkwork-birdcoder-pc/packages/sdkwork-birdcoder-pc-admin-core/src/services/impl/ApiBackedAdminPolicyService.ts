import type {
  IAdminPolicyService,
  SaveCodeEngineSandboxPolicyInput,
} from '../interfaces/IAdminPolicyService.ts';
import type { BirdCoderAdminBackendClient } from '../ports/BirdCoderAdminBackendClient.ts';

export interface ApiBackedAdminPolicyServiceOptions {
  backendClient: BirdCoderAdminBackendClient;
}

export class ApiBackedAdminPolicyService implements IAdminPolicyService {
  private readonly backendClient: BirdCoderAdminBackendClient;

  constructor({ backendClient }: ApiBackedAdminPolicyServiceOptions) {
    this.backendClient = backendClient;
  }

  async getPolicies() {
    return this.backendClient.listPolicies();
  }

  async saveSandboxPolicy(input: SaveCodeEngineSandboxPolicyInput) {
    const scopeId = input.scopeId.trim();
    if (!scopeId) {
      throw new Error('Sandbox policy scopeId is required.');
    }
    if (input.scopeType === 'user' && !/^[A-Za-z0-9._-]+$/u.test(scopeId)) {
      throw new Error('Sandbox policy user scopeId contains unsupported characters.');
    }
    const allowedDirectories = (input.allowedDirectories ?? [])
      .map((directory) => directory.trim())
      .filter(Boolean);
    if (input.accessMode === 'directories' && allowedDirectories.length === 0) {
      throw new Error('Directory sandbox policies require at least one allowed directory.');
    }

    const policy = {
      policyCategory: 'code-engine-sandbox',
      scopeType: input.scopeType,
      scopeId,
      accessMode: input.accessMode,
      allowedDirectories,
    };
    const name = input.scopeType === 'tenant'
      ? 'BirdCoder code-engine sandbox (tenant)'
      : `BirdCoder code-engine sandbox (user ${scopeId})`;

    if (input.policyId) {
      return this.backendClient.updatePolicy(input.policyId, { name, policy, status: 'active' });
    }
    const code = input.scopeType === 'tenant'
      ? 'birdcoder.code-engine-sandbox.tenant'
      : `birdcoder.code-engine-sandbox.user.${scopeId}`;
    return this.backendClient.createPolicy({ code, name, policy });
  }

  async deleteSandboxPolicy(policyId: string) {
    const normalizedPolicyId = policyId.trim();
    if (!normalizedPolicyId) {
      throw new Error('Sandbox policyId is required.');
    }
    await this.backendClient.deletePolicy(normalizedPolicyId);
  }
}
