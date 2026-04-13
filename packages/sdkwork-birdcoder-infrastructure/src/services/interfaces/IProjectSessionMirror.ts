import type { BirdCoderCodingSession } from '@sdkwork/birdcoder-types';

export interface IProjectSessionMirror {
  upsertCodingSession(projectId: string, codingSession: BirdCoderCodingSession): Promise<void>;
}
