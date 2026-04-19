import type {
  BirdCoderAppAdminApiClient,
  BirdCoderAppTemplateSummary,
  BirdCoderSkillInstallationSummary,
  BirdCoderSkillPackageSummary,
} from '@sdkwork/birdcoder-types';
import type {
  ICatalogService,
  InstallSkillPackageOptions,
} from '../interfaces/ICatalogService.ts';

export interface ApiBackedCatalogServiceOptions {
  client: BirdCoderAppAdminApiClient;
}

export class ApiBackedCatalogService implements ICatalogService {
  private readonly client: BirdCoderAppAdminApiClient;

  constructor({ client }: ApiBackedCatalogServiceOptions) {
    this.client = client;
  }

  async getAppTemplates(): Promise<BirdCoderAppTemplateSummary[]> {
    return this.client.listAppTemplates();
  }

  async getSkillPackages(workspaceId?: string): Promise<BirdCoderSkillPackageSummary[]> {
    return this.client.listSkillPackages({ workspaceId });
  }

  async installSkillPackage(
    packageId: string,
    options: InstallSkillPackageOptions,
  ): Promise<BirdCoderSkillInstallationSummary> {
    return this.client.installSkillPackage(packageId, {
      scopeId: options.workspaceId,
      scopeType: 'workspace',
    });
  }
}
