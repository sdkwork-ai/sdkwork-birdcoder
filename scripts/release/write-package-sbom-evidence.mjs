#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { sha256File } from '../sdkwork-utils-digest.mjs';

const PROVIDER_RUNTIME_FAMILIES = new Set(['desktop', 'server', 'container']);
const REQUIRED_PROVIDER_WORKERS = Object.freeze([
  'workers/generic-ts-sdk-worker.mjs',
  'workers/engine-sdk-live.mjs',
  'workers/codex-cli-live.mjs',
  'workers/provider-cli-live.mjs',
]);

function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      options[key] = 'true';
      continue;
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function nonEmpty(value, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function normalizeRelativePath(value) {
  return String(value ?? '').trim().replaceAll('\\', '/');
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`Missing required ${label}: ${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid ${label} ${filePath}: ${error.message}`);
  }
}

function resolveRuntimeAsset(runtimeRoot, asset, label) {
  const relativePath = normalizeRelativePath(asset?.relativePath);
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.split('/').includes('..')) {
    throw new Error(`Invalid ${label} path in provider runtime manifest: ${relativePath || 'missing'}`);
  }

  const absolutePath = path.resolve(runtimeRoot, ...relativePath.split('/'));
  const normalizedRoot = `${path.resolve(runtimeRoot)}${path.sep}`;
  if (!absolutePath.startsWith(normalizedRoot)) {
    throw new Error(`Unsafe ${label} path in provider runtime manifest: ${relativePath}`);
  }
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new Error(`Missing required ${label}: ${absolutePath}`);
  }

  const expectedSha256 = nonEmpty(asset?.sha256).toLowerCase();
  const actualSha256 = sha256File(absolutePath);
  if (!/^[a-f0-9]{64}$/u.test(expectedSha256) || expectedSha256 !== actualSha256) {
    throw new Error(
      `Provider runtime checksum mismatch for ${relativePath}: manifest=${expectedSha256 || 'missing'} actual=${actualSha256}`,
    );
  }

  const actualSize = fs.statSync(absolutePath).size;
  if (!Number.isSafeInteger(Number(asset?.size)) || Number(asset.size) !== actualSize) {
    throw new Error(
      `Provider runtime size mismatch for ${relativePath}: manifest=${asset?.size ?? 'missing'} actual=${actualSize}`,
    );
  }

  return {
    absolutePath,
    relativePath,
    sha256: actualSha256,
    size: actualSize,
  };
}

function runtimeProperties(role, asset) {
  return [
    { name: 'sdkwork:providerRuntimeRole', value: role },
    { name: 'sdkwork:providerRuntimeRelativePath', value: asset.relativePath },
    { name: 'sdkwork:providerRuntimeSize', value: String(asset.size) },
  ];
}

function createProviderRuntimeComponents(manifestPath, expectedTarget = {}) {
  const resolvedManifestPath = path.resolve(manifestPath);
  const manifest = readJson(resolvedManifestPath, 'provider runtime manifest');
  if (manifest?.kind !== 'sdkwork.birdcoder.provider-runtime' || manifest?.schemaVersion !== 1) {
    throw new Error(`Unsupported provider runtime manifest contract: ${resolvedManifestPath}`);
  }

  const targetPlatform = nonEmpty(manifest?.target?.platform);
  const targetArchitecture = nonEmpty(manifest?.target?.architecture);
  if (!targetPlatform || !targetArchitecture) {
    throw new Error(`Provider runtime manifest is missing target identity: ${resolvedManifestPath}`);
  }
  const expectedPlatform = nonEmpty(expectedTarget.platform);
  const expectedArchitecture = nonEmpty(expectedTarget.architecture);
  if (
    (expectedPlatform && expectedPlatform !== targetPlatform)
    || (expectedArchitecture && expectedArchitecture !== targetArchitecture)
  ) {
    throw new Error(
      `Provider runtime target mismatch: package=${expectedPlatform || 'unspecified'}/${expectedArchitecture || 'unspecified'} runtime=${targetPlatform}/${targetArchitecture}`,
    );
  }

  const runtimeRoot = path.dirname(resolvedManifestPath);
  const nodeAsset = resolveRuntimeAsset(runtimeRoot, manifest.node, 'provider runtime Node executable');
  const nodeVersion = nonEmpty(manifest?.node?.version);
  if (!nodeVersion) {
    throw new Error(`Provider runtime manifest is missing Node version: ${resolvedManifestPath}`);
  }

  const workerAssets = Array.isArray(manifest.workers) ? manifest.workers : [];
  if (workerAssets.length === 0) {
    throw new Error(`Provider runtime manifest is missing worker assets: ${resolvedManifestPath}`);
  }
  const workerPaths = workerAssets.map((worker) => normalizeRelativePath(worker?.relativePath));
  if (new Set(workerPaths).size !== workerPaths.length) {
    throw new Error(`Provider runtime manifest contains duplicate worker paths: ${resolvedManifestPath}`);
  }
  for (const requiredWorker of REQUIRED_PROVIDER_WORKERS) {
    if (!workerPaths.includes(requiredWorker)) {
      throw new Error(`Provider runtime manifest is missing required worker: ${requiredWorker}`);
    }
  }

  const manifestSha256 = sha256File(resolvedManifestPath);
  const manifestSize = fs.statSync(resolvedManifestPath).size;
  const components = [
    {
      type: 'file',
      name: 'sdkwork-birdcoder-provider-runtime-manifest',
      version: String(manifest.schemaVersion),
      'bom-ref': `provider-runtime:manifest:${targetPlatform}-${targetArchitecture}`,
      hashes: [{ alg: 'SHA-256', content: manifestSha256 }],
      properties: [
        { name: 'sdkwork:providerRuntimeRole', value: 'manifest' },
        { name: 'sdkwork:providerRuntimeRelativePath', value: 'runtime-manifest.json' },
        { name: 'sdkwork:providerRuntimeSize', value: String(manifestSize) },
        { name: 'sdkwork:providerRuntimeKind', value: manifest.kind },
      ],
    },
    {
      type: 'application',
      name: 'node',
      version: nodeVersion,
      'bom-ref': `provider-runtime:node:${nodeVersion}:${targetPlatform}-${targetArchitecture}`,
      hashes: [{ alg: 'SHA-256', content: nodeAsset.sha256 }],
      properties: runtimeProperties('node', nodeAsset),
    },
  ];

  for (const worker of workerAssets) {
    const workerAsset = resolveRuntimeAsset(runtimeRoot, worker, 'provider runtime worker');
    components.push({
      type: 'file',
      name: path.posix.basename(workerAsset.relativePath),
      'bom-ref': `provider-runtime:worker:${workerAsset.relativePath}`,
      hashes: [{ alg: 'SHA-256', content: workerAsset.sha256 }],
      properties: runtimeProperties('worker', workerAsset),
    });
  }

  return {
    components,
    manifest,
    manifestSha256,
    manifestSize,
  };
}

