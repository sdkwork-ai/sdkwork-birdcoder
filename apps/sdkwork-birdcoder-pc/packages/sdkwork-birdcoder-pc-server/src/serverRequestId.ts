import { randomUUID } from 'node:crypto';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function createBirdCoderServerRequestId(): string {
  const requestId = randomUUID().toLowerCase();
  if (!UUID_V4_PATTERN.test(requestId)) {
    throw new Error('Server requestId generation failed to produce a UUID v4 value.');
  }
  return requestId;
}
