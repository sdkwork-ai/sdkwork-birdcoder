import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  assertLiveProbeEnabled,
  parseArgs,
  preflightDesktopCodexAppServerLive,
  probeDesktopCodexAppServerLive,
} from './probe-desktop-codex-app-server-live.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-codex-live-probe-contract-'));
const hostRoot = path.join(tempRoot, 'provider-host');
const nodeBinary = process.execPath;
const codexExecutable = path.join(hostRoot, 'codex', 'bin', 'codex.exe');
const observedWorkDirs = [];
let closeCount = 0;
let firstMarker = '';

const validatedHost = {
  codexExecutable,
  hostRoot,
  manifest: {
    codex: { version: '0.146.0' },
    node: { version: process.versions.node },
    targetTriple: 'fixture-target',
  },
  nodeBinary,
};

const validateHost = ({ hostRoot: requestedHostRoot }) => {
  assert.equal(path.resolve(requestedHostRoot), path.resolve(hostRoot));
  return validatedHost;
};

function event(eventType, providerEventType, operation, providerSessionId) {
  return {
    event_type: eventType,
    payload: {
      providerEventType,
      providerSessionId,
    },
    session_id: operation.session_id,
  };
}

const providerSessionId = 'provider-session.fixture.opaque';
const runtimeModule = {
  closeCodexAppServerRuntime: async () => {
    closeCount += 1;
  },
  invokeCodexAppServerModelChat: async (operation, options) => {
    observedWorkDirs.push(options.sessionOptions.cwd);
    assert.equal(options.sessionOptions.approvalPolicy, 'never');
    assert.equal(options.sessionOptions.sandbox, 'read-only');
    assert.equal(options.turnOptions.approvalPolicy, 'never');
    const isResume = Object.hasOwn(operation, 'provider_session_id');
    if (isResume) {
      assert.equal(operation.provider_session_id, providerSessionId);
    } else {
      assert.equal(Object.hasOwn(operation, 'provider_session_id'), false);
      firstMarker = options.prompt.match(/exactly ([A-Za-z0-9_]+) and/u)?.[1] ?? '';
      assert.ok(firstMarker);
    }
    const response = isResume ? `${firstMarker}_RESUMED` : firstMarker;
    options.onChunk({ sequence: 0, content: response });
    for (const providerEvent of [
      event(
        isResume ? 'agent.session/resumed' : 'agent.session/started',
        isResume ? 'session/resumed' : 'session/started',
        operation,
        providerSessionId,
      ),
      event('agent.turn.started', 'turn/started', operation, providerSessionId),
      event('agent.message.streamed', 'item/agentMessage/delta', operation, providerSessionId),
      event('agent.message.completed', 'item/completed', operation, providerSessionId),
      event('agent.turn.completed', 'turn/completed', operation, providerSessionId),
    ]) {
      options.onEvent(providerEvent);
    }
    return {
      finish_reason: 'stop',
      messages: [response],
      mode: 'app_server',
      model_request_id: operation.model_request_id,
      ok: true,
      provider_session_id: providerSessionId,
      provider_turn_id: isResume ? 'provider-turn.resume' : 'provider-turn.first',
    };
  },
  probeCodexAppServerRuntime: () => ({
    app_server_available: true,
    app_server_mode: 'app_server',
    executable: codexExecutable,
  }),
};

const moduleLoader = async () => runtimeModule;

try {
  assert.deepEqual(parseArgs([]), {
    hostRoot: '',
    preflightOnly: false,
    timeoutMs: 180_000,
  });
  assert.deepEqual(
    parseArgs(['--host-root', hostRoot, '--timeout-ms', '9000', '--preflight-only']),
    { hostRoot, preflightOnly: true, timeoutMs: 9_000 },
  );
  assert.throws(() => parseArgs(['--timeout-ms', '0']), /positive integer/u);
  assert.throws(() => parseArgs(['--unknown']), /Unknown argument/u);
  assert.throws(() => assertLiveProbeEnabled({}), /must be exactly 1/u);
  assert.throws(
    () => assertLiveProbeEnabled({ SDKWORK_CODEX_APP_SERVER_LIVE_PROBE: 'true' }),
    /must be exactly 1/u,
  );
  assert.doesNotThrow(() => assertLiveProbeEnabled({ SDKWORK_CODEX_APP_SERVER_LIVE_PROBE: '1' }));

  const environment = { SDKWORK_CODEX_CLI_BIN: 'prior-value' };
  const preflight = await preflightDesktopCodexAppServerLive({
    environment,
    hostRoot,
    moduleLoader,
    validateHost,
  });
  assert.equal(preflight.appServerAvailable, true);
  assert.equal(preflight.codexVersion, '0.146.0');
  assert.equal(environment.SDKWORK_CODEX_CLI_BIN, 'prior-value');

  const report = await probeDesktopCodexAppServerLive({
    environment,
    execPath: nodeBinary,
    hostRoot,
    moduleLoader,
    randomId: () => 'fixture-id',
    validateHost,
  });
  assert.equal(report.status, 'passed');
  assert.deepEqual(report.sessionSemantics, {
    canonicalSessionPreservedInEveryEvent: true,
    contextRecoveredAcrossResume: true,
    firstTurnStartedWithoutProviderSessionId: true,
    providerSessionIdEstablished: true,
    providerSessionIdExposedInReport: false,
    providerSessionIdIndependentFromCanonicalSessionId: true,
    providerSessionIdStableAcrossResume: true,
  });
  assert.equal(report.streaming.firstChunkCount, 1);
  assert.equal(report.streaming.resumedChunkCount, 1);
  assert.equal(Object.hasOwn(report, 'providerSessionId'), false);
  assert.equal(closeCount, 1);
  assert.equal(environment.SDKWORK_CODEX_CLI_BIN, 'prior-value');
  assert.equal(observedWorkDirs.length, 2);
  assert.equal(observedWorkDirs[0], observedWorkDirs[1]);
  assert.equal(fs.existsSync(observedWorkDirs[0]), false);

  await assert.rejects(
    probeDesktopCodexAppServerLive({
      environment: {},
      execPath: path.join(tempRoot, 'other-node'),
      hostRoot,
      moduleLoader,
      validateHost,
    }),
    /must execute with the Node.js binary from the packaged provider host/u,
  );

  console.log('desktop Codex app-server live probe contract passed.');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}
