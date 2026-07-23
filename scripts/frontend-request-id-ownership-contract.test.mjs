import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

const scanRoots = [
  'src',
  'packages',
  'sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript/src',
  'sdks/sdkwork-birdcoder-app-sdk/openapi',
];

const scannableExtensions = new Set([
  '.json',
  '.js',
  '.mjs',
  '.ts',
  '.tsx',
]);

const excludedDirectoryNames = new Set([
  '.git',
  'artifacts',
  'coverage',
  'dist',
  'external',
  'node_modules',
  'target',
]);

const excludedPathPatterns = [
  /^packages\/sdkwork-birdcoder-pc-server\//u,
  /^sdks\/sdkwork-birdcoder-(?:app|backend)-sdk\/sdkwork-birdcoder-(?:app|backend)-sdk-typescript\/src\/types\//u,
];

const forbiddenFrontendRequestIdentityPatterns = [
  {
    pattern: /\bxRequestId\b/u,
    message: 'frontend consumers must not pass generated SDK xRequestId parameters',
  },
  {
    pattern: /\bX-Request-Id\b|\bX-Request-ID\b/u,
    message: 'frontend consumers must not set X-Request-Id headers',
  },
  {
    pattern: /\bcreateRequestId\b/u,
    message: 'frontend consumers must not expose createRequestId helpers',
  },
  {
    pattern: /\bcreateBirdCoderApiRequestId\b|apiRequestId\.ts/u,
    message: 'requestId generators must be server-owned, not shared frontend API helpers',
  },
  {
    pattern: /\bcrypto\.randomUUID\s*\(/u,
    message: 'application source must not call crypto.randomUUID() directly in frontend-owned code',
  },
];

const allowedLocalServerRequestIdFiles = new Set([
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/localServerRequestId.ts',
]);

function normalizeRelativePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function shouldExclude(relativePath) {
  return excludedPathPatterns.some((pattern) => pattern.test(relativePath));
}

function collectFiles(entryPath, files) {
  if (!fs.existsSync(entryPath)) {
    return;
  }

  const stat = fs.statSync(entryPath);
  if (stat.isDirectory()) {
    if (excludedDirectoryNames.has(path.basename(entryPath))) {
      return;
    }

    for (const entry of fs.readdirSync(entryPath, { withFileTypes: true })) {
      collectFiles(path.join(entryPath, entry.name), files);
    }
    return;
  }

  const relativePath = normalizeRelativePath(path.relative(rootDir, entryPath));
  if (!scannableExtensions.has(path.extname(entryPath)) || shouldExclude(relativePath)) {
    return;
  }

  files.push(entryPath);
}

function resolveOpenApiRef(document, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) {
    return undefined;
  }

  return ref
    .slice(2)
    .split('/')
    .reduce((current, segment) => {
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      const key = segment.replace(/~1/gu, '/').replace(/~0/gu, '~');
      return current[key];
    }, document);
}

function schemaContainsRequestId(document, schema, seenRefs = new Set()) {
  if (!schema || typeof schema !== 'object') {
    return false;
  }

  if (typeof schema.$ref === 'string') {
    if (seenRefs.has(schema.$ref)) {
      return false;
    }
    seenRefs.add(schema.$ref);
    return schemaContainsRequestId(document, resolveOpenApiRef(document, schema.$ref), seenRefs);
  }

  if (schema.properties?.requestId || schema.required?.includes?.('requestId')) {
    return true;
  }

  for (const key of ['allOf', 'anyOf', 'oneOf']) {
    if (
      Array.isArray(schema[key]) &&
      schema[key].some((item) => schemaContainsRequestId(document, item, seenRefs))
    ) {
      return true;
    }
  }

  return schemaContainsRequestId(document, schema.items, seenRefs);
}

function collectOpenApiRequestBodyViolations(relativePath, source) {
  const document = JSON.parse(source);
  const violations = [];

  for (const [routePath, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!operation || typeof operation !== 'object') {
        continue;
      }

      const requestBodyContent = operation.requestBody?.content ?? {};
      for (const [mediaType, media] of Object.entries(requestBodyContent)) {
        if (schemaContainsRequestId(document, media?.schema)) {
          violations.push(
            `${relativePath}: ${method.toUpperCase()} ${routePath} (${operation.operationId ?? 'unknown operationId'}) ${mediaType}`,
          );
        }
      }
    }
  }

  return violations;
}

const files = [];
for (const scanRoot of scanRoots) {
  collectFiles(path.join(rootDir, scanRoot), files);
}
files.sort();

const sourceViolations = [];
const openApiRequestBodyViolations = [];

for (const filePath of files) {
  const relativePath = normalizeRelativePath(path.relative(rootDir, filePath));
  const source = fs.readFileSync(filePath, 'utf8');

  if (relativePath.startsWith('sdks/sdkwork-birdcoder-app-sdk/openapi/') && relativePath.endsWith('.json')) {
    openApiRequestBodyViolations.push(
      ...collectOpenApiRequestBodyViolations(relativePath, source),
    );
  }

  for (const rule of forbiddenFrontendRequestIdentityPatterns) {
    if (
      rule.pattern.test(source) &&
      !(rule.pattern.source.includes('createBirdCoderApiRequestId') &&
        allowedLocalServerRequestIdFiles.has(relativePath))
    ) {
      sourceViolations.push(`${relativePath}: ${rule.message}`);
    }
  }
}

assert.deepEqual(
  sourceViolations,
  [],
  [
    'Frontend request identity ownership contract failed.',
    'Browser/front-end callers must omit requestId/xRequestId/X-Request-Id and must not own requestId generation.',
    ...sourceViolations,
  ].join('\n'),
);

assert.deepEqual(
  openApiRequestBodyViolations,
  [],
  [
    'OpenAPI request body requestId ownership contract failed.',
    'Request body schemas must not require client-filled requestId values for SDKWork request correlation.',
    ...openApiRequestBodyViolations,
  ].join('\n'),
);

console.log('frontend request id ownership contract passed.');
