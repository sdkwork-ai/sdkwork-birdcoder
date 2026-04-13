import assert from 'node:assert/strict';

import {
  buildTerminalLayoutStorageKey,
  buildTerminalSessionRecord,
  matchesTerminalSessionScope,
  normalizeTerminalSessionRecord,
} from '../packages/sdkwork-birdcoder-commons/src/terminal/sessions.ts';

const normalized = normalizeTerminalSessionRecord({
  id: 'tab-1',
  title: 'Gemini',
  profileId: 'gemini',
  cwd: '',
  commandHistory: ['npm test', '', 'pnpm lint'],
  recentOutput: ['ok', '', 'done'],
  updatedAt: 0,
});

assert.deepEqual(normalized, {
  id: 'tab-1',
  title: 'Gemini',
  profileId: 'gemini',
  cwd: '',
  commandHistory: ['npm test', 'pnpm lint'],
  recentOutput: ['ok', 'done'],
  updatedAt: 0,
  workspaceId: '',
  projectId: '',
  status: 'idle',
  lastExitCode: null,
});

const snapshot = buildTerminalSessionRecord(
  {
    id: 'tab-2',
    title: 'Claude Code',
    profileId: 'claude-code',
    cwd: 'D:\\repo',
    history: ['line-1', { jsx: true }, 'line-2', 'line-3'],
    commandHistory: ['claude chat', 'claude commit'],
    status: 'error',
    lastExitCode: 2,
  },
  1234,
  {
    workspaceId: 'ws-1',
    projectId: 'project-1',
  },
);

assert.deepEqual(snapshot, {
  id: 'tab-2',
  title: 'Claude Code',
  profileId: 'claude-code',
  cwd: 'D:\\repo',
  commandHistory: ['claude chat', 'claude commit'],
  recentOutput: ['line-1', 'line-2', 'line-3'],
  updatedAt: 1234,
  workspaceId: 'ws-1',
  projectId: 'project-1',
  status: 'error',
  lastExitCode: 2,
});

assert.equal(buildTerminalLayoutStorageKey(null), 'layout.global.v1');
assert.equal(buildTerminalLayoutStorageKey('project-1'), 'layout.project-1.v1');
assert.equal(matchesTerminalSessionScope(snapshot, 'project-1'), true);
assert.equal(matchesTerminalSessionScope(snapshot, 'project-2'), false);

console.log('terminal session contract passed.');
