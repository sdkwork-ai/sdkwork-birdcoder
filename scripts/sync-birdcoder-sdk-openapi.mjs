#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { applyWebFrameworkOpenApiExtensions } from './web-framework-openapi-extensions.mjs';

const HTTP_METHODS = new Set(['delete', 'get', 'patch', 'post', 'put']);
const rootDir = process.cwd();
const sdkWorkspaceComponentPath = path.join(rootDir, 'sdks', 'specs', 'component.spec.json');
const SDK_OWNER = 'sdkwork-birdcoder';
const AUTH_TOKEN_SCHEME = 'AuthToken';
const ACCESS_TOKEN_SCHEME = 'AccessToken';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function mirrorAppSdkOpenApiIfNeeded(relativePath, content) {
  const mirrorByRootPath = new Map(
    [
      ['sdks/specs/openapi/birdcoder-app-v3.openapi.json', 'apps/sdkwork-birdcoder-pc/sdks/specs/openapi/birdcoder-app-v3.openapi.json'],
      ['sdks/specs/openapi/birdcoder-backend-v3.openapi.json', 'apps/sdkwork-birdcoder-pc/sdks/specs/openapi/birdcoder-backend-v3.openapi.json'],
      [
        'sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json',
        'apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json',
      ],
      [
        'sdks/sdkwork-birdcoder-backend-sdk/openapi/sdkwork-birdcoder-backend-api.openapi.json',
        'apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-backend-sdk/openapi/sdkwork-birdcoder-backend-api.openapi.json',
      ],
    ].map(([rootPath, mirrorPath]) => [normalizeRelativePath(rootPath), normalizeRelativePath(mirrorPath)]),
  );
  const mirrorRelativePath = mirrorByRootPath.get(normalizeRelativePath(relativePath));
  if (!mirrorRelativePath) {
    return;
  }
  const mirrorPath = path.join(rootDir, ...mirrorRelativePath.split('/'));
  fs.mkdirSync(path.dirname(mirrorPath), { recursive: true });
  fs.writeFileSync(mirrorPath, content, 'utf8');
}

function normalizeRelativePath(value) {
  return String(value ?? '').replace(/\\/gu, '/');
}

function writeJsonFile(filePath, value, { check, mismatches }) {
  const nextContent = `${JSON.stringify(value, null, 2)}\n`;
  if (check) {
    if (!fs.existsSync(filePath)) {
      mismatches.push(`Missing SDK OpenAPI file: ${path.relative(rootDir, filePath)}`);
      return;
    }

    const currentContent = fs.readFileSync(filePath, 'utf8');
    if (currentContent !== nextContent) {
      mismatches.push(`Out-of-date SDK OpenAPI file: ${path.relative(rootDir, filePath)}`);
    }
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, nextContent, 'utf8');
  mirrorAppSdkOpenApiIfNeeded(path.relative(rootDir, filePath).replace(/\\/gu, '/'), nextContent);
}

function writeJsonFileAndMirrorToPcSdk(relativePath, value, { check, mismatches }) {
  const normalizedRelativePath = normalizeRelativePath(relativePath);
  const outputPath = path.join(rootDir, ...normalizedRelativePath.split('/'));
  writeJsonFile(outputPath, value, { check, mismatches });

  if (!normalizedRelativePath.startsWith('sdks/')) {
    return;
  }

  const pcMirrorPath = path.join(
    rootDir,
    'apps',
    'sdkwork-birdcoder-pc',
    ...normalizedRelativePath.split('/'),
  );
  writeJsonFile(pcMirrorPath, value, { check, mismatches });
}

function normalizeSecurityRequirement(requirement) {
  if (!requirement || typeof requirement !== 'object' || Array.isArray(requirement)) {
    return requirement;
  }

  const normalized = {};
  for (const [schemeName, scopes] of Object.entries(requirement)) {
    if (schemeName === 'bearerAuth' || schemeName === AUTH_TOKEN_SCHEME) {
      normalized[AUTH_TOKEN_SCHEME] = scopes;
      continue;
    }
    if (schemeName === 'sdkworkAccessToken' || schemeName === ACCESS_TOKEN_SCHEME) {
      normalized[ACCESS_TOKEN_SCHEME] = scopes;
      continue;
    }
    normalized[schemeName] = scopes;
  }
  return normalized;
}

function normalizeSecurityRequirements(security) {
  if (!Array.isArray(security)) {
    return security;
  }
  return security.map(normalizeSecurityRequirement);
}

