import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const pcRootDir = path.join(rootDir, 'apps', 'sdkwork-birdcoder-pc');
const sdkRootDir = path.join(pcRootDir, 'sdks');
const standardProfile = 'sdkwork-v3';
const expectedSdkOwner = 'sdkwork-birdcoder';
const canonicalOpenApiPath = 'deployments/server-windows/x64/openapi/coding-server-v1.json';
const domainCatalogPath = 'sdks/specs/domain-catalog.json';

const appbaseAppSdkDependency = {
  workspace: 'sdkwork-iam-app-sdk',
  role: 'appbase-app-capability',
  required: true,
  dependencyMode: 'consumer-sdk',
  apiPrefix: '/app/v3/api',
  apiAuthority: 'sdkwork-iam-app-api',
  generatedTransportImportPolicy: 'forbidden',
  packageByLanguage: {
    typescript: '@sdkwork/iam-app-sdk',
    rust: 'sdkwork-iam-app-sdk',
  },
};

const appbaseBackendSdkDependency = {
  workspace: 'sdkwork-iam-backend-sdk',
  role: 'appbase-backend-capability',
  required: true,
  dependencyMode: 'consumer-sdk',
  apiPrefix: '/backend/v3/api',
  apiAuthority: 'sdkwork-iam-backend-api',
  generatedTransportImportPolicy: 'forbidden',
  packageByLanguage: {
    typescript: '@sdkwork/iam-backend-sdk',
    rust: 'sdkwork-iam-backend-sdk',
  },
};

const driveAppSdkDependency = {
  workspace: 'sdkwork-drive-app-sdk',
  role: 'drive-app-capability',
  required: true,
  dependencyMode: 'consumer-sdk',
  apiPrefix: '/app/v3/api',
  apiAuthority: 'sdkwork-drive.app',
  generatedTransportImportPolicy: 'forbidden',
  packageByLanguage: {
    typescript: '@sdkwork/drive-app-sdk',
    rust: 'sdkwork-drive-app-sdk-generated-rust',
  },
};

const messagingAppSdkDependency = {
  workspace: 'sdkwork-messaging-app-sdk',
  role: 'messaging-app-capability',
  required: true,
  dependencyMode: 'consumer-sdk',
  apiPrefix: '/app/v3/api',
  apiAuthority: 'sdkwork-messaging-app-api',
  generatedTransportImportPolicy: 'forbidden',
  packageByLanguage: {
    typescript: '@sdkwork/messaging-app-sdk',
  },
};

const membershipAppSdkDependency = {
  workspace: 'sdkwork-membership-app-sdk',
  role: 'membership-app-capability',
  required: true,
  dependencyMode: 'consumer-sdk',
  apiPrefix: '/app/v3/api/memberships',
  apiAuthority: 'sdkwork-membership-app-api',
  generatedTransportImportPolicy: 'forbidden',
  packageByLanguage: {
    typescript: '@sdkwork/membership-app-sdk',
  },
};

const expectedRootSdkDependencies = [
  appbaseAppSdkDependency,
  appbaseBackendSdkDependency,
  driveAppSdkDependency,
  messagingAppSdkDependency,
  membershipAppSdkDependency,
];
const credentialEntryOperationKeys = new Set([
  'oauth.authorizationUrls.create',
  'oauth.sessions.create',
  'oauth.deviceAuthorizations.create',
  'oauth.deviceAuthorizations.scans.create',
  'oauth.deviceAuthorizations.passwordCompletions.create',
  'oauth.deviceAuthorizations.sessionExchanges.create',
  'auth.passwordResetRequests.create',
  'auth.passwordResets.create',
  'auth.registrations.create',
  'auth.sessions.create',
]);

const expectedSurfaces = [
  {
    apiPrefix: '/app/v3/api',
    apiAuthority: 'sdkwork-birdcoder-app-api',
    authoritySpecPath: 'sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json',
    id: 'birdcoder-app',
    inputSpecPath: 'sdks/specs/openapi/birdcoder-app-v3.openapi.json',
    sdkgenInputPath: 'sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.sdkgen.json',
    sdkgenWrapperPath: 'sdks/sdkwork-birdcoder-app-sdk/bin/generate-sdk.ps1',
    packageName: '@sdkwork/birdcoder-app-sdk',
    rootDir: 'sdks/sdkwork-birdcoder-app-sdk',
    sdkFamily: 'sdkwork-birdcoder-app-sdk',
    sdkDependencies: [
      appbaseAppSdkDependency,
      driveAppSdkDependency,
      messagingAppSdkDependency,
      membershipAppSdkDependency,
    ],
    surface: 'app',
    typescriptOutputPath: 'sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript',
    rustOutputPath: 'sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-rust',
    forbiddenPathFragments: [
      '/app/v3/api/platform/',
    ],
  },
  {
    apiPrefix: '/backend/v3/api',
    apiAuthority: 'sdkwork-birdcoder-backend-api',
    authoritySpecPath: 'sdks/sdkwork-birdcoder-backend-sdk/openapi/sdkwork-birdcoder-backend-api.openapi.json',
    id: 'birdcoder-backend',
    inputSpecPath: 'sdks/specs/openapi/birdcoder-backend-v3.openapi.json',
    sdkgenInputPath: 'sdks/sdkwork-birdcoder-backend-sdk/openapi/sdkwork-birdcoder-backend-api.sdkgen.json',
    sdkgenWrapperPath: 'sdks/sdkwork-birdcoder-backend-sdk/bin/generate-sdk.ps1',
    packageName: '@sdkwork/birdcoder-backend-sdk',
    rootDir: 'sdks/sdkwork-birdcoder-backend-sdk',
    sdkFamily: 'sdkwork-birdcoder-backend-sdk',
    sdkDependencies: [
      appbaseBackendSdkDependency,
    ],
    surface: 'backend',
    typescriptOutputPath: 'sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-typescript',
    rustOutputPath: 'sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-rust',
    forbiddenPathFragments: [
      '/backend/v3/api/platform/',
    ],
  },
];

function normalizeRelativePath(value) {
  return String(value ?? '').replace(/\\/gu, '/');
}

function absolutePath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const baseDir = normalized.startsWith('sdks/') && !normalized.includes('..') ? pcRootDir : rootDir;
  return path.join(baseDir, ...normalized.split('/'));
}

function absoluteRootPath(relativePath) {
  return path.join(rootDir, ...normalizeRelativePath(relativePath).split('/'));
}

function assertExists(relativePath, label = 'required SDK family file') {
  assert.ok(
    fs.existsSync(absolutePath(relativePath)),
    `${label} must exist: ${relativePath}`,
  );
}

function readJson(relativePath) {
  assertExists(relativePath);
  return JSON.parse(fs.readFileSync(absolutePath(relativePath), 'utf8'));
}

function readText(relativePath) {
  assertExists(relativePath);
  return fs.readFileSync(absolutePath(relativePath), 'utf8');
}

