import type {
  SkillArtifactsPageData,
  SkillInstallationRecord,
  SkillPackagesPageData,
  SkillsSkillPackagesArtifactsListParams,
  SkillsSkillPackagesListParams,
} from '@sdkwork/birdcoder-pc-core/sdk/skills-app';
import type { AgentRecord } from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import type { McpServerRecord } from '@sdkwork/birdcoder-pc-core/sdk/mcp-app';
import type { SkillRecord } from '@sdkwork/birdcoder-pc-core/sdk/skills-app';

export interface CatalogPageInfo {
  mode: 'offset' | 'cursor';
  page?: number;
  pageSize?: number;
  totalItems?: string;
  totalPages?: number;
  nextCursor?: string | null;
  hasMore?: boolean;
}

export interface CatalogPage<TItem> {
  items: TItem[];
  pageInfo: CatalogPageInfo;
}

export interface WorkResourceListOptions {
  page?: number;
  pageSize?: number;
  query?: string;
  signal?: AbortSignal;
}

export interface AgentCatalogListOptions extends WorkResourceListOptions {
  scope: 'market' | 'mine';
}

export interface InstallSkillPackageOptions {
  artifactId: string;
  config?: Record<string, unknown>;
  projectId: string;
}

export interface ComposerProviderCapabilityItem {
  description: string;
  enabled: boolean;
  id: string;
  name: string;
  targetRef: string;
  source?: 'remote' | 'local';
  status?: 'enabled' | 'manifest-only' | 'unavailable';
}

export interface ComposerProviderCapabilityLoadError {
  message: string;
  source: 'remote' | 'local';
  providerId?: string;
}

export interface ComposerProviderCapabilities {
  plugins: ComposerProviderCapabilityItem[];
  skills: ComposerProviderCapabilityItem[];
  errors: ComposerProviderCapabilityLoadError[];
}

export interface ComposerProviderCapabilitiesOptions {
  agentId: string;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

export interface ICatalogService {
  getComposerProviderCapabilities(
    options: ComposerProviderCapabilitiesOptions,
  ): Promise<ComposerProviderCapabilities>;
  getSkillPackages(params?: SkillsSkillPackagesListParams): Promise<SkillPackagesPageData>;
  listInstallableArtifacts(
    packageId: string,
    params?: SkillsSkillPackagesArtifactsListParams,
  ): Promise<SkillArtifactsPageData>;
  installSkillPackage(
    packageId: string,
    options: InstallSkillPackageOptions,
  ): Promise<SkillInstallationRecord>;
  listAgents(options: AgentCatalogListOptions): Promise<CatalogPage<AgentRecord>>;
  listConnectors(options?: WorkResourceListOptions): Promise<CatalogPage<McpServerRecord>>;
  listSkills(options?: WorkResourceListOptions): Promise<CatalogPage<SkillRecord>>;
}
