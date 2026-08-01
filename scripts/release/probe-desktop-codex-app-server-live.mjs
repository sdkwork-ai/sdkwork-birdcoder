#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { validateDesktopProviderHost } from './smoke-desktop-provider-host.mjs';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..', '..');
const DEFAULT_HOST_ROOT = path.join(rootDir, 'target', 'release', 'provider-host');
const DEFAULT_TIMEOUT_MS = 180_000;
const LIVE_PROBE_ENV = 'SDKWORK_CODEX_APP_SERVER_LIVE_PROBE';
const CHILD_PROCESS_ENV = 'SDKWORK_CODEX_APP_SERVER_LIVE_PROBE_CHILD';
const CODEX_CLI_ENV = 'SDKWORK_CODEX_CLI_BIN';

function readOptionValue(argv, index, flag) {
  const value = String(argv[index + 1] ?? '').trim();
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

export function parseArgs(argv) {
  const options = {
    hostRoot: '',
    preflightOnly: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case '--preflight-only':
        options.preflightOnly = true;
        break;
      case '--host-root':
        options.hostRoot = readOptionValue(argv, index, token);
        index += 1;
        break;
      case '--timeout-ms': {
        const timeoutMs = Number.parseInt(readOptionValue(argv, index, token), 10);
        if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
          throw new Error('--timeout-ms must be a positive integer.');
        }
        options.timeoutMs = timeoutMs;
        index += 1;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }
  return options;
}

export function assertLiveProbeEnabled(environment = process.env) {
  if (String(environment[LIVE_PROBE_ENV] ?? '').trim() !== '1') {
    throw new Error(`${LIVE_PROBE_ENV} must be exactly 1 before invoking the real provider.`);
  }
}

function sameExecutable(left, right) {
  const normalize = (value) => {
    const resolved = path.resolve(String(value ?? ''));
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  return normalize(left) === normalize(right);
}

function isPathInside(parentDir, candidatePath) {
  const relativePath = path.relative(parentDir, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function requiredFunction(value, name) {
  if (typeof value !== 'function') {
    throw new Error(`Packaged Codex app-server runtime does not export ${name}.`);
  }
  return value;
}

function loadOptions(options) {
  const hostRoot = String(options.hostRoot ?? '').trim() || DEFAULT_HOST_ROOT;
  const timeoutMs = Number.isSafeInteger(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : DEFAULT_TIMEOUT_MS;
  const validateHost = options.validateHost ?? validateDesktopProviderHost;
  const validated = validateHost({ hostRoot, sourceRoots: options.sourceRoots });
  const runtimeModulePath = path.join(
    validated.hostRoot,
    'workers',
    'codex-app-server-runtime.mjs',
  );
  return { runtimeModulePath, timeoutMs, validated };
}

async function loadRuntimeModule(runtimeModulePath, moduleLoader) {
  const loadModule = moduleLoader ?? ((moduleUrl) => import(moduleUrl));
  const runtime = await loadModule(pathToFileURL(runtimeModulePath).href);
  return {
    close: requiredFunction(runtime.closeCodexAppServerRuntime, 'closeCodexAppServerRuntime'),
    invoke: requiredFunction(
      runtime.invokeCodexAppServerModelChat,
      'invokeCodexAppServerModelChat',
    ),
    probe: requiredFunction(runtime.probeCodexAppServerRuntime, 'probeCodexAppServerRuntime'),
  };
}

async function withCodexExecutable(environment, codexExecutable, callback) {
  const hadPreviousValue = Object.hasOwn(environment, CODEX_CLI_ENV);
  const previousValue = environment[CODEX_CLI_ENV];
  environment[CODEX_CLI_ENV] = codexExecutable;
  try {
    return await callback();
  } finally {
    if (hadPreviousValue) {
      environment[CODEX_CLI_ENV] = previousValue;
    } else {
      delete environment[CODEX_CLI_ENV];
    }
  }
}

function assertRuntimeProbe(probe, codexExecutable) {
  if (
    probe?.app_server_available !== true
    || probe.app_server_mode !== 'app_server'
    || !sameExecutable(probe.executable, codexExecutable)
  ) {
    throw new Error(`Packaged Codex app-server probe failed: ${JSON.stringify(probe)}.`);
  }
}

export async function preflightDesktopCodexAppServerLive(options = {}) {
  const { runtimeModulePath, validated } = loadOptions(options);
  const environment = options.environment ?? process.env;
  return withCodexExecutable(environment, validated.codexExecutable, async () => {
    const runtime = await loadRuntimeModule(runtimeModulePath, options.moduleLoader);
    const probe = runtime.probe(environment);
    assertRuntimeProbe(probe, validated.codexExecutable);
    return {
      appServerAvailable: true,
      codexVersion: validated.manifest.codex.version,
      nodeVersion: validated.manifest.node.version,
      hostRoot: validated.hostRoot,
      targetTriple: validated.manifest.targetTriple,
    };
  });
}

function collectText(result, chunks) {
  const streamed = chunks.map((chunk) => String(chunk?.content ?? '')).join('');
  return streamed || (result?.messages ?? []).map(String).join('');
}

function assertChunkSequence(chunks, label) {
  if (chunks.length === 0) {
    throw new Error(`${label} did not emit any streaming chunks.`);
  }
  for (const [index, chunk] of chunks.entries()) {
    if (chunk?.sequence !== index || typeof chunk.content !== 'string') {
      throw new Error(`${label} emitted an invalid streaming chunk at index ${index}.`);
    }
  }
}

function summarizeAndAssertEvents(events, expected) {
  const eventTypes = [...new Set(events.map((event) => event?.event_type).filter(Boolean))];
  const providerEventTypes = [
    ...new Set(events.map((event) => event?.payload?.providerEventType).filter(Boolean)),
  ];
  for (const eventType of expected.eventTypes) {
    if (!eventTypes.includes(eventType)) {
      throw new Error(`${expected.label} is missing Kernel event ${eventType}.`);
    }
  }
  if (events.some((event) => event?.session_id !== expected.sessionId)) {
    throw new Error(`${expected.label} emitted an event outside the canonical Session.`);
  }
  const providerSessionIds = events
    .map((event) => event?.payload?.providerSessionId)
    .filter(Boolean);
  if (
    providerSessionIds.length === 0
    || providerSessionIds.some((providerSessionId) => providerSessionId !== expected.providerSessionId)
  ) {
    throw new Error(`${expected.label} lost provider Session correlation.`);
  }
  if (eventTypes.some((eventType) => String(eventType).startsWith('agent.tool.'))) {
    throw new Error(`${expected.label} unexpectedly invoked a tool.`);
  }
  return {
    count: events.length,
    eventTypes,
    providerEventTypes,
  };
}

function assertCompletedResult(result, expectedRequestId, label) {
  if (
    result?.ok !== true
    || result.mode !== 'app_server'
    || result.finish_reason !== 'stop'
    || result.model_request_id !== expectedRequestId
    || typeof result.provider_turn_id !== 'string'
    || !result.provider_turn_id.trim()
  ) {
    throw new Error(`${label} returned an invalid completion: ${JSON.stringify(result)}.`);
  }
}

export async function probeDesktopCodexAppServerLive(options = {}) {
  const { runtimeModulePath, timeoutMs, validated } = loadOptions(options);
  const environment = options.environment ?? process.env;
  const executedBy = options.execPath ?? process.execPath;
  if (!sameExecutable(executedBy, validated.nodeBinary)) {
    throw new Error('The live probe must execute with the Node.js binary from the packaged provider host.');
  }

  return withCodexExecutable(environment, validated.codexExecutable, async () => {
    const runtime = await loadRuntimeModule(runtimeModulePath, options.moduleLoader);
    const runtimeProbe = runtime.probe(environment);
    assertRuntimeProbe(runtimeProbe, validated.codexExecutable);

    const nonce = String((options.randomId ?? randomUUID)()).replaceAll('-', '');
    const canonicalSessionId = `session.codex-app-server-live.${nonce}`;
    const firstRequestId = `model-request.codex-app-server-live.first.${nonce}`;
    const resumeRequestId = `model-request.codex-app-server-live.resume.${nonce}`;
    const marker = `BIRDCODER_CODEX_APP_SERVER_${nonce}`;
    const resumedMarker = `${marker}_RESUMED`;
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-codex-app-server-live-'));
    if (isPathInside(rootDir, workDir)) {
      fs.rmSync(workDir, { force: true, recursive: true });
      throw new Error(`Live probe directory must be outside the source workspace: ${workDir}`);
    }

    const invoke = async (operation, prompt) => {
      const chunks = [];
      const events = [];
      const result = await runtime.invoke(operation, {
        onChunk: (chunk) => {
          chunks.push(chunk);
        },
        onEvent: (event) => {
          events.push(event);
        },
        prompt,
        sessionOptions: {
          approvalPolicy: 'never',
          cwd: workDir,
          sandbox: 'read-only',
        },
        turnOptions: {
          approvalPolicy: 'never',
          cwd: workDir,
        },
      });
      return { chunks, events, result };
    };

    try {
      const first = await invoke(
        {
          model_request_id: firstRequestId,
          session_id: canonicalSessionId,
          timeout_ms: timeoutMs,
        },
        `Reply with exactly ${marker} and no other text. Do not call tools.`,
      );
      assertCompletedResult(first.result, firstRequestId, 'First live Turn');
      assertChunkSequence(first.chunks, 'First live Turn');
      if (collectText(first.result, first.chunks) !== marker) {
        throw new Error('First live Turn did not return the exact marker.');
      }

      const providerSessionId = String(first.result.provider_session_id ?? '').trim();
      if (
        !providerSessionId
        || providerSessionId === canonicalSessionId
        || providerSessionId.includes(canonicalSessionId)
      ) {
        throw new Error('The provider Session identity is absent or derived from sessionId.');
      }
      const firstEvents = summarizeAndAssertEvents(first.events, {
        eventTypes: [
          'agent.session/started',
          'agent.turn.started',
          'agent.message.streamed',
          'agent.message.completed',
          'agent.turn.completed',
        ],
        label: 'First live Turn',
        providerSessionId,
        sessionId: canonicalSessionId,
      });

      const resumed = await invoke(
        {
          model_request_id: resumeRequestId,
          provider_session_id: providerSessionId,
          session_id: canonicalSessionId,
          timeout_ms: timeoutMs,
        },
        'Using the marker from the immediately previous user instruction, reply with exactly '
          + 'that marker followed by _RESUMED. Do not call tools.',
      );
      assertCompletedResult(resumed.result, resumeRequestId, 'Resumed live Turn');
      assertChunkSequence(resumed.chunks, 'Resumed live Turn');
      if (collectText(resumed.result, resumed.chunks) !== resumedMarker) {
        throw new Error('Resumed live Turn did not recover context and return the exact marker.');
      }
      if (resumed.result.provider_session_id !== providerSessionId) {
        throw new Error('Resumed live Turn changed the opaque provider Session identity.');
      }
      if (resumed.result.provider_turn_id === first.result.provider_turn_id) {
        throw new Error('Resumed live Turn reused the first provider Turn identity.');
      }
      const resumedEvents = summarizeAndAssertEvents(resumed.events, {
        eventTypes: [
          'agent.session/resumed',
          'agent.turn.started',
          'agent.message.streamed',
          'agent.message.completed',
          'agent.turn.completed',
        ],
        label: 'Resumed live Turn',
        providerSessionId,
        sessionId: canonicalSessionId,
      });

      return {
        probe: 'sdkwork-birdcoder-packaged-codex-app-server-live',
        runtime: {
          appServerAvailable: true,
          codexVersion: validated.manifest.codex.version,
          nodeVersion: validated.manifest.node.version,
          targetTriple: validated.manifest.targetTriple,
        },
        schemaVersion: 1,
        sessionSemantics: {
          canonicalSessionPreservedInEveryEvent: true,
          contextRecoveredAcrossResume: true,
          firstTurnStartedWithoutProviderSessionId: true,
          providerSessionIdEstablished: true,
          providerSessionIdExposedInReport: false,
          providerSessionIdIndependentFromCanonicalSessionId: true,
          providerSessionIdStableAcrossResume: true,
        },
        status: 'passed',
        streaming: {
          firstChunkCount: first.chunks.length,
          firstEvents,
          resumedChunkCount: resumed.chunks.length,
          resumedEvents,
        },
      };
    } finally {
      await runtime.close();
      fs.rmSync(workDir, { force: true, recursive: true });
    }
  });
}

function runWithBundledNode(validated) {
  const result = spawnSync(
    validated.nodeBinary,
    [__filename, ...process.argv.slice(2)],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        [CHILD_PROCESS_ENV]: '1',
        [CODEX_CLI_ENV]: validated.codexExecutable,
      },
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}

async function runCli() {
  const options = parseArgs(process.argv.slice(2));
  if (options.preflightOnly) {
    const result = await preflightDesktopCodexAppServerLive(options);
    console.log(JSON.stringify({ ...result, status: 'passed' }, null, 2));
    return;
  }

  assertLiveProbeEnabled();
  const loaded = loadOptions(options);
  if (!sameExecutable(process.execPath, loaded.validated.nodeBinary)) {
    process.exitCode = runWithBundledNode(loaded.validated);
    return;
  }
  if (process.env[CHILD_PROCESS_ENV] === '1' || sameExecutable(process.execPath, loaded.validated.nodeBinary)) {
    const result = await probeDesktopCodexAppServerLive(options);
    console.log(JSON.stringify(result, null, 2));
  }
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
