import { getStoredJson, getTerminalProfile, setStoredJson } from '@sdkwork/birdcoder-commons';

import {
  STUDIO_TEST_EXECUTION_ADAPTER_ID,
  type StudioTestExecutionEvidence,
} from './runtime.ts';

const STUDIO_TEST_EVIDENCE_SCOPE = 'studio-test';
const MAX_STORED_STUDIO_TEST_EVIDENCE = 10;

type StudioTestExecutionEvidencePersistedEntry = Partial<StudioTestExecutionEvidence>;

function normalizeOptionalId(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeStudioTestExecutionEvidence(
  value: StudioTestExecutionEvidencePersistedEntry | null | undefined,
): StudioTestExecutionEvidence | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const evidenceKey = value.evidenceKey?.trim();
  const command = value.command?.trim();
  const cwd = value.cwd?.trim();

  if (!evidenceKey || !command || !cwd) {
    return null;
  }

  return {
    adapterId: STUDIO_TEST_EXECUTION_ADAPTER_ID,
    evidenceKey,
    command,
    cwd,
    profileId: getTerminalProfile(value.profileId ?? 'powershell').id,
    projectId: normalizeOptionalId(value.projectId),
    runConfigurationId: normalizeOptionalId(value.runConfigurationId),
    launchedAt: typeof value.launchedAt === 'number' ? value.launchedAt : 0,
  };
}

export function buildStudioTestEvidenceStorageKey(
  projectId: string | null | undefined,
): string {
  const normalizedProjectId = normalizeOptionalId(projectId);
  return normalizedProjectId
    ? `test-evidence.${normalizedProjectId}.v1`
    : 'test-evidence.global.v1';
}

export async function listStoredStudioTestExecutionEvidence(
  projectId: string | null | undefined,
): Promise<StudioTestExecutionEvidence[]> {
  const storedEntries = await getStoredJson<StudioTestExecutionEvidencePersistedEntry[]>(
    STUDIO_TEST_EVIDENCE_SCOPE,
    buildStudioTestEvidenceStorageKey(projectId),
    [],
  );

  return storedEntries
    .map((entry) => normalizeStudioTestExecutionEvidence(entry))
    .filter((entry): entry is StudioTestExecutionEvidence => entry !== null)
    .sort((left, right) => right.launchedAt - left.launchedAt);
}

export async function saveStoredStudioTestExecutionEvidence(
  evidence: StudioTestExecutionEvidence,
): Promise<StudioTestExecutionEvidence[]> {
  const normalizedEvidence = normalizeStudioTestExecutionEvidence(evidence);

  if (!normalizedEvidence) {
    return [];
  }

  const existing = await listStoredStudioTestExecutionEvidence(normalizedEvidence.projectId);
  const nextEvidence = [
    normalizedEvidence,
    ...existing.filter((entry) => entry.evidenceKey !== normalizedEvidence.evidenceKey),
  ]
    .sort((left, right) => right.launchedAt - left.launchedAt)
    .slice(0, MAX_STORED_STUDIO_TEST_EVIDENCE);

  await setStoredJson(
    STUDIO_TEST_EVIDENCE_SCOPE,
    buildStudioTestEvidenceStorageKey(normalizedEvidence.projectId),
    nextEvidence,
  );

  return nextEvidence;
}
