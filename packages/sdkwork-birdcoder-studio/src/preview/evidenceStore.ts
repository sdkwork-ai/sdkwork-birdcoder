import { getStoredJson, setStoredJson } from '../../../sdkwork-birdcoder-commons/src/storage/localStore.ts';
import { getTerminalProfile } from '../../../sdkwork-birdcoder-commons/src/terminal/profiles.ts';

import {
  STUDIO_PREVIEW_EXECUTION_ADAPTER_ID,
  type StudioPreviewExecutionEvidence,
} from './runtime.ts';

const STUDIO_PREVIEW_EVIDENCE_SCOPE = 'studio-preview';
const MAX_STORED_STUDIO_PREVIEW_EVIDENCE = 10;

type StudioPreviewExecutionEvidencePersistedEntry = Partial<StudioPreviewExecutionEvidence>;

function normalizeOptionalId(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeStudioPreviewExecutionEvidence(
  value: StudioPreviewExecutionEvidencePersistedEntry | null | undefined,
): StudioPreviewExecutionEvidence | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const evidenceKey = value.evidenceKey?.trim();
  const sessionEvidenceKey = value.sessionEvidenceKey?.trim();
  const channel = value.channel?.trim();
  const previewUrl = value.previewUrl?.trim();
  const command = value.command?.trim();
  const cwd = value.cwd?.trim();

  if (
    !evidenceKey ||
    !sessionEvidenceKey ||
    !channel ||
    !previewUrl ||
    !command ||
    !cwd ||
    !value.host ||
    typeof value.host !== 'object'
  ) {
    return null;
  }

  return {
    adapterId: STUDIO_PREVIEW_EXECUTION_ADAPTER_ID,
    evidenceKey,
    sessionEvidenceKey,
    host: value.host as StudioPreviewExecutionEvidence['host'],
    channel,
    orientation: value.orientation === 'landscape' ? 'landscape' : 'portrait',
    previewUrl,
    command,
    cwd,
    profileId: getTerminalProfile(value.profileId ?? 'powershell').id,
    projectId: normalizeOptionalId(value.projectId),
    runConfigurationId: normalizeOptionalId(value.runConfigurationId),
    launchedAt: typeof value.launchedAt === 'number' ? value.launchedAt : 0,
  };
}

export function buildStudioPreviewEvidenceStorageKey(
  projectId: string | null | undefined,
): string {
  const normalizedProjectId = normalizeOptionalId(projectId);
  return normalizedProjectId
    ? `preview-evidence.${normalizedProjectId}.v1`
    : 'preview-evidence.global.v1';
}

export async function listStoredStudioPreviewExecutionEvidence(
  projectId: string | null | undefined,
): Promise<StudioPreviewExecutionEvidence[]> {
  const storedEntries = await getStoredJson<StudioPreviewExecutionEvidencePersistedEntry[]>(
    STUDIO_PREVIEW_EVIDENCE_SCOPE,
    buildStudioPreviewEvidenceStorageKey(projectId),
    [],
  );

  return storedEntries
    .map((entry) => normalizeStudioPreviewExecutionEvidence(entry))
    .filter((entry): entry is StudioPreviewExecutionEvidence => entry !== null)
    .sort((left, right) => right.launchedAt - left.launchedAt);
}

export async function saveStoredStudioPreviewExecutionEvidence(
  evidence: StudioPreviewExecutionEvidence,
): Promise<StudioPreviewExecutionEvidence[]> {
  const normalizedEvidence = normalizeStudioPreviewExecutionEvidence(evidence);

  if (!normalizedEvidence) {
    return [];
  }

  const existing = await listStoredStudioPreviewExecutionEvidence(normalizedEvidence.projectId);
  const nextEvidence = [
    normalizedEvidence,
    ...existing.filter((entry) => entry.evidenceKey !== normalizedEvidence.evidenceKey),
  ]
    .sort((left, right) => right.launchedAt - left.launchedAt)
    .slice(0, MAX_STORED_STUDIO_PREVIEW_EVIDENCE);

  await setStoredJson(
    STUDIO_PREVIEW_EVIDENCE_SCOPE,
    buildStudioPreviewEvidenceStorageKey(normalizedEvidence.projectId),
    nextEvidence,
  );

  return nextEvidence;
}
