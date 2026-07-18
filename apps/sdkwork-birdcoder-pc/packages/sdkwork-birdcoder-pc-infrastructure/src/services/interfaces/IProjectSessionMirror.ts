import type { BirdCoderCodingSession } from '@sdkwork/birdcoder-pc-contracts-commons';

export interface IProjectSessionMirror {
  upsertCodingSession(projectId: string, codingSession: BirdCoderCodingSession): Promise<void>;
}
