import type {
  AgentCompositionSlotRecord,
  AgentsAppSdkClient,
  McpServerMarketplaceRecord,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import type {
  SdkworkSkillsAppClient,
  SkillArtifactsPageData,
  SkillInstallationRecord,
  SkillPackageRecord,
  SkillPackagesPageData,
  SkillsSkillPackagesArtifactsListParams,
  SkillsSkillPackagesListParams,
} from '@sdkwork/birdcoder-pc-core/sdk/skills-app';
import type {
  ComposerProviderCapabilities,
  ComposerProviderCapabilitiesOptions,
  ComposerProviderCapabilityItem,
  ICatalogService,
  InstallSkillPackageOptions,
} from '../interfaces/ICatalogService.ts';

export interface ApiBackedCatalogServiceOptions {
  agentsClient: AgentsAppSdkClient;
  skillsClient: SdkworkSkillsAppClient;
}

const DEFAULT_COMPOSER_CAPABILITY_PAGE_SIZE = 20;
const MAX_COMPOSER_CAPABILITY_PAGE_SIZE = 50;

function normalizePage(value: number | undefined): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : 1;
}

function normalizePageSize(value: number | undefined): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    return DEFAULT_COMPOSER_CAPABILITY_PAGE_SIZE;
  }
  return Math.min(Number(value), MAX_COMPOSER_CAPABILITY_PAGE_SIZE);
}

function normalizeReference(value: string): string {
  return value.trim().toLowerCase();
}

function referenceTail(value: string): string {
  return normalizeReference(value).split(/[/:#]/u).filter(Boolean).at(-1) ?? '';
}

function humanizeReference(value: string): string {
  const candidate = value.trim().split(/[/:#]/u).filter(Boolean).at(-1) ?? value.trim();
  return candidate
    .replace(/[-_.]+/gu, ' ')
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function packageReferences(skillPackage: SkillPackageRecord): string[] {
  return [
    skillPackage.id,
    skillPackage.uuid,
    skillPackage.skillKey,
    skillPackage.packageKey,
    skillPackage.code,
  ].flatMap((value) => [normalizeReference(value), referenceTail(value)]).filter(Boolean);
}

function findSkillPackage(
  targetRef: string,
  skillPackages: readonly SkillPackageRecord[],
): SkillPackageRecord | undefined {
  const references = new Set([normalizeReference(targetRef), referenceTail(targetRef)]);
  return skillPackages.find((skillPackage) =>
    packageReferences(skillPackage).some((reference) => references.has(reference)),
  );
}

function toPluginCapability(
  plugin: McpServerMarketplaceRecord,
): ComposerProviderCapabilityItem {
  const targetRef = plugin.targetRef.trim() || plugin.serverId.trim();
  return {
    description: plugin.serverId.trim() || targetRef,
    enabled: plugin.enabled,
    id: plugin.slotId.trim() || plugin.serverId.trim() || targetRef,
    name: humanizeReference(targetRef || plugin.serverId),
    targetRef,
  };
}

function toSkillCapability(
  slot: AgentCompositionSlotRecord,
  skillPackages: readonly SkillPackageRecord[],
): ComposerProviderCapabilityItem {
  const skillPackage = findSkillPackage(slot.targetRef, skillPackages);
  const targetRef = slot.targetRef.trim();
  return {
    description:
      skillPackage?.summary?.trim()
      || skillPackage?.description?.trim()
      || targetRef,
    enabled: slot.enabled && slot.status === 'active',
    id: slot.slotId.trim() || String(slot.id),
    name: skillPackage?.displayName.trim() || humanizeReference(targetRef),
    targetRef,
  };
}

export class ApiBackedCatalogService implements ICatalogService {
  private readonly agentsClient: AgentsAppSdkClient;
  private readonly skillsClient: SdkworkSkillsAppClient;

  constructor({ agentsClient, skillsClient }: ApiBackedCatalogServiceOptions) {
    this.agentsClient = agentsClient;
    this.skillsClient = skillsClient;
  }

  async getComposerProviderCapabilities({
    agentId,
    page,
    pageSize,
  }: ComposerProviderCapabilitiesOptions): Promise<ComposerProviderCapabilities> {
    const normalizedAgentId = agentId.trim();
    if (!normalizedAgentId) {
      return { plugins: [], skills: [] };
    }

    const boundedPage = normalizePage(page);
    const boundedPageSize = normalizePageSize(pageSize);
    const [mcpPage, slotPage, skillPackagePage] = await Promise.all([
      this.agentsClient.ai.agents.mcpServers.list({
        page: boundedPage,
        pageSize: boundedPageSize,
      }),
      this.agentsClient.ai.agents.compositionSlots.list(normalizedAgentId, {
        page: boundedPage,
        pageSize: boundedPageSize,
      }),
      this.skillsClient.skills.skillPackages.list({
        page: boundedPage,
        pageSize: boundedPageSize,
      }),
    ]);

    const plugins = (mcpPage.items as McpServerMarketplaceRecord[])
      .filter((plugin) => plugin.agentId === normalizedAgentId)
      .map(toPluginCapability);
    const skills = (slotPage.items as AgentCompositionSlotRecord[])
      .filter((slot) => slot.slotKind === 'skill')
      .map((slot) => toSkillCapability(slot, skillPackagePage.items));

    return { plugins, skills };
  }

  async getSkillPackages(
    params?: SkillsSkillPackagesListParams,
  ): Promise<SkillPackagesPageData> {
    return this.skillsClient.skills.skillPackages.list(params);
  }

  async listInstallableArtifacts(
    packageId: string,
    params?: SkillsSkillPackagesArtifactsListParams,
  ): Promise<SkillArtifactsPageData> {
    return this.skillsClient.skills.skillPackages.artifacts.list(packageId, params);
  }

  async installSkillPackage(
    packageId: string,
    options: InstallSkillPackageOptions,
  ): Promise<SkillInstallationRecord> {
    return this.skillsClient.skills.skillPackages.installations.create(packageId, {
      artifactId: options.artifactId,
      target: {
        id: options.projectId,
        kind: 'project',
      },
      ...(options.config ? { config: options.config } : {}),
    });
  }
}
