import assert from 'node:assert/strict';
import type {
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionCheckpoint,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { BirdCoderApiTransportError } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/apiTransportError.ts';
import {
  loadCodingSessionProjection,
  loadCodingSessionProjectionIfAvailable,
  shouldReportCodingSessionProjectionError,
  type BirdCoderCodingSessionProjectionReader,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/codingSessionProjectionService.ts';

const codingSessionId = 'coding-session-projection-lifecycle';
const session: BirdCoderCodingSessionSummary = {
  id: codingSessionId,
  workspaceId: 'workspace-projection-lifecycle',
  projectId: 'project-projection-lifecycle',
  title: 'Projection lifecycle',
  status: 'active',
  hostMode: 'server',
  engineId: 'codex',
  modelId: 'gpt-5.4',
  createdAt: '2026-07-15T00:00:00.000Z',
  updatedAt: '2026-07-15T00:00:00.000Z',
};

function createReader(
  getCodingSession: BirdCoderCodingSessionProjectionReader['getCodingSession'],
  calls: string[],
): BirdCoderCodingSessionProjectionReader {
  return {
    getCodingSession,
    async listCodingSessionEvents(): Promise<BirdCoderCodingSessionEvent[]> {
      calls.push('events');
      return [];
    },
    async listCodingSessionArtifacts(): Promise<BirdCoderCodingSessionArtifact[]> {
      calls.push('artifacts');
      return [];
    },
    async listCodingSessionCheckpoints(): Promise<BirdCoderCodingSessionCheckpoint[]> {
      calls.push('checkpoints');
      return [];
    },
  };
}

const successCalls: string[] = [];
const projection = await loadCodingSessionProjection(
  createReader(async () => {
    successCalls.push('session');
    return session;
  }, successCalls),
  codingSessionId,
);
assert.equal(projection.session, session);
assert.deepEqual(
  successCalls,
  ['session', 'events', 'artifacts', 'checkpoints'],
  'the parent session must resolve before child projection collections are requested.',
);

const notFoundCalls: string[] = [];
const notFoundError = new BirdCoderApiTransportError({
  detail: `session ${codingSessionId} not found`,
  httpStatus: 404,
  method: 'GET',
  path: `/app/v3/api/intelligence/coding_sessions/${codingSessionId}`,
});
const unavailableProjection = await loadCodingSessionProjectionIfAvailable(
  createReader(async () => {
    notFoundCalls.push('session');
    throw notFoundError;
  }, notFoundCalls),
  codingSessionId,
);
assert.equal(unavailableProjection, null);
assert.deepEqual(
  notFoundCalls,
  ['session'],
  'a missing parent session must prevent every child projection request.',
);
assert.equal(
  shouldReportCodingSessionProjectionError(notFoundError),
  false,
  'a local-only or removed session is an expected unavailable projection, not a console error.',
);

const nullSessionCalls: string[] = [];
const nullProjection = await loadCodingSessionProjectionIfAvailable(
  createReader(async () => {
    nullSessionCalls.push('session');
    return null;
  }, nullSessionCalls),
  codingSessionId,
);
assert.equal(nullProjection, null);
assert.deepEqual(nullSessionCalls, ['session']);

const unauthorizedError = new BirdCoderApiTransportError({
  httpStatus: 401,
  method: 'GET',
  path: `/app/v3/api/intelligence/coding_sessions/${codingSessionId}`,
});
await assert.rejects(
  loadCodingSessionProjectionIfAvailable(
    createReader(async () => {
      throw unauthorizedError;
    }, []),
    codingSessionId,
  ),
  (error: unknown) => error === unauthorizedError,
  'authentication failures must remain rejected after the SDK unauthorized boundary handles them.',
);
assert.equal(
  shouldReportCodingSessionProjectionError(unauthorizedError),
  false,
  'handled authentication failures must not produce a second projection console error.',
);

console.log('coding session projection lifecycle contract passed.');
