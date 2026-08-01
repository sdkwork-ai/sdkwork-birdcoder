#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { sha256File } from '../sdkwork-utils-digest.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const DEFAULT_TIMEOUT_MS = 30_000;
const REQUIRED_WORKERS = [
  'workers/generic-ts-sdk-worker.mjs',
  'workers/engine-sdk-live.mjs',
  'workers/codex-app-server-runtime.mjs',
  'workers/codex-app-server-live.mjs',
  'workers/codex-app-server-interactions.mjs',
  'workers/codex-app-server-host-requests.mjs',
  'workers/codex-cli-live.mjs',
  'workers/provider-cli-live.mjs',
  'workers/generic_python_sdk_worker.py',
];

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
    pythonBinary: '',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case '--python-binary':
        options.pythonBinary = readOptionValue(argv, index, token);
        index += 1;
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

function requireFile(filePath, description) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    throw new Error(`${description} is missing: ${resolvedPath}`);
  }
  return resolvedPath;
}

function readJson(filePath, description) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `${description} is not valid JSON: ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function safeHostPath(hostRoot, relativePath, description) {
  const normalizedRelativePath = String(relativePath ?? '').replaceAll('\\', '/');
  if (
    !normalizedRelativePath
    || path.posix.isAbsolute(normalizedRelativePath)
    || normalizedRelativePath.split('/').includes('..')
  ) {
    throw new Error(`${description} must be a non-empty relative path: ${relativePath}`);
  }
  const resolvedPath = path.resolve(hostRoot, ...normalizedRelativePath.split('/'));
  const relativeToRoot = path.relative(hostRoot, resolvedPath);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error(`${description} escapes the provider host: ${relativePath}`);
  }
  return resolvedPath;
}

function collectFiles(directoryPath, prefix = '') {
  const files = [];
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(absolutePath, relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath.replaceAll('\\', '/'));
    } else {
      throw new Error(`Provider host cannot contain links or special files: ${absolutePath}`);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function collectStringValues(value, values = []) {
  if (typeof value === 'string') {
    values.push(value);
    return values;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValues(item, values);
    }
    return values;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectStringValues(item, values);
    }
  }
  return values;
}

function assertNoSourcePathLeakage(hostRoot, manifest, sourceRoots) {
  const normalizedSourceRoots = sourceRoots
    .map((sourceRoot) => path.resolve(sourceRoot))
    .filter((sourceRoot) => sourceRoot !== path.parse(sourceRoot).root);
  const stringValues = collectStringValues(manifest);
  for (const value of stringValues) {
    for (const sourceRoot of normalizedSourceRoots) {
      const normalizedValue = value.replaceAll('\\', '/').toLowerCase();
      const normalizedSourceRoot = sourceRoot.replaceAll('\\', '/').toLowerCase();
      if (normalizedValue.includes(normalizedSourceRoot)) {
        throw new Error(`Provider host manifest leaks a source path: ${sourceRoot}`);
      }
    }
  }

  const textFilePattern = /(?:\.cmd|\.json|\.mjs|\.py|node_modules\/\.bin\/codex)$/u;
  for (const relativePath of collectFiles(hostRoot)) {
    if (!textFilePattern.test(relativePath) || relativePath === 'runtime-manifest.json') {
      continue;
    }
    const contents = fs.readFileSync(
      safeHostPath(hostRoot, relativePath, 'Staged text file'),
      'utf8',
    ).replaceAll('\\', '/').toLowerCase();
    for (const sourceRoot of normalizedSourceRoots) {
      if (contents.includes(sourceRoot.replaceAll('\\', '/').toLowerCase())) {
        throw new Error(`Staged provider host file leaks a source path: ${relativePath}`);
      }
    }
  }
}

export function validateDesktopProviderHost({
  hostRoot = path.join(rootDir, 'artifacts', 'desktop-provider-host', 'provider-host'),
  sourceRoots = [rootDir, path.join(rootDir, '..', 'sdkwork-kernel')],
} = {}) {
  const resolvedHostRoot = path.resolve(hostRoot);
  if (!fs.existsSync(resolvedHostRoot) || !fs.statSync(resolvedHostRoot).isDirectory()) {
    throw new Error(`Desktop provider host is missing: ${resolvedHostRoot}`);
  }
  const manifestPath = requireFile(
    path.join(resolvedHostRoot, 'runtime-manifest.json'),
    'Desktop provider host manifest',
  );
  const manifest = readJson(manifestPath, 'Desktop provider host manifest');
  if (manifest.schemaVersion !== 1 || manifest.runtime !== 'sdkwork-birdcoder-desktop-provider-host') {
    throw new Error('Desktop provider host manifest identity is invalid.');
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error('Desktop provider host manifest must contain files.');
  }
  if (
    JSON.stringify(manifest.scope?.verifiedProviderHosts) !== JSON.stringify(['codex'])
    || JSON.stringify(manifest.scope?.providerInstallerRuntimes) !== JSON.stringify([])
    || manifest.scope?.pythonRuntimeBundled !== false
    || JSON.stringify(manifest.scope?.verifiedProviderTransports)
      !== JSON.stringify(['codex', 'hermes-agent'])
  ) {
    throw new Error('Desktop provider host verification scope is invalid.');
  }
  const expectedPaths = [];
  for (const entry of manifest.files) {
    const filePath = requireFile(
      safeHostPath(resolvedHostRoot, entry.path, 'Manifest file path'),
      `Manifest file ${entry.path}`,
    );
    const stat = fs.statSync(filePath);
    if (!Number.isSafeInteger(entry.size) || entry.size !== stat.size) {
      throw new Error(`Desktop provider host size mismatch: ${entry.path}`);
    }
    if (!/^[a-f0-9]{64}$/u.test(String(entry.sha256 ?? '')) || sha256File(filePath) !== entry.sha256) {
      throw new Error(`Desktop provider host checksum mismatch: ${entry.path}`);
    }
    expectedPaths.push(String(entry.path).replaceAll('\\', '/'));
  }
  const sortedExpectedPaths = [...expectedPaths].sort((left, right) => left.localeCompare(right));
  if (new Set(expectedPaths).size !== expectedPaths.length) {
    throw new Error('Desktop provider host manifest contains duplicate file paths.');
  }
  if (JSON.stringify(expectedPaths) !== JSON.stringify(sortedExpectedPaths)) {
    throw new Error('Desktop provider host manifest files must be sorted.');
  }
  const actualPaths = collectFiles(resolvedHostRoot)
    .filter((relativePath) => relativePath !== 'runtime-manifest.json');
  if (JSON.stringify(actualPaths) !== JSON.stringify(sortedExpectedPaths)) {
    throw new Error('Desktop provider host inventory does not match its manifest.');
  }

  const nodeBinary = requireFile(
    safeHostPath(resolvedHostRoot, manifest.node?.binary, 'Bundled Node.js path'),
    'Bundled Node.js binary',
  );
  requireFile(
    safeHostPath(resolvedHostRoot, manifest.node?.license, 'Bundled Node.js license path'),
    'Bundled Node.js license',
  );
  if (
    !Array.isArray(manifest.workers)
    || JSON.stringify(manifest.workers) !== JSON.stringify(REQUIRED_WORKERS)
  ) {
    throw new Error('Desktop provider host manifest worker inventory is invalid.');
  }
  for (const worker of REQUIRED_WORKERS) {
    requireFile(
      safeHostPath(resolvedHostRoot, worker, 'Provider worker path'),
      `Provider worker ${worker}`,
    );
  }
  const workerScript = requireFile(
    safeHostPath(
      resolvedHostRoot,
      'workers/generic-ts-sdk-worker.mjs',
      'Generic provider worker path',
    ),
    'Generic provider worker',
  );
  const appServerModule = requireFile(
    safeHostPath(
      resolvedHostRoot,
      'workers/codex-app-server-live.mjs',
      'Codex app-server transport path',
    ),
    'Codex app-server transport',
  );
  const pythonWorkerScript = requireFile(
    safeHostPath(
      resolvedHostRoot,
      'workers/generic_python_sdk_worker.py',
      'Generic Python provider worker path',
    ),
    'Generic Python provider worker',
  );
  const codexExecutable = requireFile(
    safeHostPath(resolvedHostRoot, manifest.codex?.executable, 'Codex executable path'),
    'Bundled Codex executable',
  );
  requireFile(
    safeHostPath(resolvedHostRoot, manifest.codex?.launcher, 'Codex launcher path'),
    'Bundled Codex launcher',
  );
  assertNoSourcePathLeakage(resolvedHostRoot, manifest, sourceRoots);

  return {
    appServerModule,
    codexExecutable,
    hostRoot: resolvedHostRoot,
    manifest,
    manifestPath,
    nodeBinary,
    pythonWorkerScript,
    workerScript,
  };
}

function terminateChild(child) {
  if (!child || child.exitCode != null || child.signalCode != null) {
    return;
  }
  child.kill();
}

function invokeBundledJsonRpcWorkerPing({
  args,
  command,
  cwd,
  description,
  env,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      command,
      args,
      {
        cwd,
        env,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );
    let settled = false;
    let stdout = '';
    let stderr = '';
    const finish = (callback, value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      child.stdin.end();
      terminateChild(child);
      callback(value);
    };
    const timer = setTimeout(() => {
      finish(reject, new Error(`${description} ping timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    child.once('error', (error) => finish(reject, error));
    child.once('exit', (code, signal) => {
      if (!settled) {
        finish(
          reject,
          new Error(
            `${description} exited before ping response: code=${code} signal=${signal}: ${stderr}`,
          ),
        );
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${String(chunk)}`.slice(-64 * 1024);
    });
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
      const newlineIndex = stdout.indexOf('\n');
      if (newlineIndex < 0) {
        return;
      }
      const line = stdout.slice(0, newlineIndex).trim();
      try {
        finish(resolve, JSON.parse(line));
      } catch (error) {
        finish(
          reject,
          new Error(
            `${description} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    });
    child.stdin.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sdkwork/ping',
    })}\n`);
  });
}

export function invokeBundledWorkerPing({
  cwd,
  env,
  nodeBinary,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  workerScript,
}) {
  return invokeBundledJsonRpcWorkerPing({
    args: [workerScript, '--package', '@openai/codex'],
    command: nodeBinary,
    cwd,
    description: 'Bundled Node.js provider worker',
    env,
    timeoutMs,
  });
}

export function invokeBundledPythonWorkerPing({
  cwd,
  env,
  pythonBinary,
  pythonWorkerScript,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  return invokeBundledJsonRpcWorkerPing({
    args: [pythonWorkerScript, '--package', 'run_agent'],
    command: pythonBinary,
    cwd,
    description: 'Bundled Python provider worker',
    env,
    timeoutMs,
  });
}

export function runBundledCodexVersion({
  codexExecutable,
  cwd,
  env,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const result = spawnSync(codexExecutable, ['--version'], {
    cwd,
    encoding: 'utf8',
    env,
    maxBuffer: 1024 * 1024,
    shell: false,
    timeout: timeoutMs,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `Bundled Codex --version failed: ${result.error?.message ?? result.stderr ?? `exit ${result.status}`}`,
    );
  }
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
  if (!/codex(?:-cli)?\s+\d+\.\d+\.\d+/iu.test(output)) {
    throw new Error(`Bundled Codex returned an unexpected version: ${output}`);
  }
  return output;
}

export async function connectBundledCodexAppServer({
  appServerModule,
  cwd,
  env,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const moduleUrl = `${pathToFileURL(appServerModule).href}?smoke=${randomUUID()}`;
  const { createCodexAppServerTransport } = await import(moduleUrl);
  if (typeof createCodexAppServerTransport !== 'function') {
    throw new Error('Bundled Codex app-server transport export is missing.');
  }
  const transport = createCodexAppServerTransport({
    cwd,
    env,
    requestTimeoutMs: timeoutMs,
  });
  try {
    const initializeResult = await transport.connect();
    if (!transport.isReady) {
      throw new Error('Bundled Codex app-server transport did not reach ready state.');
    }
    return {
      initialized: true,
      initializeResult,
    };
  } finally {
    await transport.close();
  }
}

function assertPingResponse(response) {
  if (response?.error) {
    throw new Error(`Bundled provider worker ping failed: ${JSON.stringify(response.error)}`);
  }
  const result = response?.result;
  const expected = {
    app_server_available: true,
    cli_available: true,
    ok: true,
    runtime_available: true,
    runtime_mode: 'app_server',
  };
  for (const [key, value] of Object.entries(expected)) {
    if (result?.[key] !== value) {
      throw new Error(
        `Bundled provider worker ping mismatch for ${key}: expected ${JSON.stringify(value)}, received ${JSON.stringify(result?.[key])}.`,
      );
    }
  }
  return result;
}

function assertPythonPingResponse(response) {
  if (response?.error) {
    throw new Error(`Bundled Python provider worker ping failed: ${JSON.stringify(response.error)}`);
  }
  const result = response?.result;
  if (
    result?.ok !== true
    || result?.backend !== 'python_process'
    || result?.package !== 'run_agent'
    || typeof result?.package_resolved !== 'boolean'
  ) {
    throw new Error(`Bundled Python provider worker ping is invalid: ${JSON.stringify(result)}`);
  }
  return result;
}

function isPathInside(parentDir, candidatePath) {
  const relativePath = path.relative(parentDir, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

export async function smokeDesktopProviderHost(options = {}) {
  const validated = validateDesktopProviderHost({
    hostRoot: String(options.hostRoot ?? '').trim()
      || path.join(rootDir, 'artifacts', 'desktop-provider-host', 'provider-host'),
    sourceRoots: options.sourceRoots,
  });
  const timeoutMs = Number.isSafeInteger(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : DEFAULT_TIMEOUT_MS;
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-provider-host-smoke-'));
  if (isPathInside(rootDir, workDir)) {
    fs.rmSync(workDir, { force: true, recursive: true });
    throw new Error(`Provider host smoke directory must be outside the source workspace: ${workDir}`);
  }
  const providerBinDir = path.join(validated.hostRoot, 'node_modules', '.bin');
  const pythonBinary = String(options.pythonBinary ?? '').trim()
    || String(process.env.SDKWORK_AGENT_PYTHON_BINARY ?? '').trim()
    || (process.platform === 'win32' ? 'python' : 'python3');
  if (!pythonBinary) {
    throw new Error('Python runtime command is required for the Hermes transport smoke.');
  }
  const env = {
    ...process.env,
    PATH: [providerBinDir, process.env.PATH ?? process.env.Path ?? '']
      .filter(Boolean)
      .join(path.delimiter),
    SDKWORK_AGENT_NODE_BINARY: validated.nodeBinary,
    SDKWORK_AGENT_PROVIDER_HOST_ROOT: validated.hostRoot,
    SDKWORK_AGENT_PYTHON_BINARY: pythonBinary,
    SDKWORK_AGENT_PYTHON_WORKER_SCRIPT: validated.pythonWorkerScript,
    SDKWORK_AGENT_TYPESCRIPT_WORKER_SCRIPT: validated.workerScript,
    SDKWORK_KERNEL_ALLOW_MOCK_PROVIDERS: 'false',
    SDKWORK_KERNEL_ENVIRONMENT: 'production',
    SDKWORK_KERNEL_PROFILE_ID: 'desktop.production',
  };
  const workerPingRunner = options.workerPingRunner ?? invokeBundledWorkerPing;
  const codexVersionRunner = options.codexVersionRunner ?? runBundledCodexVersion;
  const appServerRunner = options.appServerRunner ?? connectBundledCodexAppServer;
  const pythonWorkerPingRunner = options.pythonWorkerPingRunner
    ?? invokeBundledPythonWorkerPing;

  try {
    const ping = assertPingResponse(await workerPingRunner({
      cwd: workDir,
      env,
      nodeBinary: validated.nodeBinary,
      timeoutMs,
      workerScript: validated.workerScript,
    }));
    const pythonPing = assertPythonPingResponse(await pythonWorkerPingRunner({
      cwd: workDir,
      env,
      pythonBinary,
      pythonWorkerScript: validated.pythonWorkerScript,
      timeoutMs,
    }));
    const codexVersion = await codexVersionRunner({
      codexExecutable: validated.codexExecutable,
      cwd: workDir,
      env,
      timeoutMs,
    });
    if (!String(codexVersion).includes(String(validated.manifest.codex?.version ?? ''))) {
      throw new Error(
        `Bundled Codex version does not match its manifest: ${codexVersion} != ${validated.manifest.codex?.version ?? 'unknown'}.`,
      );
    }
    const appServer = await appServerRunner({
      appServerModule: validated.appServerModule,
      codexExecutable: validated.codexExecutable,
      cwd: workDir,
      env,
      timeoutMs,
    });
    if (appServer?.initialized !== true) {
      throw new Error('Bundled Codex app-server handshake did not initialize.');
    }
    return {
      appServerInitialized: true,
      codexVersion,
      fileCount: validated.manifest.files.length,
      hermesTransport: {
        packageResolved: pythonPing.package_resolved,
        pythonRuntimeBundled: validated.manifest.scope.pythonRuntimeBundled,
        workerAvailable: true,
      },
      ping: {
        appServerAvailable: ping.app_server_available,
        cliAvailable: ping.cli_available,
        runtimeAvailable: ping.runtime_available,
        runtimeMode: ping.runtime_mode,
      },
      providerInstallerRuntimes: validated.manifest.scope.providerInstallerRuntimes,
      hostRoot: validated.hostRoot,
      targetTriple: validated.manifest.targetTriple,
      verifiedProviderTransports: validated.manifest.scope.verifiedProviderTransports,
      workDirectoryOutsideWorkspace: true,
    };
  } finally {
    fs.rmSync(workDir, { force: true, recursive: true });
  }
}

async function runCli() {
  const result = await smokeDesktopProviderHost(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
