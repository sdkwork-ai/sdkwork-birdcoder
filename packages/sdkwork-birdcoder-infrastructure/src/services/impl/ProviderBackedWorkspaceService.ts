import type { BirdCoderWorkspaceSummary, IWorkspace } from '@sdkwork/birdcoder-types';
import type { IWorkspaceService } from '../interfaces/IWorkspaceService.ts';
import type { BirdCoderTableRecordRepository } from '../../storage/dataKernel.ts';
import type { BirdCoderWorkspaceRecord } from '../../storage/appConsoleRepository.ts';

function createTimestamp(): string {
  return new Date().toISOString();
}

function createIdentifier(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapWorkspaceRecordToWorkspace(value: BirdCoderWorkspaceRecord): IWorkspace {
  return {
    id: value.id,
    uuid: value.uuid,
    tenantId: value.tenantId,
    organizationId: value.organizationId,
    code: value.code,
    title: value.title,
    name: value.name,
    description: value.description,
    icon: 'Folder',
    ownerId: value.ownerId,
    leaderId: value.leaderId,
    type: value.type,
    createdByUserId: value.createdByUserId,
  };
}

export interface ProviderBackedWorkspaceServiceOptions {
  defaultOwnerUserId?: string;
  repository: BirdCoderTableRecordRepository<BirdCoderWorkspaceRecord>;
}

export class ProviderBackedWorkspaceService implements IWorkspaceService {
  private readonly defaultOwnerUserId: string;
  private readonly repository: BirdCoderTableRecordRepository<BirdCoderWorkspaceRecord>;

  constructor({
    defaultOwnerUserId = 'user-local-default',
    repository,
  }: ProviderBackedWorkspaceServiceOptions) {
    this.defaultOwnerUserId = defaultOwnerUserId;
    this.repository = repository;
  }

  async getWorkspaces(): Promise<IWorkspace[]> {
    const records = await this.ensureBootstrapWorkspace();
    return records.map(mapWorkspaceRecordToWorkspace);
  }

  async createWorkspace(name: string, description?: string): Promise<IWorkspace> {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new Error('Workspace name is required');
    }

    const now = createTimestamp();
    const record = await this.repository.save({
      id: createIdentifier('workspace'),
      uuid: createIdentifier('workspace-uuid'),
      tenantId: 'tenant-local-default',
      code: normalizedName,
      title: normalizedName,
      name: normalizedName,
      description: description?.trim() || undefined,
      ownerId: this.defaultOwnerUserId,
      leaderId: this.defaultOwnerUserId,
      createdByUserId: this.defaultOwnerUserId,
      type: 'DEFAULT',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    return mapWorkspaceRecordToWorkspace(record);
  }

  async syncWorkspaceSummary(summary: BirdCoderWorkspaceSummary): Promise<IWorkspace> {
    const existingRecord = await this.repository.findById(summary.id);
    const now = createTimestamp();
    const record = await this.repository.save({
      id: summary.id,
      uuid: summary.uuid ?? existingRecord?.uuid ?? summary.id,
      tenantId: summary.tenantId ?? existingRecord?.tenantId,
      organizationId: summary.organizationId ?? existingRecord?.organizationId,
      code: summary.code?.trim() || existingRecord?.code || summary.id,
      title: summary.title?.trim() || existingRecord?.title || summary.name,
      name: summary.name.trim() || existingRecord?.name || summary.id,
      description: summary.description?.trim() || existingRecord?.description,
      ownerId:
        summary.ownerId?.trim() ||
        existingRecord?.ownerId ||
        this.defaultOwnerUserId,
      leaderId:
        summary.leaderId?.trim() ||
        existingRecord?.leaderId ||
        summary.ownerId?.trim() ||
        this.defaultOwnerUserId,
      createdByUserId:
        summary.createdByUserId?.trim() ||
        existingRecord?.createdByUserId ||
        summary.ownerId?.trim() ||
        existingRecord?.ownerId ||
        this.defaultOwnerUserId,
      type: summary.type?.trim() || existingRecord?.type || 'DEFAULT',
      status: summary.status,
      createdAt: existingRecord?.createdAt || now,
      updatedAt: now,
    });
    return mapWorkspaceRecordToWorkspace(record);
  }

  async updateWorkspace(id: string, name: string): Promise<IWorkspace> {
    const existingRecord = await this.repository.findById(id);
    if (!existingRecord) {
      throw new Error('Workspace not found');
    }

    const updatedRecord = await this.repository.save({
      ...existingRecord,
      name: name.trim() || existingRecord.name,
      updatedAt: createTimestamp(),
    });
    return mapWorkspaceRecordToWorkspace(updatedRecord);
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private async ensureBootstrapWorkspace(): Promise<BirdCoderWorkspaceRecord[]> {
    const existingRecords = await this.repository.list();
    if (existingRecords.length > 0) {
      return existingRecords;
    }

    const now = createTimestamp();
    await this.repository.save({
      id: 'workspace-default',
      uuid: 'workspace-default',
      tenantId: 'tenant-local-default',
      code: 'workspace-default',
      title: 'Default Workspace',
      name: 'Default Workspace',
      description: 'Primary local workspace for BirdCoder.',
      ownerId: this.defaultOwnerUserId,
      leaderId: this.defaultOwnerUserId,
      createdByUserId: this.defaultOwnerUserId,
      type: 'DEFAULT',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    return this.repository.list();
  }
}
