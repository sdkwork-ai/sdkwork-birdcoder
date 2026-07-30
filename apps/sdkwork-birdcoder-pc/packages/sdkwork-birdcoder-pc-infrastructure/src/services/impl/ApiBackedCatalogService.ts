import type {
  AgentCompositionSlotRecord,
  AgentRecord,
  AgentsAppSdkClient,
  McpServerMarketplaceRecord,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import type {
  McpAppSdkClient,
  McpServerRecord,
} from '@sdkwork/birdcoder-pc-core/sdk/mcp-app';
import type {
  SdkworkSkillsAppClient,
  SkillArtifactsPageData,
  SkillInstallationRecord,
  SkillPackageRecord,
  SkillPackagesPageData,
  SkillRecord,
  SkillsSkillPackagesArtifactsListParams,
  SkillsSkillPackagesListParams,
} from '@sdkwork/birdcoder-pc-core/sdk/skills-app';
import type {
  ComposerProviderCapabilities,
  ComposerProviderCapabilitiesOptions,
  ComposerProviderCapabilityItem,
  ICatalogService,
  AgentCatalogListOptions,
  CatalogPage,
  CatalogPageInfo,
  InstallSkillPackageOptions,
  WorkResourceListOptions,
} from '../interfaces/ICatalogService.ts';
import {
  createBirdCoderLocalPluginCatalogRuntime,
  type LocalPluginCatalogRuntime,
} from '../../platform/localPluginCatalogRuntime.ts';

export interface ApiBackedCatalogServiceOptions {
  agentsClient: AgentsAppSdkClient;
  mcpClient: McpAppSdkClient;
  skillsClient: SdkworkSkillsAppClient;
  localPluginRuntime?: LocalPluginCatalogRuntime;
}

const DEFAULT_COMPOSER_CAPABILITY_PAGE_SIZE = 20;
const MAX_COMPOSER_CAPABILITY_PAGE_SIZE = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isMcpServerRecord(value: unknown): value is McpServerRecord {
  if (!isRecord(value)) return false;
  return [value.id, value.uuid, value.server_key, value.name, value.transport]
    .every((field) => typeof field === 'string');
}

function toCatalogPageInfo(
  value: unknown,
  fallbackPage: number,
  fallbackPageSize: number,
): CatalogPageInfo {
  const pageInfo = isRecord(value) ? value : {};
  return {
    mode: pageInfo.mode === 'cursor' ? 'cursor' : 'offset',
    page: typeof pageInfo.page === 'number' ? pageInfo.page : fallbackPage,
    pageSize: typeof pageInfo.pageSize === 'number' ? pageInfo.pageSize : fallbackPageSize,
    totalItems: typeof pageInfo.totalItems === 'string' ? pageInfo.totalItems : undefined,
    totalPages: typeof pageInfo.totalPages === 'number' ? pageInfo.totalPages : undefined,
    nextCursor: typeof pageInfo.nextCursor === 'string' || pageInfo.nextCursor === null
      ? pageInfo.nextCursor
      : undefined,
    hasMore: typeof pageInfo.hasMore === 'boolean' ? pageInfo.hasMore : undefined,
  };
}

function toCatalogPage<TItem>(
  value: unknown,
  fallbackPage: number,
  fallbackPageSize: number,
  resourceName: string,
): CatalogPage<TItem> {
  const candidate = isRecord(value) && isRecord(value.data) ? value.data : value;
  if (!isRecord(candidate) || !Array.isArray(candidate.items)) {
    throw new Error(`${resourceName} catalog returned an invalid page payload.`);
  }

  return {
    items: candidate.items as TItem[],
    pageInfo: toCatalogPageInfo(candidate.pageInfo, fallbackPage, fallbackPageSize),
  };
}

function toMcpCatalogPage(
  value: unknown,
  fallbackPage: number,
  fallbackPageSize: number,
): CatalogPage<McpServerRecord> {
  const candidate = isRecord(value) && isRecord(value.data) ? value.data : value;
  if (!isRecord(candidate) || !Array.isArray(candidate.items)) {
    throw new Error('MCP server catalog returned an invalid page payload.');
  }

  const items = candidate.items.filter(isMcpServerRecord);
  if (items.length !== candidate.items.length) {
    throw new Error('MCP server catalog returned an invalid server record.');
  }

  return {
    items,
    pageInfo: toCatalogPageInfo(candidate.pageInfo, fallbackPage, fallbackPageSize),
  };
}

function normalizePage(value: number | undefined): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : 1;
}

