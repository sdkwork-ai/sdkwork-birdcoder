import type { IWorkspace } from '@sdkwork/birdcoder-types';
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
    name: value.name,
    description: value.description,
    icon: 'Folder',
  };
}

export interface ProviderBackedWorkspaceServiceOptions {
  defaultOwnerIdentityId?: string;
  repository: BirdCoderTableRecordRepository<BirdCoderWorkspaceRecord>;
}

export class ProviderBackedWorkspaceService implements IWorkspaceService {
  private readonly defaultOwnerIdentityId: string;
  private readonly repository: BirdCoderTableRecordRepository<BirdCoderWorkspaceRecord>;

  constructor({
    defaultOwnerIdentityId = 'identity-local-default',
    repository,
  }: ProviderBackedWorkspaceServiceOptions) {
    this.defaultOwnerIdentityId = defaultOwnerIdentityId;
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
      name: normalizedName,
      description: description?.trim() || undefined,
      ownerIdentityId: this.defaultOwnerIdentityId,
      createdAt: now,
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
      name: 'Default Workspace',
      description: 'Primary local workspace for BirdCoder.',
      ownerIdentityId: this.defaultOwnerIdentityId,
      createdAt: now,
      updatedAt: now,
    });

    return this.repository.list();
  }
}
