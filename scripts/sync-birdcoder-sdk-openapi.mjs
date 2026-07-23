#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { applyWebFrameworkOpenApiExtensions } from './web-framework-openapi-extensions.mjs';

const HTTP_METHODS = new Set(['delete', 'get', 'head', 'options', 'patch', 'post', 'put', 'trace']);
const SDK_OWNER = 'sdkwork-birdcoder';
const APP_API_AUTHORITY = 'sdkwork-birdcoder-app-api';
const APP_API_SURFACE = 'app-api';
const APP_API_PREFIX = '/app/v3/api';
const APP_SDK_FAMILY = 'sdkwork-birdcoder-app-sdk';
const APP_FAMILY_ROOT = `sdks/${APP_SDK_FAMILY}`;
const APP_MANIFEST_PATH = `${APP_FAMILY_ROOT}/sdk-manifest.json`;
const DOMAIN_OWNERSHIP_PATH = 'specs/domain-ownership.spec.json';
const RETIRED_PATHS = [
  'apps/sdkwork-birdcoder-pc/sdks',
  'sdks/sdkwork-birdcoder-backend-sdk',
  'sdks/specs/openapi',
];

function normalizeRelativePath(value) {
  return String(value ?? '').replace(/\\/gu, '/');
}

function absolutePath(rootDir, relativePath) {
  return path.join(rootDir, ...normalizeRelativePath(relativePath).split('/'));
}

function readJson(rootDir, relativePath) {
  return JSON.parse(fs.readFileSync(absolutePath(rootDir, relativePath), 'utf8'));
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeJson(rootDir, relativePath, value, { check, mismatches }) {
  const filePath = absolutePath(rootDir, relativePath);
  const expected = serializeJson(value);
  if (check) {
    if (!fs.existsSync(filePath)) {
      mismatches.push(`Missing derived App SDK OpenAPI: ${relativePath}`);
      return;
    }
    if (fs.readFileSync(filePath, 'utf8') !== expected) {
      mismatches.push(`Out-of-date derived App SDK OpenAPI: ${relativePath}`);
    }
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, expected, 'utf8');
}

export function collectBirdcoderAppOperations(document) {
  const operations = [];
  for (const [routePath, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!HTTP_METHODS.has(method)) {
        continue;
      }
      operations.push({ method, operation, path: routePath });
    }
  }
  return operations;
}

function pathMatchesPrefix(routePath, prefix) {
  return routePath === prefix || routePath.startsWith(`${prefix}/`);
}

function assertRetiredSurfacesAreAbsent(rootDir) {
  for (const relativePath of RETIRED_PATHS) {
    assert.equal(
      fs.existsSync(absolutePath(rootDir, relativePath)),
      false,
      `Retired BirdCoder SDK surface must remain absent: ${relativePath}`,
    );
  }
}

function assertAppManifest(manifest) {
  assert.equal(manifest.sdkOwner, SDK_OWNER);
  assert.equal(manifest.sdkFamily, APP_SDK_FAMILY);
  assert.equal(manifest.sdkName, APP_SDK_FAMILY);
  assert.equal(manifest.apiAuthority, APP_API_AUTHORITY);
  assert.equal(manifest.discoverySurface?.sdkTarget, 'app');
  assert.equal(manifest.discoverySurface?.apiPrefix, APP_API_PREFIX);
  assert.equal(manifest.authoritySpec, `openapi/${APP_API_AUTHORITY}.openapi.json`);
  assert.equal(manifest.generationInputSpec, `openapi/${APP_API_AUTHORITY}.sdkgen.json`);
  assert.ok(Array.isArray(manifest.sdkDependencies), 'App SDK manifest must declare sdkDependencies.');
}

function assertZeroNonAppSurfaces(domainOwnership) {
  assert.equal(domainOwnership.apiOwnership?.backendApi?.owned, false);
  assert.equal(domainOwnership.apiOwnership?.backendApi?.operationCount, 0);
  assert.equal(domainOwnership.apiOwnership?.openApi?.owned, false);
  assert.equal(domainOwnership.apiOwnership?.openApi?.operationCount, 0);
}