function normalizePageSize(value: number | undefined): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    return DEFAULT_COMPOSER_CAPABILITY_PAGE_SIZE;
  }
  return Math.min(Number(value), MAX_COMPOSER_CAPABILITY_PAGE_SIZE);
}

function resolveLocalPluginProviderId(agentId: string): string {
  const normalized = agentId.trim().toLowerCase();
  if (normalized.includes('claude')) return 'provider.plugin.claude-code';
  if (normalized.includes('opencode')) return 'provider.plugin.opencode';
  if (normalized.includes('gemini')) return 'provider.plugin.gemini-cli';
  return 'provider.plugin.codex';
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
    source: 'remote',
    status: plugin.enabled ? 'enabled' : 'unavailable',
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
    source: 'remote',
    status: slot.enabled && slot.status === 'active' ? 'enabled' : 'unavailable',
  };
}

export class ApiBackedCatalogService implements ICatalogService {
  private readonly agentsClient: AgentsAppSdkClient;
  private readonly mcpClient: McpAppSdkClient;
  private readonly skillsClient: SdkworkSkillsAppClient;
  private readonly localPluginRuntime: LocalPluginCatalogRuntime;

  constructor({
    agentsClient,
    mcpClient,
    skillsClient,
    localPluginRuntime = createBirdCoderLocalPluginCatalogRuntime(),
  }: ApiBackedCatalogServiceOptions) {
    this.agentsClient = agentsClient;
    this.mcpClient = mcpClient;
    this.skillsClient = skillsClient;
    this.localPluginRuntime = localPluginRuntime;
  }