const canonicalCodingServerOpenApi = readJson(canonicalOpenApiPath);
const syncBirdCoderSdkOpenApiSource = readText('scripts/sync-birdcoder-sdk-openapi.mjs');
assert.match(
  syncBirdCoderSdkOpenApiSource,
  /import\s+\{\s*pathToFileURL\s*\}\s+from\s+'node:url';/u,
  'SDK OpenAPI synchronization CLI entrypoint must use pathToFileURL so Windows script paths execute reliably.',
);
assert.match(
  syncBirdCoderSdkOpenApiSource,
  /import\.meta\.url\s*===\s*pathToFileURL\(process\.argv\[1\]\)\.href/u,
  'SDK OpenAPI synchronization CLI entrypoint must compare import.meta.url with pathToFileURL(process.argv[1]).href.',
);
assert.doesNotMatch(
  syncBirdCoderSdkOpenApiSource,
  /teamGovernance/u,
  'SDK OpenAPI synchronization must not rewrite teamGovernance aliases; canonical OpenAPI must expose standard resource operationIds directly.',
);

function collectHttpOperations(document, apiPrefix) {
  const operations = new Map();
  const pathKeys = new Set();
  for (const [pathKey, methodMap] of Object.entries(document.paths ?? {})) {
    if (!pathKey.startsWith(apiPrefix)) {
      continue;
    }
    pathKeys.add(pathKey);
    for (const [methodKey, operation] of Object.entries(methodMap ?? {})) {
      if (!['delete', 'get', 'patch', 'post', 'put'].includes(methodKey)) {
        continue;
      }
      const tag = Array.isArray(operation.tags) ? String(operation.tags[0] ?? '') : '';
      const operationId = operation.operationId;
      const operationKey = String(operationId).startsWith(`${tag}.`)
        ? String(operationId)
        : `${tag}.${operationId}`;
      operations.set(operationKey, {
        methodKey,
        operation: {
          ...operation,
          operationId,
        },
        pathKey,
        tag,
      });
    }
  }
  return {
    operations,
    pathKeys: [...pathKeys].sort(),
  };
}

function assertNoLegacySdkDirectories() {
  for (const legacyDir of [
    'sdks/sdkwork-birdcoder-sdk',
    'sdks/sdkwork-birdcoder-sdk-admin',
  ]) {
    assert.equal(
      fs.existsSync(absolutePath(legacyDir)),
      false,
      `${legacyDir} is a pre-standard SDK directory and must be removed instead of kept as compatibility debt.`,
    );
  }
}

function assertCanonicalSpecLinks(entries, baseDir = 'sdks/specs') {
  const specFiles = new Set(entries.map((entry) => entry.file));
  for (const file of [
    'README.md',
    'API_SPEC.md',
    'SDK_SPEC.md',
    'COMPONENT_SPEC.md',
    'DOMAIN_SPEC.md',
    'DOCUMENTATION_SPEC.md',
    'TEST_SPEC.md',
  ]) {
    assert.ok(specFiles.has(file), `SDK family specs must link canonical ${file}.`);
  }

  for (const entry of entries) {
    assertExists(`${baseDir}/${entry.path}`, `canonical spec link ${entry.file}`);
  }
}

function assertSdkDependencies(actual, expected, context) {
  assert.ok(Array.isArray(actual), `${context} sdkDependencies must be an explicit array.`);
  assert.deepEqual(
    actual,
    expected,
    `${context} sdkDependencies must match the declared dependency SDK composition contract.`,
  );

  const workspaces = new Set();
  for (const dependency of actual) {
    assert.match(
      String(dependency.workspace ?? ''),
      /^sdkwork-[a-z0-9-]+-sdk$/u,
      `${context} dependency workspace must name an SDK family.`,
    );
    assert.equal(
      workspaces.has(dependency.workspace),
      false,
      `${context} must not duplicate dependency workspace ${dependency.workspace}.`,
    );
    workspaces.add(dependency.workspace);
    assert.match(String(dependency.role ?? ''), /^[a-z0-9-]+$/u, `${context} dependency role must be kebab-case.`);
    assert.equal(dependency.required, true, `${context} ${dependency.workspace} must be required.`);
    assert.equal(
      dependency.dependencyMode,
      'consumer-sdk',
      `${context} ${dependency.workspace} must be consumed as a dependency SDK.`,
    );
    assert.equal(
      dependency.generatedTransportImportPolicy,
      'forbidden',
      `${context} ${dependency.workspace} must not be imported by generated transport.`,
    );
    assert.ok(
      dependency.packageByLanguage?.typescript,
      `${context} ${dependency.workspace} must declare a TypeScript package.`,
    );
    const expectedDependency = expected.find((entry) => entry.workspace === dependency.workspace);
    if (expectedDependency?.packageByLanguage?.rust) {
      assert.equal(
        dependency.packageByLanguage?.rust,
        expectedDependency.packageByLanguage.rust,
        `${context} ${dependency.workspace} must declare the expected Rust package.`,
      );
    } else {
      assert.equal(
        dependency.packageByLanguage?.rust,
        undefined,
        `${context} ${dependency.workspace} must not invent a Rust package for a TypeScript-only dependency SDK.`,
      );
    }
  }
}

function assertDomainCatalogCoversOpenApiOperations(surfaces) {
  const catalog = readJson(domainCatalogPath);
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.kind, 'sdkwork.domain.catalog');
  assert.equal(catalog.name, 'sdkwork-birdcoder-domain-catalog');
  assert.equal(catalog.sourceOfTruth?.domain, '../../../../specs/DOMAIN_SPEC.md');
  assert.equal(catalog.sourceOfTruth?.api, '../../../../specs/API_SPEC.md');

  const domainsByName = new Map();
  for (const domain of catalog.domains ?? []) {
    assert.match(
      String(domain.domain ?? ''),
      /^[a-z][a-zA-Z0-9]*(?:_[a-z0-9]+)*$/u,
      'domain catalog entries must use canonical domain keys.',
    );
    assert.match(
      String(domain.status ?? ''),
      /^(?:standard|app-local-extension)$/u,
      `${domain.domain} must declare whether it is standard or an app-local extension.`,
    );
    assert.match(
      String(domain.owner ?? ''),
      /^[a-z0-9][a-z0-9-]*$/u,
      `${domain.domain} must declare an owner.`,
    );
    assert.match(
      String(domain.databasePrefix ?? ''),
      /^[a-z][a-z0-9_]*$/u,
      `${domain.domain} must declare a database prefix or explicit mapped prefix.`,
    );
    assert.ok(Array.isArray(domain.apiTags), `${domain.domain} must declare apiTags.`);
    assert.ok(Array.isArray(domain.sdkNamespaces), `${domain.domain} must declare sdkNamespaces.`);
    assert.ok(Array.isArray(domain.capabilities), `${domain.domain} must declare capabilities.`);
    assert.ok(Array.isArray(domain.dependsOn), `${domain.domain} must declare dependsOn.`);
    assert.ok(Array.isArray(domain.extends), `${domain.domain} must declare extends.`);
    assert.match(
      String(domain.javaParity ?? ''),
      /^(?:required|not-applicable)$/u,
      `${domain.domain} must declare Java parity.`,
    );
    assert.match(
      String(domain.rustParity ?? ''),
      /^(?:required|not-applicable)$/u,
      `${domain.domain} must declare Rust parity.`,
    );
    assert.equal(
      domainsByName.has(domain.domain),
      false,
      `domain catalog must not duplicate ${domain.domain}.`,
    );
    domainsByName.set(domain.domain, domain);
  }

  assert.ok(domainsByName.size > 0, 'domain catalog must declare at least one domain.');

  for (const surface of surfaces) {
    const document = readJson(surface.inputSpecPath);
    for (const [pathKey, methodMap] of Object.entries(document.paths ?? {})) {
      for (const [methodKey, operation] of Object.entries(methodMap ?? {})) {
        if (!['delete', 'get', 'patch', 'post', 'put'].includes(methodKey)) {
          continue;
        }

        const domainName = String(operation['x-sdkwork-domain'] ?? '');
        const tag = String(operation.tags?.[0] ?? '');
        const domain = domainsByName.get(domainName);
        assert.ok(
          domain,
          `${surface.inputSpecPath} ${methodKey.toUpperCase()} ${pathKey} uses x-sdkwork-domain ${domainName}, but it is not registered in ${domainCatalogPath}.`,
        );
        assert.ok(
          domain.apiTags.includes(tag),
          `${domainName} domain catalog entry must include OpenAPI tag ${tag} for ${methodKey.toUpperCase()} ${pathKey}.`,
        );
        assert.ok(
          domain.sdkNamespaces.includes(tag),
          `${domainName} domain catalog entry must include SDK namespace ${tag} for ${methodKey.toUpperCase()} ${pathKey}.`,
        );
      }
    }
  }
}