function assertCanonicalAppAuthority(document, manifest, domainOwnership) {
  assert.equal(document.openapi, '3.1.0');
  assert.equal(document['x-sdkwork-owner'], SDK_OWNER);
  assert.equal(document['x-sdkwork-api-authority'], APP_API_AUTHORITY);
  assert.equal(document.servers?.[0]?.url, APP_API_PREFIX);

  const appOwnership = domainOwnership.apiOwnership?.appApi;
  assert.equal(appOwnership?.authority, APP_API_AUTHORITY);
  assert.equal(appOwnership?.sdkFamily, APP_SDK_FAMILY);
  assert.equal(
    normalizeRelativePath(appOwnership?.authorityFile),
    `${APP_FAMILY_ROOT}/${manifest.authoritySpec}`,
  );

  const ownedPathPrefixes = appOwnership?.ownedPathPrefixes ?? [];
  const forbiddenPathPrefixes = (domainOwnership.externalAuthorities ?? [])
    .flatMap((dependency) => dependency.forbiddenLocalPathPrefixes ?? []);
  const operations = collectBirdcoderAppOperations(document);
  assert.equal(
    operations.length,
    appOwnership?.operationCount,
    'Canonical App API operation count must match domain ownership.',
  );
  assert.ok(operations.length > 0, 'Canonical App API must contain owned operations.');

  const operationIds = new Set();
  for (const entry of operations) {
    assert.ok(
      pathMatchesPrefix(entry.path, APP_API_PREFIX),
      `App authority contains a non-App path: ${entry.method.toUpperCase()} ${entry.path}`,
    );
    assert.ok(
      ownedPathPrefixes.some((prefix) => pathMatchesPrefix(entry.path, prefix)),
      `App authority contains a path outside BirdCoder ownership: ${entry.method.toUpperCase()} ${entry.path}`,
    );
    assert.equal(
      forbiddenPathPrefixes.some((prefix) => pathMatchesPrefix(entry.path, prefix)),
      false,
      `App authority contains a dependency-owned path: ${entry.method.toUpperCase()} ${entry.path}`,
    );
    assert.equal(entry.operation['x-sdkwork-owner'], SDK_OWNER);
    assert.equal(entry.operation['x-sdkwork-api-authority'], APP_API_AUTHORITY);
    assert.equal(entry.operation['x-sdkwork-request-context'], 'WebRequestContext');
    assert.equal(entry.operation['x-sdkwork-api-surface'], APP_API_SURFACE);
    assert.ok(entry.operation.operationId, `${entry.method.toUpperCase()} ${entry.path} must declare operationId.`);
    assert.equal(
      operationIds.has(entry.operation.operationId),
      false,
      `Duplicate App API operationId: ${entry.operation.operationId}`,
    );
    operationIds.add(entry.operation.operationId);
  }

  return operations.length;
}

export function syncBirdcoderSdkOpenApi({ check = false, rootDir = process.cwd() } = {}) {
  const resolvedRoot = path.resolve(rootDir);
  assertRetiredSurfacesAreAbsent(resolvedRoot);

  const manifest = readJson(resolvedRoot, APP_MANIFEST_PATH);
  const domainOwnership = readJson(resolvedRoot, DOMAIN_OWNERSHIP_PATH);
  assertAppManifest(manifest);
  assertZeroNonAppSurfaces(domainOwnership);

  const authorityPath = `${APP_FAMILY_ROOT}/${manifest.authoritySpec}`;
  const authority = readJson(resolvedRoot, authorityPath);
  const extensionCandidate = structuredClone(authority);
  const extensionChanges = applyWebFrameworkOpenApiExtensions(extensionCandidate, APP_API_SURFACE);
  assert.equal(
    extensionChanges,
    0,
    `${authorityPath} must carry WebRequestContext and app-api extensions before SDK synchronization.`,
  );
  const operationCount = assertCanonicalAppAuthority(authority, manifest, domainOwnership);

  const mismatches = [];
  writeJson(
    resolvedRoot,
    `${APP_FAMILY_ROOT}/${manifest.generationInputSpec}`,
    authority,
    { check, mismatches },
  );
  if (mismatches.length > 0) {
    throw new Error(mismatches.join('\n'));
  }

  return { operationCount };
}

function parseArgs(argv) {
  return { check: argv.includes('--check') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = syncBirdcoderSdkOpenApi(parseArgs(process.argv.slice(2)));
    console.log(`BirdCoder App SDK OpenAPI sync passed (${result.operationCount} operations).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
