import { getStoredJson, getTerminalProfile, setStoredJson } from '@sdkwork/birdcoder-commons';

import {
  STUDIO_SIMULATOR_EXECUTION_ADAPTER_ID,
  type StudioSimulatorExecutionEvidence,
} from './runtime.ts';

const STUDIO_SIMULATOR_EVIDENCE_SCOPE = 'studio-simulator';
const MAX_STORED_STUDIO_SIMULATOR_EVIDENCE = 10;

type StudioSimulatorExecutionEvidencePersistedEntry = Partial<StudioSimulatorExecutionEvidence>;

function normalizeOptionalId(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeStudioSimulatorExecutionEvidence(
  value: StudioSimulatorExecutionEvidencePersistedEntry | null | undefined,
): StudioSimulatorExecutionEvidence | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const evidenceKey = value.evidenceKey?.trim();
  const sessionEvidenceKey = value.sessionEvidenceKey?.trim();
  const channel = value.channel?.trim();
  const runtime = value.runtime?.trim();
  const command = value.command?.trim();
  const cwd = value.cwd?.trim();

  if (
    !evidenceKey ||
    !sessionEvidenceKey ||
    !channel ||
    !runtime ||
    !command ||
    !cwd ||
    !value.host ||
    typeof value.host !== 'object'
  ) {
    return null;
  }

  return {
    adapterId: STUDIO_SIMULATOR_EXECUTION_ADAPTER_ID,
    evidenceKey,
    sessionEvidenceKey,
    host: value.host as StudioSimulatorExecutionEvidence['host'],
    channel,
    runtime: runtime as StudioSimulatorExecutionEvidence['runtime'],
    orientation: value.orientation === 'landscape' ? 'landscape' : 'portrait',
    command,
    cwd,
    profileId: getTerminalProfile(value.profileId ?? 'powershell').id,
    projectId: normalizeOptionalId(value.projectId),
    runConfigurationId: normalizeOptionalId(value.runConfigurationId),
    launchedAt: typeof value.launchedAt === 'number' ? value.launchedAt : 0,
  };
}

export function buildStudioSimulatorEvidenceStorageKey(
  projectId: string | null | undefined,
): string {
  const normalizedProjectId = normalizeOptionalId(projectId);
  return normalizedProjectId
    ? `simulator-evidence.${normalizedProjectId}.v1`
    : 'simulator-evidence.global.v1';
}

export async function listStoredStudioSimulatorExecutionEvidence(
  projectId: string | null | undefined,
): Promise<StudioSimulatorExecutionEvidence[]> {
  const storedEntries = await getStoredJson<StudioSimulatorExecutionEvidencePersistedEntry[]>(
    STUDIO_SIMULATOR_EVIDENCE_SCOPE,
    buildStudioSimulatorEvidenceStorageKey(projectId),
    [],
  );

  return storedEntries
    .map((entry) => normalizeStudioSimulatorExecutionEvidence(entry))
    .filter((entry): entry is StudioSimulatorExecutionEvidence => entry !== null)
    .sort((left, right) => right.launchedAt - left.launchedAt);
}

export async function saveStoredStudioSimulatorExecutionEvidence(
  evidence: StudioSimulatorExecutionEvidence,
): Promise<StudioSimulatorExecutionEvidence[]> {
  const normalizedEvidence = normalizeStudioSimulatorExecutionEvidence(evidence);

  if (!normalizedEvidence) {
    return [];
  }

  const existing = await listStoredStudioSimulatorExecutionEvidence(normalizedEvidence.projectId);
  const nextEvidence = [
    normalizedEvidence,
    ...existing.filter((entry) => entry.evidenceKey !== normalizedEvidence.evidenceKey),
  ]
    .sort((left, right) => right.launchedAt - left.launchedAt)
    .slice(0, MAX_STORED_STUDIO_SIMULATOR_EVIDENCE);

  await setStoredJson(
    STUDIO_SIMULATOR_EVIDENCE_SCOPE,
    buildStudioSimulatorEvidenceStorageKey(normalizedEvidence.projectId),
    nextEvidence,
  );

  return nextEvidence;
}
