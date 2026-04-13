import assert from 'node:assert/strict';

import {
  convertExecutionResultToTerminalHostLines,
  normalizeTerminalHostSessionState,
  type TerminalExecutionResult,
} from '../packages/sdkwork-birdcoder-commons/src/terminal/runtime.ts';

const normalizedState = normalizeTerminalHostSessionState({
  sessionId: 'session-1',
  profileId: 'claude-code',
  kind: 'cli',
  title: '',
  cwd: '',
  status: 'unknown',
  lastExitCode: undefined,
});

assert.equal(normalizedState.sessionId, 'session-1');
assert.equal(normalizedState.profileId, 'claude-code');
assert.equal(normalizedState.kind, 'cli');
assert.equal(normalizedState.title, 'Claude Code');
assert.equal(normalizedState.cwd, '');
assert.equal(normalizedState.status, 'idle');
assert.equal(normalizedState.lastExitCode, null);

const executionResult: TerminalExecutionResult = {
  profileId: 'powershell',
  kind: 'shell',
  executable: 'powershell',
  args: ['-NoLogo', '-Command', 'Write-Host hello'],
  cwd: 'C:\\repo',
  stdout: 'line-1\nline-2',
  stderr: 'warning-1',
  exitCode: 1,
  executedVia: 'tauri',
};

const outputLines = convertExecutionResultToTerminalHostLines(executionResult, 4);
assert.deepEqual(
  outputLines.map((line) => ({
    text: line.text,
    kind: line.kind,
    sequence: line.sequence,
  })),
  [
    { text: 'line-1', kind: 'stdout', sequence: 5 },
    { text: 'line-2', kind: 'stdout', sequence: 6 },
    { text: 'warning-1', kind: 'stderr', sequence: 7 },
    { text: 'Process exited with code 1', kind: 'system', sequence: 8 },
  ],
);

console.log('terminal host runtime contract passed.');