function normalizeOperationSecurity(operation) {
  if (!operation || typeof operation !== 'object' || !Array.isArray(operation.security)) {
    return operation;
  }
  return {
    ...operation,
    security: normalizeSecurityRequirements(operation.security),
  };
}

function normalizeSecuritySchemes(securitySchemes = {}) {
  const normalized = {};
  for (const [schemeName, scheme] of Object.entries(securitySchemes ?? {})) {
    if (
      schemeName === 'bearerAuth'
      || schemeName === AUTH_TOKEN_SCHEME
      || schemeName === 'sdkworkAccessToken'
      || schemeName === ACCESS_TOKEN_SCHEME
    ) {
      continue;
    }
    normalized[schemeName] = scheme;
  }

  normalized[AUTH_TOKEN_SCHEME] = securitySchemes[AUTH_TOKEN_SCHEME] ?? securitySchemes.bearerAuth ?? {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'Bearer token',
  };
  normalized[ACCESS_TOKEN_SCHEME] = securitySchemes[ACCESS_TOKEN_SCHEME] ?? securitySchemes.sdkworkAccessToken ?? {
    type: 'apiKey',
    in: 'header',
    name: 'Access-Token',
  };
  return normalized;
}

function collectSurfacePaths(canonicalDocument, surface) {
  const paths = {};
  const usedTags = new Set();
  const apiPrefix = surface.apiPrefix;
  const apiAuthority = resolveSurfaceApiAuthority(surface);

  for (const [pathKey, methodMap] of Object.entries(canonicalDocument.paths ?? {})) {
    if (!pathKey.startsWith(apiPrefix)) {
      continue;
    }

    const surfaceMethods = {};
    for (const [methodKey, operation] of Object.entries(methodMap ?? {})) {
      if (!HTTP_METHODS.has(methodKey)) {
        continue;
      }
      surfaceMethods[methodKey] = normalizeOperationSecurity({
        ...operation,
        'x-sdkwork-api-authority': apiAuthority,
        'x-sdkwork-owner': SDK_OWNER,
      });
      for (const tag of operation.tags ?? []) {
        usedTags.add(String(tag));
      }
    }

    if (Object.keys(surfaceMethods).length > 0) {
      paths[pathKey] = surfaceMethods;
    }
  }

  return { paths, usedTags };
}

function resolveSurfaceApiAuthority(surface) {
  const declaredAuthority = String(surface.apiAuthority ?? '').trim();
  if (declaredAuthority) {
    return declaredAuthority;
  }
  if (surface.surface === 'app') {
    return 'sdkwork-birdcoder-app-api';
  }
  if (surface.surface === 'backend') {
    return 'sdkwork-birdcoder-backend-api';
  }
  throw new Error(`Unsupported BirdCoder SDK surface: ${surface.surface}`);
}

function resolveSurfaceFamilyRoot(surface) {
  const declaredRoot = normalizeRelativePath(surface.rootDir ?? '');
  if (declaredRoot) {
    return declaredRoot;
  }
  const sdkFamily = normalizeRelativePath(surface.sdkFamily ?? '');
  assert.ok(
    sdkFamily,
    `SDK family ${surface.id ?? surface.surface} must declare sdkFamily for family-root OpenAPI output.`,
  );
  return `sdks/${sdkFamily}`;
}

function resolveSurfaceOpenApiOutputPaths(surface) {
  const authority = resolveSurfaceApiAuthority(surface);
  const familyRoot = resolveSurfaceFamilyRoot(surface);
  return [
    normalizeRelativePath(surface.inputSpecPath),
    `${familyRoot}/openapi/${authority}.openapi.json`,
    `${familyRoot}/openapi/${authority}.sdkgen.json`,
  ];
}

function assertSurfaceSdkFamily(surface) {
  const sdkFamily = String(surface.sdkFamily ?? '').trim();
  assert.ok(
    sdkFamily,
    `SDK family ${surface.id ?? surface.surface} must declare sdkFamily for manifest output.`,
  );
  return sdkFamily;
}

function readJsonFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return readJson(filePath);
}

function resolveTransportPackageName(sdkFamily) {
  return `${sdkFamily}-generated-typescript`;
}

function normalizeTypeScriptLanguageEntry(entry, surface, sdkFamily, version) {
  const { name: _name, ...rest } = entry && typeof entry === 'object' ? entry : {};
  return {
    ...rest,
    language: 'typescript',
    workspace: `${sdkFamily}-typescript`,
    generatedPath: `${sdkFamily}-typescript/generated/server-openapi`,
    generationState: 'materialized',
    version: String(rest.version ?? version),
    consumerPackageName: surface.packageName,
    transportPackageName: resolveTransportPackageName(sdkFamily),
  };
}