function assertOperationId(operationId, context) {
  assert.match(
    operationId,
    /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/u,
    `${context} operationId must use lowerCamel dotted resource.action syntax.`,
  );
  assert.doesNotMatch(
    operationId,
    /(?:__|_|-|\/|\{|\}|\s|:)/u,
    `${context} operationId must not contain non-standard separators or path syntax.`,
  );
}

function assertOperationMetadata(operationKey, operation, context) {
  assert.match(
    String(operation['x-sdkwork-domain'] ?? ''),
    /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u,
    `${context} must declare standard x-sdkwork-domain.`,
  );
  assert.match(
    String(operation['x-sdkwork-resource'] ?? ''),
    /^birdcoder\.[a-z][a-z0-9_-]*$/u,
    `${context} must declare application-owned birdcoder x-sdkwork-resource.`,
  );
  assert.match(
    String(operation['x-sdkwork-tenant-scope'] ?? ''),
    /^(?:platform|tenant|organization|user|owner)$/u,
    `${context} must declare standard x-sdkwork-tenant-scope.`,
  );
  assert.match(
    String(operation['x-sdkwork-data-scope'] ?? ''),
    /^(?:platform|tenant|organization|user|owner)$/u,
    `${context} must declare standard x-sdkwork-data-scope.`,
  );
  assert.equal(operation['x-sdkwork-deployment'], 'all', `${context} must declare x-sdkwork-deployment.`);

  if (operation['x-sdkwork-public'] === true) {
    assert.equal(operation['x-sdkwork-public'], true, `${context} must declare x-sdkwork-public.`);
    assert.equal(
      operation['x-sdkwork-auth-mode'],
      'anonymous',
      `${context} public SDK operation must materialize x-sdkwork-auth-mode: anonymous.`,
    );
    assert.equal(
      'x-sdkwork-permission' in operation,
      false,
      `${context} must not declare a permission when it is public.`,
    );
    if (credentialEntryOperationKeys.has(operationKey)) {
      assert.equal(
        operation['x-sdkwork-forbid-credential-headers'],
        true,
        `${context} credential-entry SDK operation must materialize x-sdkwork-forbid-credential-headers: true.`,
      );
    }
    return;
  }

  assert.equal(operation['x-sdkwork-public'], false, `${context} must explicitly mark protected operations.`);
  assert.match(
    String(operation['x-sdkwork-auth-mode'] ?? ''),
    /^(?:user|admin)$/u,
    `${context} protected SDK operation must declare user or admin x-sdkwork-auth-mode.`,
  );
  assert.match(
    String(operation['x-sdkwork-permission'] ?? ''),
    /^birdcoder\.[a-z][a-z0-9_-]*\.(?:create|read|update|delete|write|execute|subscribe)$/u,
    `${context} must declare application-owned standard x-sdkwork-permission.`,
  );
  assert.equal(
    String(operation['x-sdkwork-permission']).startsWith(`${operation['x-sdkwork-resource']}.`),
    true,
    `${context} permission must use x-sdkwork-resource as its resource prefix.`,
  );
}

function assertProblemJsonErrorResponses(responses, context) {
  for (const [statusCode, response] of Object.entries(responses ?? {})) {
    if (!/^(?:4|5)\d\d$|^default$/u.test(statusCode)) {
      continue;
    }

    assert.ok(
      response?.content?.['application/problem+json'],
      `${context} ${statusCode} response must use API_SPEC application/problem+json.`,
    );
    assert.equal(
      response?.content?.['application/json'],
      undefined,
      `${context} ${statusCode} response must not expose problem details as application/json.`,
    );
  }
}

