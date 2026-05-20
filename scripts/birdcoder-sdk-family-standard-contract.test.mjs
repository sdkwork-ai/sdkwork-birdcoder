import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const sdkRootDir = path.join(rootDir, 'sdks');
const standardProfile = 'sdkwork-v3';
const canonicalOpenApiPath = 'server/windows/x64/openapi/coding-server-v1.json';
const domainCatalogPath = 'sdks/specs/domain-catalog.json';

const expectedSurfaces = [
  {
    apiPrefix: '/app/v3/api',
    id: 'birdcoder-app',
    inputSpecPath: 'sdks/specs/openapi/birdcoder-app-v3.openapi.json',
    packageName: '@sdkwork/birdcoder-app-sdk',
    rootDir: 'sdks/sdkwork-birdcoder-app-sdk',
    surface: 'app',
    typescriptOutputPath: 'sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript',
    rustOutputPath: 'sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-rust',
    forbiddenPathFragments: [
      '/app/v3/api/intelligence/',
      '/app/v3/api/platform/',
    ],
  },
  {
    apiPrefix: '/backend/v3/api',
    id: 'birdcoder-backend',
    inputSpecPath: 'sdks/specs/openapi/birdcoder-backend-v3.openapi.json',
    packageName: '@sdkwork/birdcoder-backend-sdk',
    rootDir: 'sdks/sdkwork-birdcoder-backend-sdk',
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
      operations.set(`${tag}.${operationId}`, {
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

function assertCanonicalSpecLinks(entries) {
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
    assertExists(`sdks/specs/${entry.path}`, `canonical spec link ${entry.file}`);
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
    /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*$/u,
    `${context} must declare standard x-sdkwork-resource.`,
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
      'x-sdkwork-permission' in operation,
      false,
      `${context} must not declare a permission when it is public.`,
    );
    return;
  }

  assert.equal(operation['x-sdkwork-public'], false, `${context} must explicitly mark protected operations.`);
  assert.match(
    String(operation['x-sdkwork-permission'] ?? ''),
    /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*\.[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*\.(?:create|read|update|delete|write|execute|subscribe)$/u,
    `${context} must declare standard x-sdkwork-permission.`,
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
    document.components?.securitySchemes?.bearerAuth?.scheme,
    'bearer',
    `${surface.inputSpecPath} must support Authorization: Bearer auth.`,
  );
  assert.equal(
    document.components?.securitySchemes?.sdkworkAccessToken?.name,
    'Sdkwork-Access-Token',
    `${surface.inputSpecPath} must use Sdkwork-Access-Token as canonical access token header.`,
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
      assert.equal(
        String(operation.operationId).startsWith(`${tags[0]}.`),
        false,
        `${methodKey.toUpperCase()} ${pathKey} operationId must not repeat tag ${tags[0]}.`,
      );
      assertOperationMetadata(
        `${tags[0]}.${operation.operationId}`,
        operation,
        `${methodKey.toUpperCase()} ${pathKey}`,
      );
      assertProblemJsonErrorResponses(
        operation.responses,
        `${methodKey.toUpperCase()} ${pathKey}`,
      );
      operationKeys.push(`${tags[0]}.${operation.operationId}`);
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
  }

  if (surface.surface === 'backend') {
    assert.equal(
      operations.some((operation) => operation.tag === 'auth'),
      false,
      'backend SDK OpenAPI must not expose auth/session login endpoints.',
    );
    assert.equal(
      operations.some((operation) => operation.operation.operationId === 'users.list'),
      false,
      'backend SDK OpenAPI must not duplicate appbase-owned IAM user administration.',
    );
  }
}

function assertAssemblyManifest() {
  const assembly = readJson('sdks/.sdkwork-assembly.json');
  assert.equal(assembly.schemaVersion, 1);
  assert.equal(assembly.kind, 'sdkwork.sdk.assembly');
  assert.equal(assembly.name, 'sdkwork-birdcoder-sdk-family');
  assert.equal(assembly.standardProfile, standardProfile);
  assert.equal(assembly.sourceOfTruth?.api, '../../../specs/API_SPEC.md');
  assert.equal(assembly.sourceOfTruth?.sdk, '../../../specs/SDK_SPEC.md');
  assert.equal(assembly.sourceOfTruth?.domain, '../../../specs/DOMAIN_SPEC.md');
  assert.equal(
    assembly.sourceOfTruth?.domainCatalog,
    'specs/domain-catalog.json',
    'SDK assembly must declare the app-local domain catalog used by OpenAPI x-sdkwork-domain validation.',
  );
  assert.equal(
    assembly.sourceOfTruth?.canonicalOpenApi,
    canonicalOpenApiPath,
    'SDK assembly must declare the canonical coding-server OpenAPI snapshot used to derive app/backend SDK inputs.',
  );
  assert.deepEqual(
    assembly.verification?.commands,
    [
      'pnpm check:sdk-family-standard',
      'pnpm generate:sdk:birdcoder',
      'pnpm check:sdk-family-generated',
    ],
  );

  const surfaces = new Map((assembly.surfaces ?? []).map((surface) => [surface.id, surface]));
  assert.equal(surfaces.size, expectedSurfaces.length);

  for (const expected of expectedSurfaces) {
    const surface = surfaces.get(expected.id);
    assert.ok(surface, `assembly surface ${expected.id} must be declared.`);
    assert.equal(surface.surface, expected.surface);
    assert.equal(surface.apiPrefix, expected.apiPrefix);
    assert.equal(surface.inputSpecPath, expected.inputSpecPath);
    assert.equal(surface.packageName, expected.packageName);
    assert.equal(surface.version, '0.1.0');
    assert.equal(surface.standardProfile, standardProfile);

    const outputByLanguage = new Map((surface.outputs ?? []).map((output) => [output.language, output]));
    assert.equal(outputByLanguage.get('typescript')?.path, expected.typescriptOutputPath);
    assert.equal(outputByLanguage.get('typescript')?.packageName, expected.packageName);
    assert.equal(outputByLanguage.get('rust')?.path, expected.rustOutputPath);
    assert.match(outputByLanguage.get('rust')?.crateName ?? '', /^sdkwork_birdcoder_(?:app|backend)_sdk$/u);

    const command = normalizeRelativePath(surface.generator?.command);
    assert.match(command, /generate-birdcoder-sdk-family\.mjs/u);
    assert.ok(command.includes(`--surface ${expected.surface}`));
    assert.ok(command.includes(`--standard-profile ${standardProfile}`));
    assert.ok(command.includes(`--input ${expected.inputSpecPath}`));
    assert.ok(command.includes(`--typescript-output ${expected.typescriptOutputPath}`));
    assert.ok(command.includes(`--rust-output ${expected.rustOutputPath}`));
    assert.equal(surface.generator?.standardProfile, standardProfile);

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
  assert.deepEqual(componentSpec.component?.manifests, ['.sdkwork-assembly.json']);
  assert.deepEqual(componentSpec.component?.domainCatalogs, ['specs/domain-catalog.json']);
  assertCanonicalSpecLinks(componentSpec.canonicalSpecs ?? []);
  assert.equal(
    componentSpec.contracts?.domainCatalog,
    'specs/domain-catalog.json',
    'SDK component spec must declare the local domain catalog required by DOMAIN_SPEC.',
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
    'pnpm generate:sdk:birdcoder',
    'pnpm check:sdk-family-generated',
  ]);
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
  assert.doesNotMatch(
    backendSdkExampleSection,
    /client\.auth\.sessions\.create/u,
    'SDK root README backend examples must not advertise app auth session creation.',
  );
  assert.doesNotMatch(rootReadme, /\/app\/v3\/api\/(?:platform|intelligence)\//u);
  assert.doesNotMatch(rootReadme, /\/backend\/v3\/api\/platform\//u);
  assert.doesNotMatch(rootReadme, /\bidentity\b/iu);
  assert.doesNotMatch(
    rootReadme,
    /client\.iam\.(?:users|roles)\.list/u,
    'SDK root README must not advertise appbase-owned IAM administration as BirdCoder generated SDK surface.',
  );
  assert.match(
    rootReadme,
    /client\.iam\.users\.current\.retrieve\(\)/u,
    'SDK root README must show the app SDK current-user IAM surface instead of IAM user administration.',
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
    assert.doesNotMatch(
      readme,
      /client\.iam\.(?:users|roles)\.list/u,
      `${expected.rootDir}/README.md must not advertise appbase-owned IAM administration as BirdCoder generated SDK surface.`,
    );

    if (expected.surface === 'app') {
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
    assert.match(tsHttpSource, /Sdkwork-Access-Token/u);
    assert.match(tsHttpSource, /Authorization/u);
    assert.match(tsHttpSource, /export interface BirdcoderSdkTransport/u);
    assert.match(tsApiIndexSource, /export \* from/u);
    assert.match(tsTypesIndexSource, /export interface BirdcoderSdkOperationDescriptor/u);
    assert.doesNotMatch(
      tsSource,
      /export interface BirdcoderSdkTransportRequest|function requestOperation/u,
      'generated SDK root index must stay a package barrel instead of a monolithic SDK implementation.',
    );
    assert.doesNotMatch(tsSource, /\/app\/v3\/api\/(?:platform|intelligence)\//u);
    assert.doesNotMatch(tsSource, /\/backend\/v3\/api\/platform\//u);
    assert.doesNotMatch(tsSdkSource, /\/app\/v3\/api\/(?:platform|intelligence)\//u);
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
        /"key": "auth\.sessions\.create"[\s\S]*"domain": "iam"[\s\S]*"public": true[\s\S]*"resource": "iam\.sessions"[\s\S]*"tenantScope": "platform"/u,
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
        /"key": "collaboration\.workspaceTeams\.list"[\s\S]*"domain": "collaboration"[\s\S]*"permission": "collaboration\.workspaceTeams\.read"[\s\S]*"resource": "collaboration\.workspaceTeams"/u,
        'app SDK must expose workspace team catalog reads as a collaboration workspaceTeams resource.',
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
        /"key": "iam\.auditEvents\.list"[\s\S]*"domain": "iam"[\s\S]*"permission": "iam\.auditEvents\.read"[\s\S]*"resource": "iam\.auditEvents"[\s\S]*"tenantScope": "tenant"/u,
        'backend SDK generated descriptors must preserve canonical audit permission metadata.',
      );
      assert.doesNotMatch(
        tsTypesIndexSource,
        /"key": "iam\.users\.list"|export interface IamUsersListQuery/u,
        'backend SDK must not regenerate appbase-owned IAM user operations.',
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
    assert.doesNotMatch(rustSource, /\/app\/v3\/api\/(?:platform|intelligence)\//u);
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

assert.ok(fs.existsSync(sdkRootDir), 'sdks directory must exist.');
assertNoLegacySdkDirectories();
assertDomainCatalogCoversOpenApiOperations(expectedSurfaces);
assertAssemblyManifest();
assertComponentSpec();
assertReadmesAndGeneratedOutputs();

console.log('birdcoder SDK family standard contract passed.');
