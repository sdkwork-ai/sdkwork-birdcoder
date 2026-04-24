import type { BirdCoderWorkspaceSummary, IWorkspace } from '@sdkwork/birdcoder-types';
import type { IWorkspaceService } from '../interfaces/IWorkspaceService.ts';
import type { BirdCoderTableRecordRepository } from '../../storage/dataKernel.ts';
import type { BirdCoderWorkspaceRecord } from '../../storage/appConsoleRepository.ts';
import {
  BIRDCODER_DEFAULT_LOCAL_ORGANIZATION_ID,
  BIRDCODER_DEFAULT_LOCAL_OWNER_USER_ID,
  BIRDCODER_DEFAULT_LOCAL_TENANT_ID,
  createBirdCoderBootstrapWorkspaceRecord,
} from '../../storage/bootstrapConsoleCatalog.ts';

function createTimestamp(): string {
  return new Date().toISOString();
}

function createIdentifier(prefix: string): string {
  void prefix;
  const timestampPart = BigInt(Date.now()) * 1_000_000n;
  const randomPart = BigInt(Math.floor(Math.random() * 1_000_000));
  return (timestampPart + randomPart).toString();
}

function createUuid(): string {
  return crypto.randomUUID();
}

function mapWorkspaceRecordToWorkspace(value: BirdCoderWorkspaceRecord): IWorkspace {
  return {
    id: value.id,
    uuid: value.uuid,
    tenantId: value.tenantId,
    organizationId: value.organizationId,
    dataScope: value.dataScope,
    code: value.code,
    title: value.title,
    name: value.name,
    description: value.description,
    icon: value.icon,
    color: value.color,
    ownerId: value.ownerId,
    leaderId: value.leaderId,
    type: value.type,
    createdByUserId: value.createdByUserId,
    status: value.status === 'archived' ? 'archived' : 'active',
    startTime: value.startTime,
    endTime: value.endTime,
    maxMembers: value.maxMembers,
    currentMembers: value.currentMembers,
    memberCount: value.memberCount,
    maxStorage: value.maxStorage,
    usedStorage: value.usedStorage,
    settings: value.settings,
    isPublic: value.isPublic,
    isTemplate: value.isTemplate,
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
    defaultOwnerUserId = BIRDCODER_DEFAULT_LOCAL_OWNER_USER_ID,
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
      uuid: createUuid(),
      tenantId: BIRDCODER_DEFAULT_LOCAL_TENANT_ID,
      organizationId: BIRDCODER_DEFAULT_LOCAL_ORGANIZATION_ID,
      dataScope: 'PRIVATE',
      code: normalizedName,
      title: normalizedName,
      name: normalizedName,
      description: description?.trim() || undefined,
      icon: 'Folder',
      color: '#4f6f52',
      ownerId: this.defaultOwnerUserId,
      leaderId: this.defaultOwnerUserId,
      createdByUserId: this.defaultOwnerUserId,
      type: 'DEFAULT',
      settings: {},
      isPublic: false,
      isTemplate: false,
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
      dataScope: summary.dataScope ?? existingRecord?.dataScope ?? 'PRIVATE',
      code: summary.code?.trim() || existingRecord?.code || summary.id,
      title: summary.title?.trim() || existingRecord?.title || summary.name,
      name: summary.name.trim() || existingRecord?.name || summary.id,
      description: summary.description?.trim() || existingRecord?.description,
      icon: summary.icon?.trim() || existingRecord?.icon || 'Folder',
      color: summary.color?.trim() || existingRecord?.color,
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
      startTime: summary.startTime ?? existingRecord?.startTime,
      endTime: summary.endTime ?? existingRecord?.endTime,
      maxMembers: summary.maxMembers ?? existingRecord?.maxMembers,
      currentMembers: summary.currentMembers ?? existingRecord?.currentMembers,
      memberCount: summary.memberCount ?? existingRecord?.memberCount,
      maxStorage: summary.maxStorage ?? existingRecord?.maxStorage,
      usedStorage: summary.usedStorage ?? existingRecord?.usedStorage,
      settings: summary.settings ?? existingRecord?.settings,
      isPublic: summary.isPublic ?? existingRecord?.isPublic ?? false,
      isTemplate: summary.isTemplate ?? existingRecord?.isTemplate ?? false,
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

    await this.repository.save(createBirdCoderBootstrapWorkspaceRecord(this.defaultOwnerUserId));

    return this.repository.list();
  }
}
