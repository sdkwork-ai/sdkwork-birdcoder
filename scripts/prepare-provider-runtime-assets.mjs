import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sha256File as sha256 } from './sdkwork-utils-digest.mjs';

const PROVIDER_WORKER_FILES = Object.freeze([
  'generic-ts-sdk-worker.mjs',
  'engine-sdk-live.mjs',
  'codex-cli-live.mjs',
  'provider-cli-live.mjs',
]);

const PROVIDERS = Object.freeze([
  {
    id: 'codex',
    packageNames: ['@openai/codex-sdk', '@openai/codex'],
    cliCommand: 'codex',
    cliEnvironmentKey: 'SDKWORK_CODEX_CLI_BIN',
    executableDelivery: 'external-operator-dependency',
    bundled: false,
  },
  {
    id: 'claude-code',
    packageNames: ['@anthropic-ai/claude-agent-sdk'],
    cliCommand: 'claude',
    cliEnvironmentKey: 'SDKWORK_CLAUDE_CLI_BIN',
    executableDelivery: 'external-operator-dependency',
    bundled: false,
  },
  {
    id: 'gemini-cli',
    packageNames: ['@google/gemini-cli-sdk'],
    cliCommand: 'gemini',
    cliEnvironmentKey: 'SDKWORK_GEMINI_CLI_BIN',
    executableDelivery: 'external-operator-dependency',
    bundled: false,
  },
  {
    id: 'opencode',
    packageNames: ['@opencode-ai/sdk'],
    cliCommand: 'opencode',
    cliEnvironmentKey: 'SDKWORK_OPENCODE_CLI_BIN',
    executableDelivery: 'external-operator-dependency',
    bundled: false,
  },
]);

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`Missing required ${label}: ${filePath}`);
  }
}

function normalizePlatform(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'win32' || normalized === 'windows') {
    return 'windows';
  }
  if (normalized === 'darwin' || normalized === 'macos') {
    return 'macos';
  }
  if (normalized === 'linux') {
    return 'linux';
  }
  throw new Error(`Unsupported provider runtime platform: ${value || 'missing'}`);
}

function normalizeArchitecture(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'x64' || normalized === 'amd64' || normalized === 'x86_64') {
    return 'x64';
  }
  if (normalized === 'arm64' || normalized === 'aarch64') {
    return 'arm64';
  }
  throw new Error(`Unsupported provider runtime architecture: ${value || 'missing'}`);
}

function resolveKernelRoot(rootDir, configuredKernelRoot) {
  return path.resolve(
    configuredKernelRoot
      ?? process.env.SDKWORK_KERNEL_ROOT
      ?? path.join(rootDir, '..', 'sdkwork-kernel'),
  );
}

function resolveNodeDestination(platform) {
  return platform === 'windows'
    ? path.join('node', 'node.exe')
    : path.join('node', 'bin', 'node');
}

function copyRuntimeFile(sourcePath, outputDir, relativePath, executable = false) {
  const targetPath = path.join(outputDir, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  if (executable && process.platform !== 'win32') {
    fs.chmodSync(targetPath, 0o755);
  }
  return {
    relativePath: relativePath.replaceAll('\\', '/'),
    sha256: sha256(targetPath),
    size: fs.statSync(targetPath).size,
  };
}

export function prepareProviderRuntimeAssets(options = {}) {
  const rootDir = path.resolve(options.rootDir ?? SCRIPT_ROOT);
  const outputDir = path.resolve(
    rootDir,
    options.outputDir ?? process.env.SDKWORK_BIRDCODER_PROVIDER_RUNTIME_OUTPUT ?? 'artifacts/provider-runtime',
  );
  const targetPlatform = normalizePlatform(
    options.targetPlatform
      ?? process.env.SDKWORK_BIRDCODER_PROVIDER_RUNTIME_PLATFORM
      ?? process.platform,
  );
  const targetArchitecture = normalizeArchitecture(
    options.targetArchitecture
      ?? process.env.SDKWORK_BIRDCODER_PROVIDER_RUNTIME_ARCH
      ?? process.arch,
  );
  const hostPlatform = normalizePlatform(process.platform);
  const hostArchitecture = normalizeArchitecture(process.arch);
  const configuredNodeBinary = options.nodeBinary
    ?? process.env.SDKWORK_BIRDCODER_NODE_BINARY
    ?? '';
  if (
    !configuredNodeBinary
    && (targetPlatform !== hostPlatform || targetArchitecture !== hostArchitecture)
  ) {
    throw new Error(
      'Cross-target provider runtime preparation requires SDKWORK_BIRDCODER_NODE_BINARY for the target platform and architecture.',
    );
  }

  const nodeBinary = path.resolve(configuredNodeBinary || process.execPath);
  ensureFile(nodeBinary, 'provider runtime Node executable');
  const kernelRoot = resolveKernelRoot(rootDir, options.kernelRoot);
  const workerSourceDir = path.join(kernelRoot, 'scripts', 'provider-transport-workers');
  for (const workerFile of PROVIDER_WORKER_FILES) {
    ensureFile(path.join(workerSourceDir, workerFile), `provider worker ${workerFile}`);
  }

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const nodeAsset = copyRuntimeFile(
    nodeBinary,
    outputDir,
    resolveNodeDestination(targetPlatform),
    true,
  );
  const workerAssets = PROVIDER_WORKER_FILES.map((workerFile) => copyRuntimeFile(
    path.join(workerSourceDir, workerFile),
    outputDir,
    path.join('workers', workerFile),
    true,
  ));

  const nodeVersion = String(
    options.nodeVersion
      ?? process.env.SDKWORK_BIRDCODER_NODE_VERSION
      ?? (path.resolve(nodeBinary) === path.resolve(process.execPath) ? process.versions.node : ''),
  ).trim();
  if (!nodeVersion) {
    throw new Error(
      'SDKWORK_BIRDCODER_NODE_VERSION is required when staging an explicit target Node executable.',
    );
  }

  const manifest = {
    schemaVersion: 1,
    kind: 'sdkwork.birdcoder.provider-runtime',
    target: {
      platform: targetPlatform,
      architecture: targetArchitecture,
    },
    node: {
      version: nodeVersion,
      ...nodeAsset,
    },
    workers: workerAssets,
    providers: PROVIDERS,
    providerExecution: {
      bundledProviderExecutables: false,
      readiness: 'probe-installed-cli-or-staged-sdk',
      missingBehavior: 'fail-closed',
    },
    runtimeEnvironment: {
      root: 'SDKWORK_AGENT_PROVIDER_RUNTIME_ROOT',
      nodeBinary: 'SDKWORK_AGENT_NODE_BINARY',
      workerScript: 'SDKWORK_AGENT_TYPESCRIPT_WORKER_SCRIPT',
      sdkPackagePaths: 'SDKWORK_AGENT_SDK_PACKAGE_PATHS',
    },
  };
  const manifestPath = path.join(outputDir, 'runtime-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    outputDir,
    manifestPath,
    manifest,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = prepareProviderRuntimeAssets();
  console.log(JSON.stringify(result.manifest, null, 2));
}
