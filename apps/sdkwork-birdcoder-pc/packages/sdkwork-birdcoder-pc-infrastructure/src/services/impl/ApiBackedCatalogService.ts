import type {
  BirdCoderAppTemplateSummary,
  BirdCoderSkillInstallationSummary,
  BirdCoderSkillPackageSummary,
} from '@sdkwork/birdcoder-pc-types';
import type {
  ICatalogService,
  InstallSkillPackageOptions,
} from '../interfaces/ICatalogService.ts';
import type { BirdCoderAppSdkApiClient } from '../sdkClients.ts';

export interface ApiBackedCatalogServiceOptions {
  appClient: BirdCoderAppSdkApiClient;
}

export class ApiBackedCatalogService implements ICatalogService {
  private readonly appClient: BirdCoderAppSdkApiClient;

  constructor({ appClient }: ApiBackedCatalogServiceOptions) {
    this.appClient = appClient;
  }

  async getAppTemplates(): Promise<BirdCoderAppTemplateSummary[]> {
    return this.appClient.listAppTemplates();
  }

  async getSkillPackages(workspaceId?: string): Promise<BirdCoderSkillPackageSummary[]> {
    return this.appClient.listSkillPackages({ workspaceId });
  }

  async installSkillPackage(
    packageId: string,
    options: InstallSkillPackageOptions,
  ): Promise<BirdCoderSkillInstallationSummary> {
    return this.appClient.installSkillPackage(packageId, {
      scopeId: options.workspaceId,
      scopeType: 'workspace',
    });
  }
}
