import type {
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionCheckpoint,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { readBirdCoderApiTransportErrorHttpStatus } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAppRuntimeReadService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

export interface BirdCoderCodingSessionProjection {
  artifacts: BirdCoderCodingSessionArtifact[];
  checkpoints: BirdCoderCodingSessionCheckpoint[];
  events: BirdCoderCodingSessionEvent[];
  session: BirdCoderCodingSessionSummary;
}

export type BirdCoderCodingSessionProjectionReader = Pick<
  IAppRuntimeReadService,
  | 'getCodingSession'
  | 'listCodingSessionArtifacts'
  | 'listCodingSessionCheckpoints'
  | 'listCodingSessionEvents'
>;

export class BirdCoderCodingSessionProjectionUnavailableError extends Error {
  readonly codingSessionId: string;

  constructor(codingSessionId: string) {
    super(`Coding session ${codingSessionId} has no authoritative projection.`);
    this.name = 'BirdCoderCodingSessionProjectionUnavailableError';
    this.codingSessionId = codingSessionId;
  }
}

export function isBirdCoderCodingSessionProjectionUnavailableError(error: unknown): boolean {
  return (
    error instanceof BirdCoderCodingSessionProjectionUnavailableError ||
    readBirdCoderApiTransportErrorHttpStatus(error) === 404
  );
}

export function shouldReportCodingSessionProjectionError(error: unknown): boolean {
  const httpStatus = readBirdCoderApiTransportErrorHttpStatus(error);
  return httpStatus !== 401 && !isBirdCoderCodingSessionProjectionUnavailableError(error);
}

export async function loadCodingSessionProjection(
  appRuntimeReadService: BirdCoderCodingSessionProjectionReader,
  codingSessionId: string,
): Promise<BirdCoderCodingSessionProjection> {
  // Validate the parent resource before issuing requests for its child collections.
  const session = await appRuntimeReadService.getCodingSession(codingSessionId);
  if (!session) {
    throw new BirdCoderCodingSessionProjectionUnavailableError(codingSessionId);
  }

  const [events, artifacts, checkpoints] = await Promise.all([
    appRuntimeReadService.listCodingSessionEvents(codingSessionId),
    appRuntimeReadService.listCodingSessionArtifacts(codingSessionId),
    appRuntimeReadService.listCodingSessionCheckpoints(codingSessionId),
  ]);

  return {
    artifacts,
    checkpoints,
    events,
    session,
  };
}

export async function loadCodingSessionProjectionIfAvailable(
  appRuntimeReadService: BirdCoderCodingSessionProjectionReader,
  codingSessionId: string,
): Promise<BirdCoderCodingSessionProjection | null> {
  try {
    return await loadCodingSessionProjection(appRuntimeReadService, codingSessionId);
  } catch (error) {
    if (isBirdCoderCodingSessionProjectionUnavailableError(error)) {
      return null;
    }
    throw error;
  }
}