function assertOpenApiStandard(surface) {
  const document = readJson(surface.inputSpecPath);
  const expectedSurface = collectHttpOperations(canonicalCodingServerOpenApi, surface.apiPrefix);
  assert.equal(
    document.openapi,
    canonicalCodingServerOpenApi.openapi,
    `${surface.inputSpecPath} must use the same OpenAPI version as coding-server.`,
  );
  assert.equal(document.info?.version, '0.1.0');
  assert.equal(document.servers?.[0]?.url, surface.apiPrefix);
  assert.ok(document.components?.schemas, `${surface.inputSpecPath} must define components.schemas.`);
  assert.equal(
    document.components?.securitySchemes?.AuthToken?.scheme,
    'bearer',
    `${surface.inputSpecPath} must support Authorization: Bearer auth through AuthToken.`,
  );
  assert.equal(
    document.components?.securitySchemes?.AccessToken?.name,
    'Access-Token',
    `${surface.inputSpecPath} must use Access-Token as canonical access token header through AccessToken.`,
  );
  assert.equal(
    document.components?.securitySchemes?.bearerAuth,
    undefined,
    `${surface.inputSpecPath} must not keep legacy bearerAuth security scheme names.`,
  );
  assert.equal(
    document.components?.securitySchemes?.sdkworkAccessToken,
    undefined,
    `${surface.inputSpecPath} must not keep legacy sdkworkAccessToken security scheme names.`,
  );

  const pathKeys = Object.keys(document.paths ?? {}).sort();
  assert.deepEqual(
    pathKeys,
    expectedSurface.pathKeys,
    `${surface.inputSpecPath} must mirror the complete active ${surface.surface} API path set from coding-server OpenAPI.`,
  );

  const operations = [];
  const operationKeys = [];
  for (const [pathKey, methodMap] of Object.entries(document.paths ?? {})) {
    assert.ok(
      pathKey.startsWith(surface.apiPrefix),
      `${surface.inputSpecPath} path ${pathKey} must stay under ${surface.apiPrefix}.`,
    );
    for (const forbiddenFragment of surface.forbiddenPathFragments) {
      assert.equal(
        pathKey.includes(forbiddenFragment),
        false,
        `${surface.inputSpecPath} path ${pathKey} must not keep retired SDK path fragment ${forbiddenFragment}.`,
      );
    }
    assert.doesNotMatch(
      pathKey
        .replace(surface.apiPrefix, '')
        .replace(/\{[A-Za-z][A-Za-z0-9]*\}/gu, ''),
      /[A-Z]|__/u,
      `${surface.inputSpecPath} path ${pathKey} must use lower_snake_case static segments.`,
    );

    for (const [methodKey, operation] of Object.entries(methodMap ?? {})) {
      if (!['delete', 'get', 'patch', 'post', 'put'].includes(methodKey)) {
        continue;
      }

      const tags = Array.isArray(operation.tags) ? operation.tags : [];
      assert.equal(tags.length, 1, `${methodKey.toUpperCase()} ${pathKey} must have one canonical tag.`);
      assert.match(tags[0], /^[a-z][a-zA-Z0-9]*$/u, `${methodKey.toUpperCase()} ${pathKey} tag must be lowerCamel.`);
      assertOperationId(operation.operationId, `${methodKey.toUpperCase()} ${pathKey}`);
      const operationKey = String(operation.operationId).startsWith(`${tags[0]}.`)
        ? String(operation.operationId)
        : `${tags[0]}.${operation.operationId}`;
      assert.doesNotMatch(
        operationKey,
        new RegExp(`^${tags[0]}\\.${tags[0]}\\.`, 'u'),
        `${methodKey.toUpperCase()} ${pathKey} generated SDK operation key must not repeat tag ${tags[0]}.`,
      );
      assertOperationMetadata(
        operationKey,
        operation,
        `${methodKey.toUpperCase()} ${pathKey}`,
      );
      if (Array.isArray(operation.security) && operation.security.length > 0) {
        assert.equal(
          operation.security.some(
            (requirement) => 'AuthToken' in requirement && 'AccessToken' in requirement,
          ),
          true,
          `${methodKey.toUpperCase()} ${pathKey} must require AuthToken and AccessToken or explicitly set security: [].`,
        );
        for (const requirement of operation.security) {
          assert.equal(
            'bearerAuth' in requirement,
            false,
            `${methodKey.toUpperCase()} ${pathKey} must not keep legacy bearerAuth requirements.`,
          );
          assert.equal(
            'sdkworkAccessToken' in requirement,
            false,
            `${methodKey.toUpperCase()} ${pathKey} must not keep legacy sdkworkAccessToken requirements.`,
          );
        }
      }
      assert.equal(
        operation['x-sdkwork-owner'],
        expectedSdkOwner,
        `${methodKey.toUpperCase()} ${pathKey} must declare x-sdkwork-owner ${expectedSdkOwner}.`,
      );
      assert.equal(
        operation['x-sdkwork-api-authority'],
        surface.apiAuthority,
        `${methodKey.toUpperCase()} ${pathKey} must declare x-sdkwork-api-authority ${surface.apiAuthority}.`,
      );
      assertProblemJsonErrorResponses(
        operation.responses,
        `${methodKey.toUpperCase()} ${pathKey}`,
      );
      operationKeys.push(operationKey);
      operations.push({ methodKey, operation, pathKey, tag: tags[0] });
    }
  }

  assert.ok(operations.length > 0, `${surface.inputSpecPath} must define at least one SDK operation.`);
  assert.deepEqual(
    operationKeys.sort(),
    [...expectedSurface.operations.keys()].sort(),
    `${surface.inputSpecPath} must expose every ${surface.surface} operation from coding-server OpenAPI.`,
  );

  if (surface.surface === 'app') {
    assert.ok(
      operations.some((operation) => operation.tag === 'auth' && operation.operation.operationId === 'sessions.create'),
      'app SDK OpenAPI must expose canonical sessions.create.',
    );
    assert.ok(
      operations.some(
        (operation) => operation.tag === 'auth' && operation.operation.operationId === 'sessions.current.retrieve',
      ),
      'app SDK OpenAPI must expose canonical sessions.current.retrieve.',
    );
    assert.equal(
      operations.some(
        (operation) => operation.tag === 'auth' && /^verificationCodes\./u.test(operation.operation.operationId),
      ),
      false,
      'BirdCoder app SDK OpenAPI must not publish messaging-owned verification-code operations.',
    );
  }

  if (surface.surface === 'backend') {
    assert.equal(
      operations.some((operation) => operation.tag === 'auth'),
      false,
      'backend SDK OpenAPI must not expose auth/session login endpoints.',
    );
    for (const requiredBackendIamOperationId of [
      'users.create',
      'users.delete',
      'users.list',
      'users.retrieve',
      'roleBindings.create',
      'roleBindings.delete',
      'users.update',
    ]) {
      assert.equal(
        operations.some((operation) => operation.operation.operationId === requiredBackendIamOperationId),
        true,
        `backend SDK OpenAPI must expose standard IAM operation ${requiredBackendIamOperationId}.`,
      );
    }
  }
}

function assertManifestDiscovery() {
  for (const expected of expectedSurfaces) {
    const manifest = readJson(`${expected.rootDir}/sdk-manifest.json`);
    assert.equal(manifest.sdkFamily, expected.sdkFamily);
    assert.equal(manifest.sdkOwner, expectedSdkOwner);
    assert.equal(manifest.apiAuthority, expected.apiAuthority);
    assert.equal(manifest.discoverySurface?.sdkTarget, expected.surface);
    assert.equal(manifest.discoverySurface?.apiPrefix, expected.apiPrefix);
    assert.equal(manifest.metadata?.generation?.sourceSpec, expected.inputSpecPath);
    assert.equal(manifest.standardProfile, standardProfile);
    assertSdkDependencies(manifest.sdkDependencies, expected.sdkDependencies, `${expected.rootDir}/sdk-manifest.json`);
    assertOpenApiStandard(expected);
  }
}

function assertComponentSpec() {
  const componentSpec = readJson('sdks/specs/component.spec.json');
  assert.equal(componentSpec.schemaVersion, 1);
  assert.equal(componentSpec.kind, 'sdkwork.component.spec');
  assert.equal(componentSpec.component?.name, 'sdkwork-birdcoder-sdk-family');
  assert.equal(componentSpec.component?.type, 'sdk-family');
  assert.equal(componentSpec.component?.root, 'sdkwork-birdcoder/sdks');
  assert.equal(componentSpec.component?.domain, 'platform');
  assert.equal(componentSpec.component?.capability, 'sdk');
  assert.equal(componentSpec.component?.generated, true);
  assert.deepEqual(componentSpec.component?.languages, ['typescript', 'rust']);
  assert.deepEqual(componentSpec.component?.manifests, [
    'sdkwork-birdcoder-app-sdk/sdk-manifest.json',
    'sdkwork-birdcoder-backend-sdk/sdk-manifest.json',
  ]);
  assert.deepEqual(componentSpec.component?.domainCatalogs, ['specs/domain-catalog.json']);
  assertCanonicalSpecLinks(componentSpec.canonicalSpecs ?? []);
  assert.equal(
    componentSpec.contracts?.domainCatalog,
    'specs/domain-catalog.json',
    'SDK component spec must declare the local domain catalog required by DOMAIN_SPEC.',
  );
  assertSdkDependencies(
    componentSpec.contracts?.sdkDependencies,
    expectedRootSdkDependencies,
    'sdks/specs/component.spec.json contracts',
  );
  assert.deepEqual(
    componentSpec.contracts?.sdkClients,
    [
      '@sdkwork/birdcoder-app-sdk#createBirdcoderAppSdkClient',
      '@sdkwork/birdcoder-backend-sdk#createBirdcoderBackendSdkClient',
      'sdkwork_birdcoder_app_sdk',
      'sdkwork_birdcoder_backend_sdk',
    ],
  );
  assert.deepEqual(componentSpec.verification?.commands, [
    'pnpm check:sdk-family-standard',
    'pnpm sdk:generate',
    'pnpm check:sdk-family-generated',
  ]);
}

