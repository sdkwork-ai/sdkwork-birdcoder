import { getStoredJson, setStoredJson } from '../../../sdkwork-birdcoder-commons/src/storage/localStore.ts';
import { getTerminalProfile } from '../../../sdkwork-birdcoder-commons/src/terminal/profiles.ts';

import {
  STUDIO_BUILD_EXECUTION_ADAPTER_ID,
  type StudioBuildExecutionEvidence,
} from './runtime.ts';

const STUDIO_BUILD_EVIDENCE_SCOPE = 'studio-build';
const MAX_STORED_STUDIO_BUILD_EVIDENCE = 10;

type StudioBuildExecutionEvidencePersistedEntry = Partial<StudioBuildExecutionEvidence>;

function normalizeOptionalId(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeStudioBuildExecutionEvidence(
  value: StudioBuildExecutionEvidencePersistedEntry | null | undefined,
): StudioBuildExecutionEvidence | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const evidenceKey = value.evidenceKey?.trim();
  const buildProfileId = value.buildProfileId?.trim();
  const targetId = value.targetId?.trim();
  const outputKind = value.outputKind?.trim();
  const command = value.command?.trim();
  const cwd = value.cwd?.trim();

  if (!evidenceKey || !buildProfileId || !targetId || !outputKind || !command || !cwd) {
    return null;
  }

  return {
    adapterId: STUDIO_BUILD_EXECUTION_ADAPTER_ID,
    evidenceKey,
    buildProfileId,
    targetId,
    outputKind: outputKind as StudioBuildExecutionEvidence['outputKind'],
    command,
    cwd,
    profileId: getTerminalProfile(value.profileId ?? 'powershell').id,
    projectId: normalizeOptionalId(value.projectId),
    runConfigurationId: normalizeOptionalId(value.runConfigurationId),
    launchedAt: typeof value.launchedAt === 'number' ? value.launchedAt : 0,
  };
}

export function buildStudioBuildEvidenceStorageKey(
  projectId: string | null | undefined,
): string {
  const normalizedProjectId = normalizeOptionalId(projectId);
  return normalizedProjectId
    ? `build-evidence.${normalizedProjectId}.v1`
    : 'build-evidence.global.v1';
}

export async function listStoredStudioBuildExecutionEvidence(
  projectId: string | null | undefined,
): Promise<StudioBuildExecutionEvidence[]> {
  const storedEntries = await getStoredJson<StudioBuildExecutionEvidencePersistedEntry[]>(
    STUDIO_BUILD_EVIDENCE_SCOPE,
    buildStudioBuildEvidenceStorageKey(projectId),
    [],
  );

  return storedEntries
    .map((entry) => normalizeStudioBuildExecutionEvidence(entry))
    .filter((entry): entry is StudioBuildExecutionEvidence => entry !== null)
    .sort((left, right) => right.launchedAt - left.launchedAt);
}

export async function saveStoredStudioBuildExecutionEvidence(
  evidence: StudioBuildExecutionEvidence,
): Promise<StudioBuildExecutionEvidence[]> {
  const normalizedEvidence = normalizeStudioBuildExecutionEvidence(evidence);

  if (!normalizedEvidence) {
    return [];
  }

  const existing = await listStoredStudioBuildExecutionEvidence(normalizedEvidence.projectId);
  const nextEvidence = [
    normalizedEvidence,
    ...existing.filter((entry) => entry.evidenceKey !== normalizedEvidence.evidenceKey),
  ]
    .sort((left, right) => right.launchedAt - left.launchedAt)
    .slice(0, MAX_STORED_STUDIO_BUILD_EVIDENCE);

  await setStoredJson(
    STUDIO_BUILD_EVIDENCE_SCOPE,
    buildStudioBuildEvidenceStorageKey(normalizedEvidence.projectId),
    nextEvidence,
  );

  return nextEvidence;
}
