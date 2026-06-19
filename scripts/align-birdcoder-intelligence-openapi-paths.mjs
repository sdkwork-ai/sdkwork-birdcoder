#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

const targets = [
  'deployments/server-windows/x64/openapi/coding-server-v1.json',
  'sdks/specs/openapi/birdcoder-app-v3.openapi.json',
  'apps/sdkwork-birdcoder-pc/sdks/specs/openapi/birdcoder-app-v3.openapi.json',
  'apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json',
  'sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json',
];

const INTELLIGENCE_PREFIX = '/app/v3/api/intelligence/coding_sessions';

const SESSION_PATH_REWRITES = [
  ['/app/v3/api/coding_sessions/{id}/messages/{messageId}', null],
  ['/app/v3/api/intelligence/coding-sessions/{session_id}/turns', `${INTELLIGENCE_PREFIX}/{sessionId}/turns`],
  ['/app/v3/api/intelligence/coding-sessions/{session_id}/checkpoints', `${INTELLIGENCE_PREFIX}/{sessionId}/checkpoints`],
  ['/app/v3/api/intelligence/coding-sessions/{session_id}/artifacts', `${INTELLIGENCE_PREFIX}/{sessionId}/artifacts`],
  ['/app/v3/api/intelligence/coding-sessions/{session_id}/events', `${INTELLIGENCE_PREFIX}/{sessionId}/events`],
  ['/app/v3/api/intelligence/coding-sessions/{session_id}/fork', `${INTELLIGENCE_PREFIX}/{sessionId}/fork`],
  ['/app/v3/api/intelligence/coding-sessions/{session_id}', `${INTELLIGENCE_PREFIX}/{sessionId}`],
  ['/app/v3/api/intelligence/coding-sessions', INTELLIGENCE_PREFIX],
  ['/app/v3/api/coding_sessions/{id}/turns', `${INTELLIGENCE_PREFIX}/{sessionId}/turns`],
  ['/app/v3/api/coding_sessions/{id}/checkpoints', `${INTELLIGENCE_PREFIX}/{sessionId}/checkpoints`],
  ['/app/v3/api/coding_sessions/{id}/artifacts', `${INTELLIGENCE_PREFIX}/{sessionId}/artifacts`],
  ['/app/v3/api/coding_sessions/{id}/events', `${INTELLIGENCE_PREFIX}/{sessionId}/events`],
  ['/app/v3/api/coding_sessions/{id}/fork', `${INTELLIGENCE_PREFIX}/{sessionId}/fork`],
  ['/app/v3/api/coding_sessions/{id}', `${INTELLIGENCE_PREFIX}/{sessionId}`],
  ['/app/v3/api/coding_sessions', INTELLIGENCE_PREFIX],
];

function clone(value) {
  return structuredClone(value);
}

function renamePathParameter(operation, from, to, description) {
  if (!operation?.parameters) {
    return;
  }
  for (const parameter of operation.parameters) {
    if (parameter?.in !== 'path' || parameter.name !== from) {
      continue;
    }
    parameter.name = to;
    if (description) {
      parameter.description = description;
    }
  }
}

function rewriteSessionPathItem(pathItem) {
  const next = clone(pathItem);
  for (const operation of Object.values(next)) {
    if (!operation || typeof operation !== 'object') {
      continue;
    }
    renamePathParameter(operation, 'id', 'sessionId', 'BirdCoder coding session identifier.');
    renamePathParameter(
      operation,
      'session_id',
      'sessionId',
      'BirdCoder coding session identifier.',
    );
  }
  return next;
}

function buildApprovalPathItem(sourcePathItem) {
  const next = clone(sourcePathItem);
  const operation = next.post;
  if (!operation) {
    return next;
  }
  operation.parameters = [
    {
      name: 'sessionId',
      in: 'path',
      required: true,
      description: 'BirdCoder coding session identifier.',
      schema: { type: 'string' },
    },
    {
      name: 'checkpointId',
      in: 'path',
      required: true,
      description: 'Approval checkpoint identifier.',
      schema: { type: 'string' },
    },
  ];
  operation.operationId = 'codingSessions.checkpoints.approval.create';
  return next;
}