function assertFamilyRootComponentSpec(expected) {
  const componentSpecPath = `${expected.rootDir}/specs/component.spec.json`;
  const componentSpec = readJson(componentSpecPath);
  assert.equal(componentSpec.schemaVersion, 1);
  assert.equal(componentSpec.kind, 'sdkwork.component.spec');
  assert.equal(componentSpec.component?.name, expected.sdkFamily);
  assert.equal(componentSpec.component?.type, 'sdk-family');
  assert.equal(componentSpec.component?.root, `sdkwork-birdcoder/${expected.rootDir}`);
  assert.equal(componentSpec.component?.domain, 'platform');
  assert.equal(componentSpec.component?.capability, `${expected.surface}-sdk`);
  assert.deepEqual(componentSpec.component?.languages, ['typescript', 'rust']);
  assert.deepEqual(
    componentSpec.component?.manifests,
    ['sdk-manifest.json'],
    `${componentSpecPath} must declare the family SDK manifest.`,
  );
  assertCanonicalSpecLinks(componentSpec.canonicalSpecs ?? [], `${expected.rootDir}/specs`);
  assert.equal(componentSpec.contracts?.apiAuthority?.name, expected.apiAuthority);
  assert.equal(componentSpec.contracts?.apiAuthority?.prefix, expected.apiPrefix);
  assert.equal(componentSpec.contracts?.apiAuthority?.owner, expectedSdkOwner);
  assert.equal(
    componentSpec.contracts?.apiAuthority?.authorityOpenApi,
    `../openapi/${expected.apiAuthority}.openapi.json`,
  );
  assert.equal(
    componentSpec.contracts?.apiAuthority?.derivedOpenApi?.[0],
    `../openapi/${expected.apiAuthority}.sdkgen.json`,
  );
  assertSdkDependencies(
    componentSpec.contracts?.sdkDependencies,
    expected.sdkDependencies,
    `${componentSpecPath} contracts`,
  );
}

function assertFamilyRootManifest(expected) {
  const familyManifestPath = `${expected.rootDir}/sdk-manifest.json`;
  const familyManifest = readJson(familyManifestPath);
  assert.equal(familyManifest.workspace, expected.sdkFamily);
  assert.equal(familyManifest.sdkFamily, expected.sdkFamily);
  assert.equal(familyManifest.sdkOwner, expectedSdkOwner);
  assert.equal(familyManifest.apiAuthority, expected.apiAuthority);
  assert.equal(familyManifest.authoritySpec, `openapi/${expected.apiAuthority}.openapi.json`);
  assert.equal(familyManifest.generationInputSpec, `openapi/${expected.apiAuthority}.sdkgen.json`);
  assert.equal(familyManifest.discoverySurface?.sdkTarget, expected.surface);
  assert.equal(familyManifest.discoverySurface?.apiPrefix, expected.apiPrefix);
  assert.deepEqual(familyManifest.discoverySurface?.generatedProtocols, ['http-openapi']);

  const languages = new Map((familyManifest.languages ?? []).map((language) => [language.language, language]));
  assert.equal(languages.get('typescript')?.workspace, `${expected.sdkFamily}-typescript`);
  assert.equal(languages.get('typescript')?.consumerPackageName, expected.packageName);
  assert.equal(
    languages.get('typescript')?.transportPackageName,
    `${expected.sdkFamily}-generated-typescript`,
  );
  assert.equal(
    languages.get('typescript')?.generatedPath,
    `${expected.sdkFamily}-typescript/generated/server-openapi`,
  );
  assert.equal(
    languages.get('typescript')?.generationState,
    'materialized',
  );
  assert.equal(languages.get('rust')?.workspace, `${expected.sdkFamily}-rust`);
  assert.match(languages.get('rust')?.name ?? '', /^sdkwork-birdcoder-(?:app|backend)-sdk$/u);
  assert.equal(
    languages.get('rust')?.generatedPath,
    `${expected.sdkFamily}-rust/generated/server-openapi`,
  );
  assert.equal(
    languages.get('rust')?.generationState,
    'materialized',
  );
  assertSdkDependencies(
    familyManifest.sdkDependencies,
    expected.sdkDependencies,
    familyManifestPath,
  );
}

function assertFamilyRootOpenApiInputs(expected) {
  const compatibilityInput = readJson(expected.inputSpecPath);
  const authorityInput = readJson(expected.authoritySpecPath);
  const sdkgenInput = readJson(expected.sdkgenInputPath);
  assert.deepEqual(
    authorityInput,
    compatibilityInput,
    `${expected.authoritySpecPath} must mirror the compatibility OpenAPI during migration.`,
  );
  assert.deepEqual(
    sdkgenInput,
    compatibilityInput,
    `${expected.sdkgenInputPath} must mirror the owner-only sdkgen input during migration.`,
  );
}

function resolveTypescriptTransportPackageName(sdkFamily) {
  return `${sdkFamily}-generated-typescript`;
}

function assertGeneratedServerOpenApiOutput(expected) {
  const typescriptTransportPackageName = resolveTypescriptTransportPackageName(expected.sdkFamily);
  for (const language of ['typescript', 'rust']) {
    const generatedRoot = `${expected.rootDir}/${expected.sdkFamily}-${language}/generated/server-openapi`;
    const sdkworkSdk = readJson(`${generatedRoot}/sdkwork-sdk.json`);
    assert.equal(sdkworkSdk.generator, '@sdkwork/sdk-generator');
    assert.equal(sdkworkSdk.name, expected.sdkFamily);
    assert.equal(sdkworkSdk.version, '0.1.0');
    assert.equal(sdkworkSdk.language, language);
    assert.equal(sdkworkSdk.sdkType, expected.surface);
    assert.equal(
      sdkworkSdk.packageName,
      language === 'typescript' ? typescriptTransportPackageName : expected.sdkFamily,
    );
    assert.deepEqual(sdkworkSdk.ownership?.scaffoldRoots, ['custom/']);
    assert.deepEqual(sdkworkSdk.ownership?.stateRoots, ['.sdkwork/']);
    assert.equal(
      'sdkOwner' in sdkworkSdk,
      false,
      `${generatedRoot}/sdkwork-sdk.json must stay generator-owned without SDK ownership overlays.`,
    );
    assert.equal(
      'sdkDependencies' in sdkworkSdk,
      false,
      `${generatedRoot}/sdkwork-sdk.json must not carry dependency SDK metadata.`,
    );
    assertExists(`${generatedRoot}/.sdkwork/sdkwork-generator-manifest.json`);
    assertExists(`${generatedRoot}/.sdkwork/sdkwork-generator-changes.json`);
    assertExists(`${generatedRoot}/.sdkwork/sdkwork-generator-report.json`);
    assertExists(`${generatedRoot}/custom/README.md`);

    if (language === 'typescript') {
      const packageJson = readJson(`${generatedRoot}/package.json`);
      assert.equal(packageJson.name, typescriptTransportPackageName);
      assert.equal(packageJson.version, '0.1.0');
      assert.equal(
        packageJson.sdkwork,
        undefined,
        `${generatedRoot}/package.json must not carry SDK ownership overlay metadata.`,
      );
    } else {
      const cargoToml = readText(`${generatedRoot}/Cargo.toml`);
      assert.match(cargoToml, new RegExp(`name = "${expected.sdkFamily}"`, 'u'));
      assert.match(cargoToml, /version = "0\.1\.0"/u);
    }
  }
}

