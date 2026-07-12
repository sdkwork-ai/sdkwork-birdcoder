import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const binary = [
  path.join(root, 'target/debug/birdcoder-kernel-turn.exe'),
  path.join(root, 'target/debug/birdcoder-kernel-turn'),
].find((candidate) => fs.existsSync(candidate));
assert.ok(binary, 'birdcoder-kernel-turn must be built before the vertical contract runs');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-birdcoder-codex-vertical-'));
const workspace = path.join(tempRoot, 'workspace');
const fixture = path.join(tempRoot, 'codex-fixture.mjs');
const capture = path.join(tempRoot, 'capture.jsonl');
fs.mkdirSync(workspace, { recursive: true });

try {
  fs.writeFileSync(
    fixture,
    `import fs from 'node:fs';
import path from 'node:path';

let prompt = '';
for await (const chunk of process.stdin) prompt += chunk;
const args = process.argv.slice(2);
const cdIndex = args.indexOf('--cd');
const cwd = cdIndex >= 0 ? path.resolve(args[cdIndex + 1]) : process.cwd();
const resumeIndex = args.indexOf('resume');
const resumedSession = resumeIndex >= 0 ? args[resumeIndex + 1] : null;
const sessionId = resumedSession || 'thread-contract-123';
fs.appendFileSync(process.env.SDKWORK_CODEX_CONTRACT_CAPTURE, JSON.stringify({ args, cwd, prompt }) + '\\n');

if (prompt.includes('FIRST_TURN')) {
  fs.writeFileSync(path.join(cwd, 'sdkwork-live-marker.txt'), 'SDKWORK_BIRDCODER_CODEX_LIVE_OK\\n');
} else if (prompt.includes('SECOND_TURN')) {
  if (resumedSession !== 'thread-contract-123') throw new Error('missing expected resume session');
  if (!fs.existsSync(path.join(cwd, 'sdkwork-live-marker.txt'))) throw new Error('first-turn marker missing');
  fs.writeFileSync(path.join(cwd, 'sdkwork-resume-marker.txt'), 'SDKWORK_BIRDCODER_CODEX_RESUME_OK\\n');
}

process.stdout.write(JSON.stringify({ type: 'thread.started', thread_id: sessionId }) + '\\n');
process.stdout.write(JSON.stringify({
  type: 'item.completed',
  item: { type: 'agent_message', text: prompt.includes('SECOND_TURN') ? 'resume completed' : 'first turn completed' },
}) + '\\n');
process.stdout.write(JSON.stringify({ type: 'turn.completed' }) + '\\n');
`,
    'utf8',
  );

  const wrapper = createCliWrapper(tempRoot, fixture);
  const environment = {
    ...process.env,
    SDKWORK_CODEX_CLI_BIN: wrapper,
    SDKWORK_CODEX_CONTRACT_CAPTURE: capture,
    SDKWORK_KERNEL_ENVIRONMENT: 'production',
    SDKWORK_KERNEL_ALLOW_MOCK_PROVIDERS: '0',
  };

  const first = executeTurn(environment, {
    inputSummary: 'FIRST_TURN create the marker file',
    workingDirectory: workspace,
  });
  assert.equal(first.assistantContent, 'first turn completed');
  assert.equal(first.nativeSessionId, 'thread-contract-123');
  assert.equal(
    fs.readFileSync(path.join(workspace, 'sdkwork-live-marker.txt'), 'utf8'),
    'SDKWORK_BIRDCODER_CODEX_LIVE_OK\n',
  );

  const second = executeTurn(environment, {
    inputSummary: 'SECOND_TURN verify continuity and create the resume marker',
    nativeSessionId: first.nativeSessionId,
    workingDirectory: workspace,
  });
  assert.equal(second.assistantContent, 'resume completed');
  assert.equal(second.nativeSessionId, 'thread-contract-123');
  assert.equal(
    fs.readFileSync(path.join(workspace, 'sdkwork-resume-marker.txt'), 'utf8'),
    'SDKWORK_BIRDCODER_CODEX_RESUME_OK\n',
  );

  const invocations = fs
    .readFileSync(capture, 'utf8')
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line));
  assert.equal(invocations.length, 2);
  assert.equal(path.resolve(invocations[0].cwd), path.resolve(workspace));
  assertIncludesPair(invocations[0].args, '--model', 'gpt-5.4');
  assertIncludesPair(invocations[0].args, '--sandbox', 'workspace-write');
  assertIncludesPair(invocations[0].args, '--config', 'approval_policy="on-failure"');
  assertIncludesPair(invocations[1].args, 'resume', 'thread-contract-123');

  console.log('Codex local Provider vertical contract passed.');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function executeTurn(environment, overrides) {
  const request = {
    engineId: 'codex',
    modelId: 'gpt-5.4',
    nativeSessionId: overrides.nativeSessionId ?? null,
    requestKind: 'chat',
    inputSummary: overrides.inputSummary,
    workingDirectory: overrides.workingDirectory,
    timeoutMs: 30_000,
    maxOutputBytes: 2 * 1024 * 1024,
    config: {
      approvalPolicy: 'on-failure',
      ephemeral: false,
      fullAuto: false,
      sandboxMode: 'workspace-write',
      skipGitRepoCheck: true,
    },
  };
  const result = spawnSync(binary, [], {
    cwd: root,
    env: environment,
    input: JSON.stringify(request),
    encoding: 'utf8',
    timeout: 45_000,
    windowsHide: true,
  });
  assert.equal(
    result.status,
    0,
    `kernel turn failed: ${result.error?.message ?? result.stderr ?? 'unknown error'}`,
  );
  const payload = JSON.parse(result.stdout);
  assert.doesNotMatch(payload.assistantContent, /stub|sdk_probe|mock response/iu);
  return payload;
}

function createCliWrapper(directory, fixture) {
  if (process.platform === 'win32') {
    const wrapper = path.join(directory, 'codex.cmd');
    fs.writeFileSync(wrapper, `@echo off\r\n"${process.execPath}" "${fixture}" %*\r\n`, 'utf8');
    return wrapper;
  }
  const wrapper = path.join(directory, 'codex');
  const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  fs.writeFileSync(wrapper, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(fixture)} "$@"\n`, 'utf8');
  fs.chmodSync(wrapper, 0o755);
  return wrapper;
}

function assertIncludesPair(values, key, expectedValue) {
  const index = values.indexOf(key);
  assert.notEqual(index, -1, `${key} must be present`);
  assert.equal(values[index + 1], expectedValue);
}