function buildQuestionPathItem(sourcePathItem) {
  const next = clone(sourcePathItem);
  const operation = next.post;
  if (!operation) {
    return next;
  }
  operation.parameters = [
    {
      name: 'sessionId',
      in: 'path',
      required: true,
      description: 'BirdCoder coding session identifier.',
      schema: { type: 'string' },
    },
    {
      name: 'questionId',
      in: 'path',
      required: true,
      description: 'User-question request identifier.',
      schema: { type: 'string' },
    },
  ];
  operation.operationId = 'codingSessions.questions.answers.create';
  return next;
}

function alignPaths(paths) {
  const next = { ...paths };
  let changed = 0;

  for (const [from, to] of SESSION_PATH_REWRITES) {
    if (!(from in next)) {
      continue;
    }
    if (to === null) {
      delete next[from];
      changed += 1;
      continue;
    }
    next[to] = rewriteSessionPathItem(next[from]);
    delete next[from];
    changed += 1;
  }

  const approvalSources = [
    '/app/v3/api/approvals/{approvalId}/decision',
    '/app/v3/api/intelligence/coding-sessions/{session_id}/checkpoints/{checkpoint_id}/approval',
    '/app/v3/api/intelligence/coding_sessions/{session_id}/checkpoints/{checkpoint_id}/approval',
  ];
  for (const approvalPath of approvalSources) {
    if (!next[approvalPath]) {
      continue;
    }
    next[`${INTELLIGENCE_PREFIX}/{sessionId}/checkpoints/{checkpointId}/approval`] =
      buildApprovalPathItem(next[approvalPath]);
    delete next[approvalPath];
    changed += 1;
    break;
  }

  const questionSources = [
    '/app/v3/api/questions/{questionId}/answer',
    '/app/v3/api/intelligence/coding-sessions/{session_id}/questions/{question_id}/answer',
    '/app/v3/api/intelligence/coding_sessions/{session_id}/questions/{question_id}/answer',
  ];
  for (const questionPath of questionSources) {
    if (!next[questionPath]) {
      continue;
    }
    next[`${INTELLIGENCE_PREFIX}/{sessionId}/questions/{questionId}/answer`] =
      buildQuestionPathItem(next[questionPath]);
    delete next[questionPath];
    changed += 1;
    break;
  }

  return { paths: next, changed };
}

function normalizeIntelligenceOperationIds(paths) {
  let changed = 0;
  const approvalPath = `${INTELLIGENCE_PREFIX}/{sessionId}/checkpoints/{checkpointId}/approval`;
  const questionPath = `${INTELLIGENCE_PREFIX}/{sessionId}/questions/{questionId}/answer`;

  const approvalOperation = paths[approvalPath]?.post;
  if (approvalOperation?.operationId === 'submitApprovalDecision') {
    approvalOperation.operationId = 'codingSessions.checkpoints.approval.create';
    changed += 1;
  }

  const questionOperation = paths[questionPath]?.post;
  if (questionOperation?.operationId === 'submitUserQuestionAnswer') {
    questionOperation.operationId = 'codingSessions.questions.answers.create';
    changed += 1;
  }

  return changed;
}

let totalChanged = 0;
for (const relativePath of targets) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    continue;
  }
  const document = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  const { paths, changed } = alignPaths(document.paths ?? {});
  const operationIdChanged = normalizeIntelligenceOperationIds(paths);
  const combinedChanged = changed + operationIdChanged;
  if (combinedChanged === 0) {
    process.stdout.write(`${relativePath}: intelligence paths already aligned\n`);
    continue;
  }
  document.paths = paths;
  fs.writeFileSync(absolutePath, `${JSON.stringify(document, null, 2)}\n`);
  totalChanged += combinedChanged;
  process.stdout.write(
    `${relativePath}: aligned ${changed} intelligence path group(s), normalized ${operationIdChanged} operationId(s)\n`,
  );
}

process.stdout.write(`BirdCoder intelligence OpenAPI paths aligned (${totalChanged} updates)\n`);