function assertFamilyRootMetadata() {
  for (const expected of expectedSurfaces) {
    assertFamilyRootManifest(expected);
    assertFamilyRootComponentSpec(expected);
    assertFamilyRootOpenApiInputs(expected);
    assertGeneratedServerOpenApiOutput(expected);
  }
}

function assertReadmesAndGeneratedOutputs() {
  const rootReadme = readText('sdks/README.md');
  const appSdkExampleSection = /App SDK examples:\s*```ts\s*(?<body>[\s\S]*?)```/u.exec(rootReadme)?.groups?.body ?? '';
  const backendSdkExampleSection = /Backend SDK examples:\s*```ts\s*(?<body>[\s\S]*?)```/u.exec(rootReadme)?.groups?.body ?? '';
  assert.match(rootReadme, /@sdkwork\/birdcoder-app-sdk/u);
  assert.match(rootReadme, /@sdkwork\/birdcoder-backend-sdk/u);
  assert.match(rootReadme, /sdkwork-v3/u);
  assert.match(rootReadme, /client\.auth\.sessions\.create/u);
  assert.match(
    rootReadme,
    /Access-Token/u,
    'SDK root README must document the canonical SDKWork v3 Access-Token header.',
  );
  assert.doesNotMatch(
    rootReadme,
    /Sdkwork-Access-Token/u,
    'SDK root README must not document the retired non-standard Sdkwork-Access-Token header.',
  );
  assert.match(
    rootReadme,
    /App SDK examples[\s\S]*client\.collaboration\.workspaceTeams\.list\(params\)/u,
    'SDK root README must separate app SDK examples and show workspace team reads through the collaboration workspaceTeams surface.',
  );
  assert.match(
    rootReadme,
    /Backend SDK examples[\s\S]*client\.iam\.teams\.list\(params\)/u,
    'SDK root README must separate backend SDK examples and show backend IAM team governance only in the backend section.',
  );
  assert.match(
    appSdkExampleSection,
    /client\.collaboration\.workspaceTeams\.list\(params\)/u,
    'SDK root README app examples must show workspace team reads through collaboration.workspaceTeams.',
  );
  assert.doesNotMatch(
    appSdkExampleSection,
    /client\.iam\.teams\.list/u,
    'SDK root README app examples must not advertise backend IAM team governance.',
  );
  assert.match(
    backendSdkExampleSection,
    /client\.iam\.teams\.list\(params\)/u,
    'SDK root README backend examples must show backend IAM team governance.',
  );
  assert.match(
    backendSdkExampleSection,
    /client\.iam\.users\.list\(\)/u,
    'SDK root README backend examples must show standard IAM user administration.',
  );
  assert.match(
    backendSdkExampleSection,
    /client\.iam\.users\.roles\.list\(\{ userId \}\)/u,
    'SDK root README backend examples must show standard IAM user role administration.',
  );
  assert.doesNotMatch(
    backendSdkExampleSection,
    /client\.auth\.sessions\.create/u,
    'SDK root README backend examples must not advertise app auth session creation.',
  );
  assert.doesNotMatch(rootReadme, /\/app\/v3\/api\/platform\//u);
  assert.doesNotMatch(rootReadme, /\/backend\/v3\/api\/platform\//u);
  assert.doesNotMatch(rootReadme, /\bidentity\b/iu);
  assert.match(
    rootReadme,
    /client\.iam\.users\.current\.retrieve\(\)/u,
    'SDK root README must show the app SDK current-user IAM surface instead of IAM user administration.',
  );
  assert.match(
    rootReadme,
    /client\.iam\.users\.list\(\)/u,
    'SDK root README must show the backend SDK standard IAM users surface.',
  );
  assert.match(
    rootReadme,
    /client\.iam\.users\.roles\.list\(\{ userId \}\)/u,
    'SDK root README must show the backend SDK standard IAM user roles surface.',
  );
  assert.match(
    rootReadme,
    /client\.iam\.teams\.list\(params\)/u,
    'SDK root README must show the backend SDK teams surface.',
  );
  assert.match(
    rootReadme,
    /client\.iam\.auditEvents\.list\(\)/u,
    'SDK root README must show the backend SDK audit surface.',
  );

  const specsReadme = readText('sdks/specs/README.md');
  assert.match(specsReadme, /SDK family/u);
  assert.match(specsReadme, /API_SPEC\.md/u);
  assert.match(specsReadme, /SDK_SPEC\.md/u);

  for (const expected of expectedSurfaces) {
    const readme = readText(`${expected.rootDir}/README.md`);
    assert.match(readme, new RegExp(expected.packageName.replace('/', '\\/'), 'u'));
    assert.match(readme, new RegExp(expected.apiPrefix.replaceAll('/', '\\/'), 'u'));
    assert.match(readme, /Do not edit generated output by hand/u);
    if (expected.surface === 'app') {
      assert.doesNotMatch(
        readme,
        /client\.iam\.(?:users|roles)\.list/u,
        'app SDK README must not advertise backend IAM administration.',
      );
      assert.match(
        readme,
        /client\.auth\.sessions\.create\(body\)/u,
        'app SDK README must show auth session creation on the app surface.',
      );
      assert.match(
        readme,
        /client\.auth\.sessions\.current\.retrieve\(\)/u,
        'app SDK README must show current session retrieval on the app surface.',
      );
      assert.match(
        readme,
        /client\.platform\.workspaces\.list\(params\)/u,
        'app SDK README must show app workspace listing.',
      );
    }

    if (expected.surface === 'backend') {
      assert.match(
        readme,
        /client\.iam\.auditEvents\.list\(\)/u,
        'backend SDK README must show IAM audit event listing instead of appbase IAM user administration.',
      );
      assert.match(
        readme,
        /client\.iam\.policies\.list\(\)/u,
        'backend SDK README must show IAM policy governance listing.',
      );
      assert.match(
        readme,
        /client\.iam\.teams\.list\(params\)/u,
        'backend SDK README must show backend teams listing.',
      );
      assert.match(
        readme,
        /client\.iam\.users\.list\(\)/u,
        'backend SDK README must show standard IAM user listing.',
      );
      assert.match(
        readme,
        /client\.iam\.roleBindings\.create\(body\)/u,
        'backend SDK README must show standard IAM role binding governance.',
      );
    }

    const tsPackageJson = readJson(`${expected.typescriptOutputPath}/package.json`);
    assert.equal(tsPackageJson.name, expected.packageName);
    assert.equal(tsPackageJson.version, '0.1.0');
    assert.equal(tsPackageJson.sdkwork?.standardProfile, standardProfile);
    assert.equal(tsPackageJson.sdkwork?.apiPrefix, expected.apiPrefix);

    const tsSource = readText(`${expected.typescriptOutputPath}/src/index.ts`);
    assert.match(tsSource, /Generated by scripts\/generate-birdcoder-sdk-family\.mjs/u);
    assert.match(tsSource, /export \{ createBirdcoder(?:App|Backend)SdkClient/u);
    assert.match(tsSource, /export \* from '\.\/sdk/u);
    assert.match(tsSource, /export \* from '\.\/api/u);
    assert.match(tsSource, /export \* from '\.\/types/u);
    assert.match(tsSource, /export \* from '\.\/http/u);

    const tsSdkSource = readText(`${expected.typescriptOutputPath}/src/sdk.ts`);
    const tsReadme = readText(`${expected.typescriptOutputPath}/README.md`);
    const tsHttpSource = readText(`${expected.typescriptOutputPath}/src/http/client.ts`);
    const tsApiIndexSource = readText(`${expected.typescriptOutputPath}/src/api/index.ts`);
    const tsPlatformApiSource = fs.existsSync(absolutePath(`${expected.typescriptOutputPath}/src/api/platform.ts`))
      ? readText(`${expected.typescriptOutputPath}/src/api/platform.ts`)
      : '';
    const tsTypesIndexSource = readText(`${expected.typescriptOutputPath}/src/types/index.ts`);
    assert.match(tsSdkSource, /Generated by scripts\/generate-birdcoder-sdk-family\.mjs/u);
    assert.match(tsSdkSource, /createBirdcoder(?:App|Backend)SdkClient/u);
    assert.match(tsSdkSource, /from '\.\/api/u);
    assert.match(tsSdkSource, /from '\.\/http/u);
    assert.match(tsHttpSource, /Access-Token/u);
    assert.doesNotMatch(tsHttpSource, /Sdkwork-Access-Token/u);
    assert.match(tsHttpSource, /Authorization/u);
    assert.match(tsHttpSource, /export interface BirdcoderSdkTransport/u);
    assert.match(tsApiIndexSource, /export \* from/u);
    assert.match(tsTypesIndexSource, /export interface BirdcoderSdkOperationDescriptor/u);
    assert.doesNotMatch(
      tsSource,
      /export interface BirdcoderSdkTransportRequest|function requestOperation/u,
      'generated SDK root index must stay a package barrel instead of a monolithic SDK implementation.',
    );
    assert.doesNotMatch(tsSource, /\/app\/v3\/api\/platform\//u);
    assert.doesNotMatch(tsSource, /\/backend\/v3\/api\/platform\//u);
    assert.doesNotMatch(tsSdkSource, /\/app\/v3\/api\/platform\//u);
    assert.doesNotMatch(tsSdkSource, /\/backend\/v3\/api\/platform\//u);
    assert.doesNotMatch(tsHttpSource, /\bfetch\s*\(/u, 'generated SDK source must not hard-code fetch.');
    assert.doesNotMatch(tsHttpSource, /\baxios\b/u, 'generated SDK source must not depend on axios.');
    assert.match(
      tsTypesIndexSource,
      /domain: string;/u,
      'generated SDK operation descriptors must expose x-sdkwork-domain as domain.',
    );
    assert.match(
      tsTypesIndexSource,
      /permission\?: string;/u,
      'generated SDK operation descriptors must expose x-sdkwork-permission as permission.',
    );
    assert.match(
      tsTypesIndexSource,
      /tenantScope: string;/u,
      'generated SDK operation descriptors must expose x-sdkwork-tenant-scope as tenantScope.',
    );
    assert.match(
      tsTypesIndexSource,
      /deployment: 'all' \| 'local' \| 'private' \| 'saas';/u,
      'generated SDK operation descriptors must expose x-sdkwork-deployment as deployment.',
    );

    if (expected.surface === 'app') {
      assert.doesNotMatch(
        tsTypesIndexSource,
        /BirdCoderAdminAuditEventSummary|BirdCoderAdminPolicySummary/u,
        'app SDK must not include backend-only admin schemas.',
      );
      assert.match(
        tsTypesIndexSource,
        /"key": "auth\.sessions\.create"[\s\S]*"domain": "iam"[\s\S]*"public": true[\s\S]*"resource": "birdcoder\.oauth-sessions"[\s\S]*"tenantScope": "platform"/u,
        'app SDK generated descriptors must preserve public IAM session metadata.',
      );
      assert.match(
        tsTypesIndexSource,
        /export interface PlatformProjectsListQuery extends Record<string, BirdcoderSdkQueryValue> \{[\s\S]*workspaceId\?: string;[\s\S]*\}/u,
        'app SDK must preserve referenced workspace_id query parameters for projects.list.',
      );
      assert.match(
        tsPlatformApiSource,
        /list\(query: PlatformProjectsListQuery = \{\}, options: BirdcoderSdkRequestOptions = \{\}\)/u,
        'app SDK projects.list must expose query parameters from OpenAPI.',
      );
      assert.match(
        tsTypesIndexSource,
        /"key": "collaboration\.workspaceTeams\.list"[\s\S]*"domain": "collaboration"[\s\S]*"permission": "birdcoder\.collaboration-workspace-teams\.read"[\s\S]*"resource": "birdcoder\.collaboration-workspace-teams"/u,
        'app SDK must expose workspace team catalog reads as a BirdCoder-owned collaboration workspaceTeams resource.',
      );
      assert.match(
        tsTypesIndexSource,
        /export interface CollaborationWorkspaceTeamsListQuery extends Record<string, BirdcoderSdkQueryValue> \{[\s\S]*workspaceId\?: string;[\s\S]*\}/u,
        'app SDK workspaceTeams.list must preserve workspace-scoped query parameters.',
      );
      assert.doesNotMatch(
        tsTypesIndexSource,
        /"key": "iam\.teams\.list"|export interface IamTeamsListQuery/u,
        'app SDK must not duplicate backend IAM team governance as an app IAM team resource.',
      );
      assert.match(
        tsReadme,
        /Example TypeScript calls:[\s\S]*client\.collaboration\.workspaceTeams\.list\(params\)/u,
        'generated app SDK TypeScript README must show workspace team reads through collaboration.workspaceTeams.',
      );
      assert.doesNotMatch(
        tsReadme,
        /client\.iam\.teams\.list/u,
        'generated app SDK TypeScript README must not advertise backend IAM team governance.',
      );
    }

    if (expected.surface === 'backend') {
      assert.doesNotMatch(
        tsTypesIndexSource,
        /BirdCoderUserCenterSessionEnvelope|BirdCoderCreateSessionRequest/u,
        'backend SDK must not include app-only auth session schemas.',
      );
      assert.match(
        tsTypesIndexSource,
        /"key": "iam\.auditEvents\.list"[\s\S]*"domain": "iam"[\s\S]*"permission": "birdcoder\.iam-audit-events\.read"[\s\S]*"resource": "birdcoder\.iam-audit-events"[\s\S]*"tenantScope": "tenant"/u,
        'backend SDK generated descriptors must preserve canonical audit permission metadata.',
      );
      assert.match(
        tsTypesIndexSource,
        /"key": "iam\.users\.list"[\s\S]*"domain": "iam"[\s\S]*"permission": "birdcoder\.iam-users\.read"[\s\S]*"resource": "birdcoder\.iam-users"[\s\S]*"tenantScope": "tenant"/u,
        'backend SDK generated descriptors must preserve standard IAM users metadata.',
      );
      assert.match(
        tsTypesIndexSource,
        /export interface BirdCoderCreateIamUserRequest/u,
        'backend SDK must expose the standard IAM user create request schema.',
      );
      assert.match(
        tsTypesIndexSource,
        /export interface BirdCoderIamUserSummaryListEnvelope/u,
        'backend SDK must expose the standard IAM user list response schema.',
      );
      assert.match(
        tsTypesIndexSource,
        /"key": "iam\.roleBindings\.create"[\s\S]*"domain": "iam"[\s\S]*"permission": "birdcoder\.iam-role-bindings\.create"[\s\S]*"resource": "birdcoder\.iam-role-bindings"/u,
        'backend SDK generated descriptors must preserve standard IAM role binding create metadata.',
      );
      assert.match(
        tsTypesIndexSource,
        /export interface BirdCoderIamUserRoleSummaryEnvelope/u,
        'backend SDK must expose the standard IAM role binding create/delete response schema.',
      );
      assert.match(
        tsTypesIndexSource,
        /export interface IamTeamsListQuery extends Record<string, BirdcoderSdkQueryValue> \{[\s\S]*workspaceId\?: string;[\s\S]*\}/u,
        'backend SDK must preserve referenced teams query parameters.',
      );
      assert.doesNotMatch(
        tsTypesIndexSource,
        /teamGovernance/u,
        'backend SDK must not expose a non-resource teamGovernance operation namespace.',
      );
      assert.match(
        tsReadme,
        /Example TypeScript calls:[\s\S]*client\.iam\.teams\.list\(params\)/u,
        'generated backend SDK TypeScript README must show backend IAM team governance.',
      );
      assert.doesNotMatch(
        tsReadme,
        /client\.auth\.sessions\.create/u,
        'generated backend SDK TypeScript README must not advertise app auth session creation.',
      );
    }

    const rustManifest = readText(`${expected.rustOutputPath}/Cargo.toml`);
    const rustReadme = readText(`${expected.rustOutputPath}/README.md`);
    assert.match(rustManifest, /generated-by = "scripts\/generate-birdcoder-sdk-family\.mjs"/u);
    assert.match(rustManifest, /standard-profile = "sdkwork-v3"/u);
    assert.match(
      rustReadme,
      /Example Rust operation descriptors:/u,
      `${expected.rustOutputPath}/README.md must document resource-style operation descriptor paths.`,
    );

    const rustSource = readText(`${expected.rustOutputPath}/src/lib.rs`);
    assert.match(rustSource, /Generated by scripts\/generate-birdcoder-sdk-family\.mjs/u);
    assert.match(rustSource, /SDKWORK_ACCESS_TOKEN_HEADER/u);
    assert.match(rustSource, /AUTHORIZATION_HEADER/u);
    assert.match(rustSource, /pub domain: &'static str,/u);
    assert.match(rustSource, /pub permission: Option<&'static str>,/u);
    assert.match(rustSource, /pub tenant_scope: &'static str,/u);
    assert.match(rustSource, /pub deployment: &'static str,/u);
    assert.doesNotMatch(rustSource, /\/app\/v3\/api\/platform\//u);
    assert.doesNotMatch(rustSource, /\/backend\/v3\/api\/platform\//u);

    if (expected.surface === 'app') {
      assert.match(
        rustReadme,
        /collaboration::workspace_teams::LIST/u,
        'generated app Rust SDK README must show workspace team reads through the collaboration workspaceTeams descriptor.',
      );
      assert.doesNotMatch(
        rustReadme,
        /iam::teams::LIST/u,
        'generated app Rust SDK README must not advertise backend IAM team governance.',
      );
    }

    if (expected.surface === 'backend') {
      assert.match(
        rustReadme,
        /iam::teams::LIST/u,
        'generated backend Rust SDK README must show backend IAM team governance.',
      );
      assert.match(
        rustReadme,
        /iam::teams::members::LIST/u,
        'generated backend Rust SDK README must show backend IAM team member governance.',
      );
      assert.doesNotMatch(
        rustReadme,
        /auth::sessions::CREATE/u,
        'generated backend Rust SDK README must not advertise app auth session creation.',
      );
    }
  }
}

function assertStandardSdkgenWrappers() {
  const packageJson = readJson('package.json');
  assert.match(
    packageJson.scripts?.['sdk:generate:standard'] ?? '',
    /scripts\/generate-birdcoder-sdkgen-family\.mjs/u,
    'package.json must expose a standard sdkgen-based BirdCoder SDK generation command.',
  );

  const standardWrapperSource = readText('scripts/generate-birdcoder-sdkgen-family.mjs');
  assert.match(standardWrapperSource, /@sdkwork\/sdk-generator/u);
  assert.match(standardWrapperSource, /\bsdkgen\b/u);
  assert.match(
    standardWrapperSource,
    /sdk-manifest\.json/u,
    'standard sdkgen wrapper must read family-root sdk-manifest.json as the per-family metadata SSOT.',
  );
  assert.doesNotMatch(
    standardWrapperSource,
    /familyAssembly/u,
    'standard sdkgen wrapper must discover family sdk-manifest.json metadata.',
  );
  assert.match(standardWrapperSource, /sdkwork-sdk-generator[\\/]bin[\\/]sdkgen\.js/u);
  assert.match(standardWrapperSource, /--standard-profile/u);
  assert.match(standardWrapperSource, /--type/u);
  assert.match(standardWrapperSource, /--api-prefix/u);
  assert.match(standardWrapperSource, /--fixed-sdk-version/u);
  assert.match(standardWrapperSource, /sdkwork-v3/u);
  assert.match(standardWrapperSource, /generated\/server-openapi/u);
  assert.doesNotMatch(
    standardWrapperSource,
    /generate-birdcoder-sdk-family\.mjs/u,
    'standard sdkgen wrapper must not call the compatibility product-local generator.',
  );

  for (const expected of expectedSurfaces) {
    const powershellWrapperSource = readText(expected.sdkgenWrapperPath);
    assert.match(powershellWrapperSource, /generate-birdcoder-sdkgen-family\.mjs/u);
    assert.match(powershellWrapperSource, new RegExp(`--surface\\s+${expected.surface}`, 'u'));
    assert.match(powershellWrapperSource, /sdkgen/u);
    assert.match(powershellWrapperSource, /sdkwork-v3/u);
    assert.doesNotMatch(
      powershellWrapperSource,
      /generate-birdcoder-sdk-family\.mjs/u,
      `${expected.sdkgenWrapperPath} must not invoke the compatibility product-local generator.`,
    );
  }
}

assert.ok(fs.existsSync(sdkRootDir), 'sdks directory must exist.');
assertNoLegacySdkDirectories();
assertDomainCatalogCoversOpenApiOperations(expectedSurfaces);
assertManifestDiscovery();
assertComponentSpec();
assertFamilyRootMetadata();
assertReadmesAndGeneratedOutputs();
assertStandardSdkgenWrappers();

console.log('birdcoder SDK family standard contract passed.');