export function writePackageSbomEvidence(options = {}) {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const outputPath = path.resolve(rootDir, nonEmpty(options.outputPath, 'artifacts/release/sbom/package.sbom.json'));
  const targetFamily = nonEmpty(options.targetFamily);
  const providerRuntimeManifestPath = nonEmpty(options.providerRuntimeManifestPath);
  const providerRuntimeRequired = PROVIDER_RUNTIME_FAMILIES.has(targetFamily);
  if (providerRuntimeRequired && !providerRuntimeManifestPath) {
    throw new Error(`Provider runtime manifest is required for ${targetFamily} package SBOM evidence.`);
  }

  const rootPackage = readJson(path.join(rootDir, 'package.json'), 'root package manifest');
  const rootVersion = nonEmpty(rootPackage.version, nonEmpty(options.packageVersion, options.releaseTag || 'release-local'));
  const dependencyComponents = Object.entries(rootPackage.dependencies ?? {}).map(([name, version]) => ({
    type: 'library',
    name,
    version: String(version).startsWith('workspace:') ? rootVersion : String(version),
    'bom-ref': `${name}@${String(version)}`,
  }));

  let providerRuntime = null;
  if (providerRuntimeManifestPath) {
    providerRuntime = createProviderRuntimeComponents(
      path.resolve(rootDir, providerRuntimeManifestPath),
      {
        architecture: options.targetArchitecture,
        platform: options.targetPlatform,
      },
    );
  }

  const packageId = nonEmpty(options.packageId, 'sdkwork-birdcoder-package');
  const targetId = nonEmpty(options.targetId, packageId);
  const metadataProperties = [
    { name: 'sdkwork:packageId', value: packageId },
    { name: 'sdkwork:targetId', value: targetId },
    { name: 'sdkwork:runtimeTarget', value: nonEmpty(options.runtimeTarget, targetFamily) },
    { name: 'sdkwork:deploymentProfile', value: nonEmpty(options.deploymentProfile, 'standalone') },
  ];
  if (providerRuntime) {
    metadataProperties.push(
      { name: 'sdkwork:providerRuntimeManifestSha256', value: providerRuntime.manifestSha256 },
      { name: 'sdkwork:providerRuntimeManifestSize', value: String(providerRuntime.manifestSize) },
      {
        name: 'sdkwork:providerExecutablesBundled',
        value: String(Boolean(providerRuntime.manifest?.providerExecution?.bundledProviderExecutables)),
      },
    );
  }

  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ vendor: 'SDKWork', name: 'sdkwork-birdcoder-release-lifecycle', version: '1.0.0' }],
      component: {
        type: 'application',
        name: nonEmpty(options.appId, 'sdkwork-birdcoder'),
        version: nonEmpty(options.packageVersion, options.releaseTag || rootVersion),
        'bom-ref': packageId,
      },
      properties: metadataProperties,
    },
    components: [
      ...dependencyComponents,
      ...(providerRuntime?.components ?? []),
    ],
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(sbom, null, 2)}\n`, 'utf8');
  return {
    outputPath,
    sbom,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseOptions(process.argv.slice(2));
  const result = writePackageSbomEvidence({
    appId: options['app-id'] ?? process.env.SDKWORK_APP_ID,
    deploymentProfile: options['deployment-profile'] ?? process.env.SDKWORK_DEPLOYMENT_PROFILE,
    outputPath: options.output,
    packageId: options['package-id'] ?? process.env.SDKWORK_PACKAGE_ID,
    packageVersion: options['package-version'] ?? process.env.SDKWORK_PACKAGE_VERSION,
    providerRuntimeManifestPath: options['provider-runtime-manifest'],
    releaseTag: options['release-tag'] ?? process.env.SDKWORK_RELEASE_TAG,
    runtimeTarget: options['runtime-target'] ?? process.env.SDKWORK_RUNTIME_TARGET,
    targetFamily: options['target-family'],
    targetArchitecture: options['target-architecture'],
    targetId: options['target-id'] ?? process.env.SDKWORK_PACKAGE_TARGET_ID,
    targetPlatform: options['target-platform'],
  });
  console.log(JSON.stringify({ outputPath: result.outputPath }, null, 2));
}
