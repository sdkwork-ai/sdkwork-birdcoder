import { createBirdCoderLocalUuidV4 } from './localUuid.ts';

export function createBirdCoderLocalServerRequestId(): string {
  return createBirdCoderLocalUuidV4();
}
