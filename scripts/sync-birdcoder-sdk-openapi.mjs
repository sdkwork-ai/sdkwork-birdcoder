#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const HTTP_METHODS = new Set(['delete', 'get', 'patch', 'post', 'put']);
const rootDir = process.cwd();
const assemblyPath = path.join(rootDir, 'sdks', '.sdkwork-assembly.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
}

function collectSurfacePaths(canonicalDocument, apiPrefix) {
  const paths = {};
  const usedTags = new Set();

  for (const [pathKey, methodMap] of Object.entries(canonicalDocument.paths ?? {})) {
    if (!pathKey.startsWith(apiPrefix)) {
      continue;
    }

    const surfaceMethods = {};
    for (const [methodKey, operation] of Object.entries(methodMap ?? {})) {
      if (!HTTP_METHODS.has(methodKey)) {
        continue;
      }
      surfaceMethods[methodKey] = operation;
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
    components.securitySchemes = canonicalComponents.securitySchemes;
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
  const { paths, usedTags } = collectSurfacePaths(canonicalDocument, surface.apiPrefix);
  assert.ok(
    Object.keys(paths).length > 0,
    `No canonical OpenAPI paths matched ${surface.surface} prefix ${surface.apiPrefix}.`,
  );

  return {
    openapi: canonicalDocument.openapi,
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
  const assembly = readJson(assemblyPath);
  const canonicalOpenApiRelativePath = normalizeRelativePath(
    assembly.sourceOfTruth?.canonicalOpenApi,
  );
  assert.ok(
    canonicalOpenApiRelativePath,
    'SDK assembly sourceOfTruth.canonicalOpenApi must declare the canonical OpenAPI snapshot.',
  );
  const canonicalOpenApiPath = path.join(rootDir, ...canonicalOpenApiRelativePath.split('/'));
  const canonicalDocument = readJson(canonicalOpenApiPath);
  const mismatches = [];

  for (const surface of assembly.surfaces ?? []) {
    const inputSpecPath = normalizeRelativePath(surface.inputSpecPath);
    const outputPath = path.join(rootDir, ...inputSpecPath.split('/'));
    const surfaceDocument = createSurfaceOpenApi(canonicalDocument, surface);
    writeJsonFile(outputPath, surfaceDocument, { check, mismatches });
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

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/gu, '/')}`).href) {
  try {
    syncBirdcoderSdkOpenApi(parseArgs(process.argv.slice(2)));
    console.log('birdcoder SDK OpenAPI sync passed.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
