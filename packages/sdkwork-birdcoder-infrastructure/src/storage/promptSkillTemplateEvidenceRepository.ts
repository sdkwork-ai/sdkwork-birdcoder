import {
  BIRDCODER_APP_TEMPLATE_INSTANTIATION_STORAGE_BINDING,
  BIRDCODER_PROMPT_EVALUATION_STORAGE_BINDING,
  BIRDCODER_PROMPT_RUN_STORAGE_BINDING,
  getBirdCoderEntityDefinition,
  type BirdCoderDatabaseProviderId,
} from '@sdkwork/birdcoder-types';
import {
  createBirdCoderTableRecordRepository,
  type BirdCoderStorageAccess,
  type BirdCoderTableRecordRepository,
} from './dataKernel.ts';
import { coerceBirdCoderSqlEntityRow } from './sqlRowCodec.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sortByUpdatedAtDescending<
  TRecord extends {
    id: string;
    updatedAt: string;
  },
>(left: TRecord, right: TRecord): number {
  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}

export interface BirdCoderPromptRunEvidenceRecord {
  id: string;
  projectId: string;
  codingSessionId: string;
  promptBundleId: string;
  promptAssetVersionId: string;
  status: string;
  inputSnapshotRef: string;
  outputSnapshotRef: string;
  createdAt: string;
  updatedAt: string;
}

export interface BirdCoderPromptEvaluationEvidenceRecord {
  id: string;
  promptRunId: string;
  evaluator: string;
  score: number;
  summary: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BirdCoderAppTemplateInstantiationEvidenceRecord {
  id: string;
  projectId: string;
  appTemplateVersionId: string;
  presetKey: string;
  status: string;
  outputRoot: string;
  createdAt: string;
  updatedAt: string;
}

export interface BirdCoderPromptSkillTemplateEvidenceRepositories {
  promptEvaluations: BirdCoderTableRecordRepository<BirdCoderPromptEvaluationEvidenceRecord>;
  promptRuns: BirdCoderTableRecordRepository<BirdCoderPromptRunEvidenceRecord>;
  templateInstantiations: BirdCoderTableRecordRepository<BirdCoderAppTemplateInstantiationEvidenceRecord>;
}

export interface CreateBirdCoderPromptSkillTemplateEvidenceRepositoriesOptions {
  providerId: BirdCoderDatabaseProviderId;
  storage: BirdCoderStorageAccess;
}

function normalizePromptRunRecord(value: unknown): BirdCoderPromptRunEvidenceRecord | null {
  if (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.projectId === 'string' &&
    typeof value.codingSessionId === 'string' &&
    typeof value.promptBundleId === 'string' &&
    typeof value.promptAssetVersionId === 'string'
  ) {
    return {
      id: value.id,
      projectId: value.projectId,
      codingSessionId: value.codingSessionId,
      promptBundleId: value.promptBundleId,
      promptAssetVersionId: value.promptAssetVersionId,
      status: typeof value.status === 'string' ? value.status : 'completed',
      inputSnapshotRef:
        typeof value.inputSnapshotRef === 'string' ? value.inputSnapshotRef : '',
      outputSnapshotRef:
        typeof value.outputSnapshotRef === 'string' ? value.outputSnapshotRef : '',
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      updatedAt:
        typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
    };
  }

  const row = coerceBirdCoderSqlEntityRow(getBirdCoderEntityDefinition('prompt_run'), value);
  if (
    !row ||
    typeof row.project_id !== 'string' ||
    typeof row.coding_session_id !== 'string' ||
    typeof row.prompt_bundle_id !== 'string' ||
    typeof row.prompt_asset_version_id !== 'string'
  ) {
    return null;
  }

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    codingSessionId: String(row.coding_session_id),
    promptBundleId: String(row.prompt_bundle_id),
    promptAssetVersionId: String(row.prompt_asset_version_id),
    status: String(row.status ?? 'completed'),
    inputSnapshotRef: String(row.input_snapshot_ref ?? ''),
    outputSnapshotRef: String(row.output_snapshot_ref ?? ''),
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
  };
}

function promptRunToRow(value: BirdCoderPromptRunEvidenceRecord): Record<string, unknown> {
  return {
    id: value.id,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: 0,
    is_deleted: false,
    project_id: value.projectId,
    coding_session_id: value.codingSessionId,
    prompt_bundle_id: value.promptBundleId,
    prompt_asset_version_id: value.promptAssetVersionId,
    status: value.status,
    input_snapshot_ref: value.inputSnapshotRef,
    output_snapshot_ref: value.outputSnapshotRef,
  };
}

