#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

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

function dependencyComponents(rootPackage, rootVersion) {
  const dependencies = new Map();
  for (const [scope, entries] of [
    ['required', rootPackage.dependencies],
    ['optional', rootPackage.optionalDependencies],
  ]) {
    for (const [name, declaredVersion] of Object.entries(entries ?? {})) {
      if (!dependencies.has(name)) {
        dependencies.set(name, { declaredVersion: String(declaredVersion), scope });
      }
    }
  }

  return [...dependencies.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, entry]) => {
      const version = entry.declaredVersion.startsWith('workspace:')
        ? rootVersion
        : entry.declaredVersion;
      return {
        type: 'library',
        name,
        version,
        'bom-ref': `${name}@${version}`,
        properties: [
          { name: 'sdkwork:dependencyScope', value: entry.scope },
          { name: 'sdkwork:declaredVersion', value: entry.declaredVersion },
        ],
      };
    });
}

export function writePackageSbomEvidence(options = {}) {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const outputPath = path.resolve(
    rootDir,
    nonEmpty(options.outputPath, 'artifacts/release/sbom/package.sbom.json'),
  );
  const rootPackage = readJson(path.join(rootDir, 'package.json'), 'root package manifest');
  const releaseTag = nonEmpty(options.releaseTag, 'release-local');
  const rootVersion = nonEmpty(rootPackage.version, nonEmpty(options.packageVersion, releaseTag));
  const packageVersion = nonEmpty(options.packageVersion, releaseTag || rootVersion);
  const packageId = nonEmpty(options.packageId, 'sdkwork-birdcoder-package');
  const targetFamily = nonEmpty(options.targetFamily, 'application');
  const targetId = nonEmpty(options.targetId, packageId);

  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ vendor: 'SDKWork', name: 'sdkwork-birdcoder-release-lifecycle', version: '1.0.0' }],
      component: {
        type: 'application',
        name: nonEmpty(options.appId, rootPackage.name || 'sdkwork-birdcoder'),
        version: packageVersion,
        'bom-ref': packageId,
      },
      properties: [
        { name: 'sdkwork:packageId', value: packageId },
        { name: 'sdkwork:targetId', value: targetId },
        { name: 'sdkwork:targetFamily', value: targetFamily },
        { name: 'sdkwork:targetPlatform', value: nonEmpty(options.targetPlatform, 'unspecified') },
        { name: 'sdkwork:targetArchitecture', value: nonEmpty(options.targetArchitecture, 'unspecified') },
        { name: 'sdkwork:runtimeTarget', value: nonEmpty(options.runtimeTarget, targetFamily) },
        { name: 'sdkwork:deploymentProfile', value: nonEmpty(options.deploymentProfile, 'standalone') },
      ],
    },
    components: dependencyComponents(rootPackage, rootVersion),
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(sbom, null, 2)}\n`, 'utf8');
  return { outputPath, sbom };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseOptions(process.argv.slice(2));
  const result = writePackageSbomEvidence({
    appId: options['app-id'] ?? process.env.SDKWORK_APP_ID,
    deploymentProfile: options['deployment-profile'] ?? process.env.SDKWORK_DEPLOYMENT_PROFILE,
    outputPath: options.output,
    packageId: options['package-id'] ?? process.env.SDKWORK_PACKAGE_ID,
    packageVersion: options['package-version'] ?? process.env.SDKWORK_PACKAGE_VERSION,
    releaseTag: options['release-tag'] ?? process.env.SDKWORK_RELEASE_TAG,
    runtimeTarget: options['runtime-target'] ?? process.env.SDKWORK_RUNTIME_TARGET,
    targetFamily: options['target-family'],
    targetArchitecture: options['target-architecture'],
    targetId: options['target-id'] ?? process.env.SDKWORK_PACKAGE_TARGET_ID,
    targetPlatform: options['target-platform'],
  });
  console.log(JSON.stringify({ outputPath: result.outputPath }, null, 2));
}
