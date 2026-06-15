import type { BirdCoderCodingSession } from '@sdkwork/birdcoder-pc-types';

export interface IProjectSessionMirror {
  upsertCodingSession(projectId: string, codingSession: BirdCoderCodingSession): Promise<void>;
}