  async getComposerProviderCapabilities({
    agentId,
    page,
    pageSize,
    signal,
  }: ComposerProviderCapabilitiesOptions): Promise<ComposerProviderCapabilities> {
    signal?.throwIfAborted();
    const normalizedAgentId = agentId.trim();
    if (!normalizedAgentId) {
      return { plugins: [], skills: [], errors: [] };
    }

    const boundedPage = normalizePage(page);
    const boundedPageSize = normalizePageSize(pageSize);
    const [mcpResult, slotResult, skillPackageResult, localResult] = await Promise.allSettled([
      this.agentsClient.ai.agents.mcpServers.list({
        page: boundedPage,
        pageSize: boundedPageSize,
      }, { signal }),
      this.agentsClient.ai.agents.compositionSlots.list(normalizedAgentId, {
        page: boundedPage,
        pageSize: boundedPageSize,
      }, { signal }),
      this.skillsClient.skills.skillPackages.list({
        page: boundedPage,
        pageSize: boundedPageSize,
      }, { signal }),
      this.localPluginRuntime.discover(resolveLocalPluginProviderId(normalizedAgentId)),
    ]);
    signal?.throwIfAborted();
    const errors = [] as ComposerProviderCapabilities['errors'];
    const mcpPage = mcpResult.status === 'fulfilled' ? mcpResult.value : null;
    const slotPage = slotResult.status === 'fulfilled' ? slotResult.value : null;
    const skillPackagePage = skillPackageResult.status === 'fulfilled' ? skillPackageResult.value : null;
    if (!mcpPage) errors.push({ message: 'Remote plugin catalog could not be loaded.', source: 'remote' });
    if (!slotPage || !skillPackagePage) errors.push({ message: 'Remote skill catalog could not be loaded.', source: 'remote' });
    const localCatalog = localResult.status === 'fulfilled' ? localResult.value : null;
    if (!localCatalog && localResult.status === 'rejected') errors.push({ message: 'Local plugin catalog could not be loaded.', source: 'local' });
    if (localCatalog) errors.push(...localCatalog.errors.map((error) => ({ message: error.message, source: 'local' as const, providerId: error.providerId })));

    const remotePlugins = (mcpPage?.items as McpServerMarketplaceRecord[] | undefined ?? [])
      .filter((plugin) => plugin.agentId === normalizedAgentId)
      .map(toPluginCapability);
    const remoteSkills = (slotPage?.items as AgentCompositionSlotRecord[] | undefined ?? [])
      .filter((slot) => slot.slotKind === 'skill')
      .map((slot) => toSkillCapability(slot, (skillPackagePage?.items as SkillPackageRecord[] | undefined) ?? []));
    const localPlugins = localCatalog?.plugins.map((plugin) => ({
      description: plugin.description?.trim() || plugin.rootPath,
      enabled: plugin.status !== 'unavailable',
      id: plugin.id,
      name: plugin.name,
      targetRef: `plugin://${plugin.name}`,
      source: 'local' as const,
      status: plugin.status === 'manifest-only' ? 'manifest-only' as const : plugin.status === 'unavailable' ? 'unavailable' as const : 'enabled' as const,
    })) ?? [];
    const localSkills = localCatalog?.plugins.flatMap((plugin) => plugin.skills.map((skill) => ({
      description: skill.description?.trim() || skill.path,
      enabled: plugin.status !== 'unavailable',
      id: skill.id,
      name: skill.name,
      targetRef: skill.name,
      source: 'local' as const,
      status: plugin.status === 'manifest-only' ? 'manifest-only' as const : plugin.status === 'unavailable' ? 'unavailable' as const : 'enabled' as const,
    }))) ?? [];

    return { plugins: [...localPlugins, ...remotePlugins], skills: [...localSkills, ...remoteSkills], errors };
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

  async listAgents({
    page,
    pageSize,
    query,
    scope,
    signal,
  }: AgentCatalogListOptions): Promise<CatalogPage<AgentRecord>> {
    const boundedPage = normalizePage(page);
    const boundedPageSize = normalizePageSize(pageSize);
    const result = await this.agentsClient.ai.agents.list(
      {
        page: boundedPage,
        pageSize: boundedPageSize,
        q: query?.trim() || undefined,
        scope,
      },
      { signal },
    );
    return toCatalogPage<AgentRecord>(result, boundedPage, boundedPageSize, 'Agent');
  }

  async listSkills({
    page,
    pageSize,
    query,
    signal,
  }: WorkResourceListOptions = {}): Promise<CatalogPage<SkillRecord>> {
    const boundedPage = normalizePage(page);
    const boundedPageSize = normalizePageSize(pageSize);
    const result = await this.skillsClient.skills.marketplace.list(
      {
        page: boundedPage,
        pageSize: boundedPageSize,
        q: query?.trim() || undefined,
      },
      { signal },
    );
    return toCatalogPage<SkillRecord>(result, boundedPage, boundedPageSize, 'Skill');
  }

  async listConnectors({
    page,
    pageSize,
    query,
    signal,
  }: WorkResourceListOptions = {}): Promise<CatalogPage<McpServerRecord>> {
    signal?.throwIfAborted();
    const boundedPage = normalizePage(page);
    const boundedPageSize = normalizePageSize(pageSize);
    const result = await this.mcpClient.mcp.listServers({
      page: boundedPage,
      pageSize: boundedPageSize,
      q: query?.trim() || undefined,
    });
    signal?.throwIfAborted();
    return toMcpCatalogPage(result, boundedPage, boundedPageSize);
  }
}