function normalizeRustLanguageEntry(entry, sdkFamily, version) {
  const rest = entry && typeof entry === 'object' ? entry : {};
  return {
    ...rest,
    language: 'rust',
    workspace: `${sdkFamily}-rust`,
    name: sdkFamily,
    generatedPath: `${sdkFamily}-rust/generated/server-openapi`,
    generationState: 'materialized',
    version: String(rest.version ?? version),
  };
}

function normalizeFamilyManifestLanguages(currentLanguages, surface, sdkFamily, version) {
  const languages = new Map(
    (Array.isArray(currentLanguages) ? currentLanguages : [])
      .map((entry) => [entry.language, entry]),
  );

  return [
    normalizeTypeScriptLanguageEntry(languages.get('typescript'), surface, sdkFamily, version),
    normalizeRustLanguageEntry(languages.get('rust'), sdkFamily, version),
  ];
}

function createFamilyManifest(surface, currentManifest = {}) {
  const sdkFamily = assertSurfaceSdkFamily(surface);
  const authority = resolveSurfaceApiAuthority(surface);
  const version = String(surface.version ?? '0.1.0');

  return {
    ...currentManifest,
    schemaVersion: 1,
    workspace: sdkFamily,
    sdkFamily,
    sdkName: currentManifest.sdkName ?? sdkFamily,
    packageName: surface.packageName,
    transportPackageName: currentManifest.transportPackageName ?? resolveTransportPackageName(sdkFamily),
    sdkOwner: SDK_OWNER,
    apiAuthority: authority,
    apiVersion: version,
    standardProfile: surface.standardProfile ?? 'sdkwork-v3',
    authoritySpec: `openapi/${authority}.openapi.json`,
    generationInputSpec: `openapi/${authority}.sdkgen.json`,
    derivedSpecs: {
      ...(currentManifest.derivedSpecs ?? {}),
      default: `openapi/${authority}.sdkgen.json`,
    },
    discoverySurface: {
      ...(currentManifest.discoverySurface ?? {}),
      sdkTarget: surface.surface,
      apiPrefix: surface.apiPrefix,
      generatedProtocols: ['http-openapi'],
    },
    sdkDependencies: surface.sdkDependencies ?? [],
    languages: normalizeFamilyManifestLanguages(currentManifest.languages, surface, sdkFamily, version),
  };
}

function syncFamilyManifest(surface, { check, mismatches }) {
  const familyRoot = resolveSurfaceFamilyRoot(surface);
  const manifestPath = path.join(rootDir, ...familyRoot.split('/'), 'sdk-manifest.json');
  writeJsonFileAndMirrorToPcSdk(
    `${familyRoot}/sdk-manifest.json`,
    createFamilyManifest(surface, readJsonFileIfExists(manifestPath)),
    { check, mismatches },
  );
}

function addComponentRef(ref, neededComponents, queue) {
  const match = /^#\/components\/(?<componentType>[A-Za-z0-9_-]+)\/(?<componentName>[A-Za-z0-9_.-]+)$/u.exec(
    String(ref ?? ''),
  );
  if (!match?.groups) {
    return;
  }

  const { componentType, componentName } = match.groups;
  if (!neededComponents.has(componentType)) {
    neededComponents.set(componentType, new Set());
  }

  const componentNames = neededComponents.get(componentType);
  if (componentNames.has(componentName)) {
    return;
  }

  componentNames.add(componentName);
  queue.push({ componentName, componentType });
}

function collectComponentRefs(value, neededComponents, queue) {
  if (!value || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectComponentRefs(item, neededComponents, queue);
    }
    return;
  }

  if (typeof value.$ref === 'string') {
    addComponentRef(value.$ref, neededComponents, queue);
  }

  for (const entry of Object.values(value)) {
    collectComponentRefs(entry, neededComponents, queue);
  }
}

