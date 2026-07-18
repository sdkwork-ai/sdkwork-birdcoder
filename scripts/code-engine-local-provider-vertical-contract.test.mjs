import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const kernelWorkerRoot = path.resolve(root, '..', 'sdkwork-kernel', 'scripts', 'provider-transport-workers');
const binary = [
  path.join(root, 'target/debug/birdcoder-kernel-turn.exe'),
  path.join(root, 'target/debug/birdcoder-kernel-turn'),
].find((candidate) => fs.existsSync(candidate));
assert.ok(binary, 'birdcoder-kernel-turn must be built before the provider contract runs');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-birdcoder-provider-vertical-'));
const fixture = path.join(tempRoot, 'provider-fixture.mjs');
const definitions = [
  {
    engineId: 'codex',
    modelId: 'gpt-5.4',
    environmentKey: 'SDKWORK_CODEX_CLI_BIN',
    sessionFlag: 'resume',
    sessionId: 'codex-contract-session',
  },
  {
    engineId: 'claude-code',
    modelId: 'claude-sonnet-4-6',
    environmentKey: 'SDKWORK_CLAUDE_CLI_BIN',
    sessionFlag: '--resume',
    sessionId: 'claude-code-contract-session',
  },
  {
    engineId: 'gemini',
    modelId: 'auto-gemini-3',
    environmentKey: 'SDKWORK_GEMINI_CLI_BIN',
    sessionFlag: '--resume',
    sessionId: 'gemini-contract-session',
  },
  {
    engineId: 'opencode',
    modelId: 'opencode/big-pickle',
    environmentKey: 'SDKWORK_OPENCODE_CLI_BIN',
    sessionFlag: '--session',
    sessionId: 'opencode-contract-session',
  },
];

try {
  fs.writeFileSync(
    fixture,
    `import fs from 'node:fs';
import path from 'node:path';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const engine = process.env.SDKWORK_VERTICAL_ENGINE;
const args = process.argv.slice(2);
const cdIndex = args.indexOf('--cd');
const dirIndex = args.indexOf('--dir');
const cwd = path.resolve(cdIndex >= 0 ? args[cdIndex + 1] : dirIndex >= 0 ? args[dirIndex + 1] : process.cwd());
const sessionFlag = engine === 'opencode' ? '--session' : engine === 'codex' ? 'resume' : '--resume';
const sessionIndex = args.indexOf(sessionFlag);
const resumedSession = sessionIndex >= 0 ? args[sessionIndex + 1] : null;
const sessionId = resumedSession || engine + '-contract-session';
const prompt = input;
const marker = path.join(cwd, 'sdkwork-' + engine + '-marker.txt');
const resumeMarker = path.join(cwd, 'sdkwork-' + engine + '-resume-marker.txt');
if (prompt.includes('FIRST_TURN')) fs.writeFileSync(marker, 'SDKWORK_' + engine.toUpperCase() + '_LIVE_OK\\n');
if (prompt.includes('SECOND_TURN')) {
  if (!resumedSession) throw new Error('resume session missing');
  if (!fs.existsSync(marker)) throw new Error('first marker missing');
  fs.writeFileSync(resumeMarker, 'SDKWORK_' + engine.toUpperCase() + '_RESUME_OK\\n');
}
const text = prompt.includes('SECOND_TURN') ? 'resume completed' : 'first turn completed';
if (engine === 'codex') {
  process.stdout.write(JSON.stringify({ type: 'thread.started', thread_id: sessionId }) + '\\n');
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text } }) + '\\n');
} else if (engine === 'claude-code') {
  process.stdout.write(JSON.stringify({ type: 'system', subtype: 'init', session_id: sessionId }) + '\\n');
  process.stdout.write(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } }) + '\\n');
} else if (engine === 'gemini') {
  process.stdout.write(JSON.stringify({ type: 'init', session_id: sessionId }) + '\\n');
  process.stdout.write(JSON.stringify({ type: 'content', value: text }) + '\\n');
} else {
  process.stdout.write(JSON.stringify({ type: 'text', sessionID: sessionId, part: { text } }) + '\\n');
}
`,
    'utf8',
  );

  for (const definition of definitions) {
    const workspace = path.join(tempRoot, definition.engineId);
    fs.mkdirSync(workspace, { recursive: true });
    const wrapper = createCliWrapper(tempRoot, fixture, definition.engineId);
    const environment = {
      ...process.env,
      [definition.environmentKey]: wrapper,
      SDKWORK_VERTICAL_ENGINE: definition.engineId,
      SDKWORK_KERNEL_ENVIRONMENT: 'production',
      SDKWORK_KERNEL_ALLOW_MOCK_PROVIDERS: '0',
      SDKWORK_AGENT_NODE_BINARY: process.execPath,
      SDKWORK_AGENT_TYPESCRIPT_WORKER_SCRIPT: path.join(
        kernelWorkerRoot,
        'generic-ts-sdk-worker.mjs',
      ),
    };

    const first = executeTurn(environment, definition, workspace, 'FIRST_TURN create a marker');
    assert.equal(first.nativeSessionId, definition.sessionId);
    assert.equal(first.assistantContent, 'first turn completed');
    assert.equal(
      fs.readFileSync(path.join(workspace, `sdkwork-${definition.engineId}-marker.txt`), 'utf8'),
      `SDKWORK_${definition.engineId.toUpperCase()}_LIVE_OK\n`,
    );

    const second = executeTurn(
      environment,
      definition,
      workspace,
      'SECOND_TURN resume and create a marker',
      first.nativeSessionId,
    );
    assert.equal(second.nativeSessionId, definition.sessionId);
    assert.equal(second.assistantContent, 'resume completed');
    assert.equal(
      fs.readFileSync(
        path.join(workspace, `sdkwork-${definition.engineId}-resume-marker.txt`),
        'utf8',
      ),
      `SDKWORK_${definition.engineId.toUpperCase()}_RESUME_OK\n`,
    );
  }

  console.log('All four code-engine local Provider vertical contracts passed.');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function executeTurn(environment, definition, workspace, inputSummary, nativeSessionId = null) {
  const request = {
    engineId: definition.engineId,
    modelId: definition.modelId,
    nativeSessionId,
    requestKind: 'chat',
    inputSummary,
    workingDirectory: workspace,
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
    `${definition.engineId} turn failed: ${(result.error?.message ?? result.stderr) || result.stdout || 'unknown error'}`,
  );
  const payload = JSON.parse(result.stdout);
  assert.doesNotMatch(payload.assistantContent, /stub|sdk_probe|mock response/iu);
  return payload;
}

function createCliWrapper(directory, fixturePath, engineId) {
  if (process.platform === 'win32') {
    const wrapper = path.join(directory, `${engineId}.cmd`);
    fs.writeFileSync(wrapper, `@echo off\r\n"${process.execPath}" "${fixturePath}" %*\r\n`, 'utf8');
    return wrapper;
  }
  const wrapper = path.join(directory, engineId);
  const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  fs.writeFileSync(wrapper, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(fixturePath)} "$@"\n`, 'utf8');
  fs.chmodSync(wrapper, 0o755);
  return wrapper;
}