function normalizePromptEvaluationRecord(
  value: unknown,
): BirdCoderPromptEvaluationEvidenceRecord | null {
  if (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.promptRunId === 'string' &&
    typeof value.evaluator === 'string' &&
    typeof value.score === 'number'
  ) {
    return {
      id: value.id,
      promptRunId: value.promptRunId,
      evaluator: value.evaluator,
      score: value.score,
      summary: isRecord(value.summary) ? value.summary : {},
      status: typeof value.status === 'string' ? value.status : 'completed',
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      updatedAt:
        typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
    };
  }

  const row = coerceBirdCoderSqlEntityRow(
    getBirdCoderEntityDefinition('prompt_evaluation'),
    value,
  );
  if (
    !row ||
    typeof row.prompt_run_id !== 'string' ||
    typeof row.evaluator !== 'string' ||
    typeof row.score !== 'number'
  ) {
    return null;
  }

  return {
    id: String(row.id),
    promptRunId: String(row.prompt_run_id),
    evaluator: String(row.evaluator),
    score: Number(row.score),
    summary: isRecord(row.summary_json) ? row.summary_json : {},
    status: String(row.status ?? 'completed'),
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
  };
}

function promptEvaluationToRow(
  value: BirdCoderPromptEvaluationEvidenceRecord,
): Record<string, unknown> {
  return {
    id: value.id,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: 0,
    is_deleted: false,
    prompt_run_id: value.promptRunId,
    evaluator: value.evaluator,
    score: value.score,
    summary_json: value.summary,
    status: value.status,
  };
}

function normalizeTemplateInstantiationRecord(
  value: unknown,
): BirdCoderAppTemplateInstantiationEvidenceRecord | null {
  if (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.projectId === 'string' &&
    typeof value.appTemplateVersionId === 'string' &&
    typeof value.presetKey === 'string' &&
    typeof value.outputRoot === 'string'
  ) {
    return {
      id: value.id,
      projectId: value.projectId,
      appTemplateVersionId: value.appTemplateVersionId,
      presetKey: value.presetKey,
      status: typeof value.status === 'string' ? value.status : 'completed',
      outputRoot: value.outputRoot,
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      updatedAt:
        typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
    };
  }

  const row = coerceBirdCoderSqlEntityRow(
    getBirdCoderEntityDefinition('app_template_instantiation'),
    value,
  );
  if (
    !row ||
    typeof row.project_id !== 'string' ||
    typeof row.app_template_version_id !== 'string' ||
    typeof row.preset_key !== 'string' ||
    typeof row.output_root !== 'string'
  ) {
    return null;
  }

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    appTemplateVersionId: String(row.app_template_version_id),
    presetKey: String(row.preset_key),
    status: String(row.status ?? 'completed'),
    outputRoot: String(row.output_root),
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
  };
}

function templateInstantiationToRow(
  value: BirdCoderAppTemplateInstantiationEvidenceRecord,
): Record<string, unknown> {
  return {
    id: value.id,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: 0,
    is_deleted: false,
    project_id: value.projectId,
    app_template_version_id: value.appTemplateVersionId,
    preset_key: value.presetKey,
    status: value.status,
    output_root: value.outputRoot,
  };
}

export function createBirdCoderPromptSkillTemplateEvidenceRepositories({
  providerId,
  storage,
}: CreateBirdCoderPromptSkillTemplateEvidenceRepositoriesOptions): BirdCoderPromptSkillTemplateEvidenceRepositories {
  return {
    promptRuns: createBirdCoderTableRecordRepository({
      binding: BIRDCODER_PROMPT_RUN_STORAGE_BINDING,
      definition: getBirdCoderEntityDefinition('prompt_run'),
      providerId,
      storage,
      identify(value) {
        return value.id;
      },
      normalize: normalizePromptRunRecord,
      sort: sortByUpdatedAtDescending,
      toRow: promptRunToRow,
    }),
    promptEvaluations: createBirdCoderTableRecordRepository({
      binding: BIRDCODER_PROMPT_EVALUATION_STORAGE_BINDING,
      definition: getBirdCoderEntityDefinition('prompt_evaluation'),
      providerId,
      storage,
      identify(value) {
        return value.id;
      },
      normalize: normalizePromptEvaluationRecord,
      sort: sortByUpdatedAtDescending,
      toRow: promptEvaluationToRow,
    }),
    templateInstantiations: createBirdCoderTableRecordRepository({
      binding: BIRDCODER_APP_TEMPLATE_INSTANTIATION_STORAGE_BINDING,
      definition: getBirdCoderEntityDefinition('app_template_instantiation'),
      providerId,
      storage,
      identify(value) {
        return value.id;
      },
      normalize: normalizeTemplateInstantiationRecord,
      sort: sortByUpdatedAtDescending,
      toRow: templateInstantiationToRow,
    }),
  };
}