function pruneComponentsForSurface(canonicalComponents, paths) {
  const neededComponents = new Map();
  const queue = [];

  collectComponentRefs(paths, neededComponents, queue);

  for (let index = 0; index < queue.length; index += 1) {
    const { componentName, componentType } = queue[index];
    const component = canonicalComponents?.[componentType]?.[componentName];
    collectComponentRefs(component, neededComponents, queue);
  }

  const components = {};
  if (canonicalComponents?.securitySchemes) {
    components.securitySchemes = normalizeSecuritySchemes(canonicalComponents.securitySchemes);
  }

  for (const [componentType, componentNames] of [...neededComponents.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const canonicalGroup = canonicalComponents?.[componentType];
    if (!canonicalGroup) {
      continue;
    }

    const selectedGroup = {};
    for (const componentName of [...componentNames].sort()) {
      if (canonicalGroup[componentName]) {
        selectedGroup[componentName] = canonicalGroup[componentName];
      }
    }
    if (Object.keys(selectedGroup).length > 0) {
      components[componentType] = selectedGroup;
    }
  }

  return components;
}

function createSurfaceOpenApi(canonicalDocument, surface) {
  const { paths, usedTags } = collectSurfacePaths(canonicalDocument, surface);
  assert.ok(
    Object.keys(paths).length > 0,
    `No canonical OpenAPI paths matched ${surface.surface} prefix ${surface.apiPrefix}.`,
  );

  return {
    openapi: canonicalDocument.openapi,
    'x-sdkwork-api-authority': resolveSurfaceApiAuthority(surface),
    'x-sdkwork-owner': SDK_OWNER,
    info: {
      title: `SDKWork BirdCoder ${surface.surface === 'app' ? 'App' : 'Backend'} API`,
      version: String(surface.version ?? canonicalDocument.info?.version ?? '0.1.0'),
      description:
        surface.surface === 'app'
          ? 'BirdCoder app SDK source of truth generated from the canonical coding-server OpenAPI app surface.'
          : 'BirdCoder backend SDK source of truth generated from the canonical coding-server OpenAPI backend surface.',
    },
    servers: [{ url: surface.apiPrefix }],
    tags: (canonicalDocument.tags ?? []).filter((tag) => usedTags.has(String(tag.name ?? ''))),
    paths,
    components: pruneComponentsForSurface(canonicalDocument.components ?? {}, paths),
  };
}

export function syncBirdcoderSdkOpenApi({ check = false } = {}) {
  const componentSpec = readJson(sdkWorkspaceComponentPath);
  const canonicalOpenApiRelativePath = normalizeRelativePath(
    componentSpec.contracts?.generation?.canonicalOpenApi,
  );
  assert.ok(
    canonicalOpenApiRelativePath,
    'SDK workspace component spec must declare contracts.generation.canonicalOpenApi.',
  );
  const canonicalOpenApiPath = path.join(rootDir, ...canonicalOpenApiRelativePath.split('/'));
  const canonicalDocument = readJson(canonicalOpenApiPath);
  const mismatches = [];

  const surfaces = fs.readdirSync(path.join(rootDir, 'sdks'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rootDir, 'sdks', entry.name, 'sdk-manifest.json'))
    .filter((manifestPath) => fs.existsSync(manifestPath))
    .map(readJson)
    .filter((manifest) => manifest.sdkOwner === SDK_OWNER)
    .map((manifest) => ({
      apiAuthority: manifest.apiAuthority,
      apiPrefix: manifest.discoverySurface?.apiPrefix,
      id: manifest.sdkFamily,
      inputSpecPath: manifest.metadata?.generation?.sourceSpec,
      packageName: manifest.packageName,
      rootDir: `sdks/${manifest.sdkFamily}`,
      sdkDependencies: manifest.sdkDependencies,
      sdkFamily: manifest.sdkFamily,
      standardProfile: manifest.standardProfile,
      surface: manifest.discoverySurface?.sdkTarget,
      version: manifest.apiVersion,
    }));

  for (const surface of surfaces) {
    assert.ok(surface.inputSpecPath, `${surface.sdkFamily} must declare metadata.generation.sourceSpec.`);
    const surfaceDocument = createSurfaceOpenApi(canonicalDocument, surface);
    applyWebFrameworkOpenApiExtensions(
      surfaceDocument,
      surface.surface === 'app' ? 'app-api' : 'backend-api',
    );
    for (const outputSpecPath of resolveSurfaceOpenApiOutputPaths(surface)) {
      const outputPath = path.join(rootDir, ...outputSpecPath.split('/'));
      writeJsonFile(outputPath, surfaceDocument, { check, mismatches });
    }
    syncFamilyManifest(surface, { check, mismatches });
  }

  if (mismatches.length > 0) {
    throw new Error(mismatches.join('\n'));
  }
}

function parseArgs(argv) {
  return {
    check: argv.includes('--check'),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    syncBirdcoderSdkOpenApi(parseArgs(process.argv.slice(2)));
    console.log('birdcoder SDK OpenAPI sync passed.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
