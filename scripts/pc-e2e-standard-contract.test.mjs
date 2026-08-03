import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const pcAppRoot = 'apps/sdkwork-birdcoder-pc';

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

const pcPackage = readJson(`${pcAppRoot}/package.json`);
const playwrightConfig = readText(`${pcAppRoot}/playwright.config.ts`);
const playwrightRunner = readText('scripts/run-pc-playwright-e2e.mjs');
const playwrightViteHost = readText('scripts/run-playwright-vite-host.mjs');
const bootSpec = readText(`${pcAppRoot}/tests/e2e/boot-shell.spec.ts`);
const authSpec = readText(`${pcAppRoot}/tests/e2e/auth-surface.spec.ts`);
const guestSpec = readText(`${pcAppRoot}/tests/e2e/guest-home.spec.ts`);
const authenticatedCodeSpec = readText(`${pcAppRoot}/tests/e2e/authenticated-code.spec.ts`);
const codexSessionCancelSpec = readText(
  `${pcAppRoot}/tests/e2e/codex-session-cancel.spec.ts`,
);
const codexSessionInteractionsSpec = readText(
  `${pcAppRoot}/tests/e2e/codex-session-interactions.spec.ts`,
);
const codexSessionParitySpec = readText(
  `${pcAppRoot}/tests/e2e/codex-session-parity.spec.ts`,
);
const productionWebRuntimeSpec = readText(
  `${pcAppRoot}/tests/e2e/production-web-runtime.spec.ts`,
);
const terminalSpec = readText(`${pcAppRoot}/tests/e2e/terminal-browser.spec.ts`);
const webViteConfig = readText(
  `${pcAppRoot}/packages/sdkwork-birdcoder-pc-web/vite.config.ts`,
);
const webMain = readText(`${pcAppRoot}/packages/sdkwork-birdcoder-pc-web/src/main.tsx`);
const appContent = readText(`${pcAppRoot}/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppContent.tsx`);
const testEnv = readText(`${pcAppRoot}/packages/sdkwork-birdcoder-pc-web/.env.test`);
const mockServer = readText('scripts/pc-e2e-mock-api-server.mjs');
const mockFixtures = readText('scripts/pc-e2e-mock-api-fixtures.mjs');
const productionWebRuntimeRunner = readText(
  'scripts/run-pc-production-web-runtime-smoke.mjs',
);
const webBundleBudget = readText('scripts/web-bundle-budget.test.mjs');
const webBundleGraph = readText('scripts/web-bundle-graph.mjs');
const rootPackage = readJson('package.json');
const catalog = readText('pnpm-workspace.yaml');

assert.match(
  catalog,
  /["']@playwright\/test["']:/u,
  'Workspace catalog must govern @playwright/test for PC e2e.',
);

assert.match(
  String(pcPackage.scripts?.['test:e2e'] ?? ''),
  /playwright/u,
  'PC app root must expose test:e2e via Playwright.',
);

assert.equal(
  fs.existsSync(path.join(rootDir, 'scripts/run-pc-playwright-e2e.mjs')),
  true,
  'Repository must provide a root-owned Playwright runner for the PC app.',
);

assert.equal(
  String(rootPackage.scripts?.['test:browser:smoke'] ?? ''),
  'node scripts/run-pc-production-web-runtime-smoke.mjs',
  'Repository root must expose the PC production browser runtime smoke.',
);
assert.equal(
  String(pcPackage.scripts?.['test:browser:smoke'] ?? ''),
  'node ../../scripts/run-pc-production-web-runtime-smoke.mjs',
  'PC app root must expose the production browser runtime smoke.',
);

assert.equal(
  fs.existsSync(path.join(rootDir, 'scripts/pc-e2e-mock-api-fixtures.mjs')),
  true,
  'Repository must provide structured PC e2e mock API fixtures.',
);

assert.match(
  mockServer,
  /pc-e2e-mock-api-fixtures/u,
  'PC e2e mock API server must consume shared fixtures.',
);
assert.match(
  mockServer,
  /auth\/sessions/u,
  'PC e2e mock API server must mock IAM session creation.',
);
assert.match(
  mockServer,
  /function resetMutableFixtureState\(\)[\s\S]*restoreMapFixture\([\s\S]*sessionItemsBySessionId/u,
  'PC e2e mock API server must restore mutable Session Item fixtures between authenticated tests.',
);
assert.match(
  mockServer,
  /pathname === '\/app\/v3\/api\/auth\/sessions'[\s\S]*resetMutableFixtureState\(\)/u,
  'PC e2e IAM session creation must establish an isolated mutable fixture state.',
);
assert.match(
  mockServer,
  /turnFixtureGeneration !== mutableFixtureGeneration/u,
  'PC e2e streamed turn completion must not write stale state after fixture isolation advances.',
);
assert.match(
  mockServer,
  /oauth\/device_authorizations/u,
  'PC e2e mock API server must mock IAM QR device authorization creation and polling.',
);
assert.match(
  mockServer,
  /app_templates/u,
  'PC e2e mock API server must mock the templates catalog.',
);
assert.match(
  mockServer,
  /\/ai\/projects/u,
  'PC e2e mock API server must mock the canonical Agents project catalog.',
);
assert.match(
  mockServer,
  /projectSessionsMatch[\s\S]*workspaceSessionsMatch[\s\S]*agentSessionsMatch/u,
  'PC e2e mock API server must mock the canonical Project, Workspace, and Agent Session catalogs.',
);
assert.match(
  mockServer,
  /runtime_bindings\|turns\|user_state/u,
  'PC e2e mock API server must hydrate runtime identity and per-user Session state.',
);
assert.match(
  mockServer,
  /sessionTurnCancelMatch[\s\S]{0,600}method === 'POST'/u,
  'PC e2e mock API server must expose canonical Session Turn cancellation.',
);
assert.match(
  mockServer,
  /turnDelivery\.turn\.status === 'cancelled'/u,
  'PC e2e streamed completion must not commit after authoritative Turn cancellation.',
);
assert.match(
  mockServer,
  /sessionInteractionsByKey[\s\S]*sessionInteractionClaimsByKey/u,
  'PC e2e mock API server must retain isolated canonical Interaction and claim state.',
);
assert.match(
  mockServer,
  /sessionInteractionResourceMatch[\s\S]{0,500}claim\|approve\|answer/u,
  'PC e2e mock API server must expose claimed approval and question resolution routes.',
);
assert.match(
  mockServer,
  /claim\.claimToken !== String\(body\.claimToken[\s\S]*claim\.fencingToken !== String\(body\.fencingToken/u,
  'PC e2e Interaction resolution must preserve claim, fencing, and version semantics.',
);
assert.match(
  mockServer,
  /const providerSessionIdsBySessionId = new Map\(\[[\s\S]*\['e2e-codex-session', codexProviderSessionId\][\s\S]*\]\);/u,
  'PC e2e provider Session identities must come from an explicit canonical-to-provider mapping.',
);
assert.match(
  mockServer,
  /const codexProviderSessionId = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';/u,
  'PC e2e Codex continuation identity must remain an opaque provider Session identifier.',
);
const providerSessionResolverMatch = /function resolveMockProviderSessionId\(sessionId\) \{([\s\S]*?)\n\}/u
  .exec(mockServer);
assert.ok(
  providerSessionResolverMatch,
  'PC e2e mock API server must expose an opaque provider Session identity resolver.',
);
const providerSessionResolverBody = providerSessionResolverMatch[1];
assert.match(
  providerSessionResolverBody,
  /providerSessionIdsBySessionId\.get\(sessionId\)[\s\S]*nextDynamicProviderSessionSequence[\s\S]*providerSessionIdsBySessionId\.set\(sessionId, providerSessionId\)/u,
  'PC e2e provider Session resolver must reuse its independent mapping and allocate opaque dynamic identities.',
);
assert.match(
  mockServer,
  /providerSessionId:\s*resolveMockProviderSessionId\(session\.sessionId\)/u,
  'PC e2e runtime bindings must resolve provider Session identity through the opaque resolver.',
);
assert.doesNotMatch(
  mockServer,
  /providerSessionId\s*[:=]\s*`[^`]*\$\{[^}]*\b(?:session\.sessionId|sessionId)\b[^}]*\}[^`]*`/u,
  'PC e2e provider Session identity must never interpolate a canonical Session identifier.',
);
assert.doesNotMatch(
  providerSessionResolverBody,
  /\$\{[^}]*\bsessionId\b[^}]*\}/u,
  'PC e2e opaque provider Session resolver must never derive identity by interpolating its canonical Session identifier.',
);
assert.doesNotMatch(
  mockServer,
  /\/app\/v3\/api\/(?:workspaces|projects)(?:\/|['"])/u,
  'PC e2e mock API server must not restore BirdCoder-owned Workspace or Project routes.',
);
assert.doesNotMatch(
  mockServer,
  /runtime_location_preferences|git\/overview/u,
  'PC e2e mock API server must not restore remote runtime-location or Git authority.',
);

assert.match(
  mockFixtures,
  /e2e-password/u,
  'PC e2e fixtures must define the canonical password credential.',
);
assert.match(
  mockFixtures,
  /data:\s*\{\s*items,\s*pageInfo:/u,
  'PC e2e list fixtures must use the SDKWork v3 data.items and data.pageInfo envelope.',
);
assert.match(
  mockFixtures,
  /code:\s*0/u,
  'PC e2e success fixtures must use the numeric SDKWork v3 success code.',
);
assert.match(
  mockFixtures,
  /emailRegistrationVerificationRequired:\s*false/u,
  'PC e2e IAM fixtures must keep email registration verification disabled by default.',
);
assert.match(
  mockFixtures,
  /phoneRegistrationVerificationRequired:\s*false/u,
  'PC e2e IAM fixtures must keep phone registration verification disabled by default.',
);

assert.match(
  playwrightRunner,
  /'--mode'\s*,\s*'test'/u,
  'PC Playwright lifecycle runner must boot Vite in test mode.',
);
assert.match(
  playwrightRunner,
  /PC_E2E_PRODUCTION_PREVIEW === '1'/u,
  'PC Playwright must expose a dedicated production preview mode.',
);
assert.match(
  playwrightRunner,
  /'preview'[\s\S]*'--mode'[\s\S]*'production'[\s\S]*'--environment'[\s\S]*'production'/u,
  'PC production preview must serve the production build instead of the test-mode development host.',
);
assert.match(
  playwrightRunner,
  /executePcPlaywrightE2E[\s\S]*finally[\s\S]*viteHostLifecycle\?\.close\(\)[\s\S]*mockApiLifecycle\?\.close\(\)/u,
  'PC Playwright runner must own and close both Vite and mock API lifecycles.',
);
assert.match(
  playwrightViteHost,
  /vite\.createServer\([\s\S]*server: endpoint/u,
  'PC Playwright Vite host must create the development server in its own process.',
);
assert.match(
  playwrightViteHost,
  /vite\.preview\([\s\S]*preview: endpoint/u,
  'PC Playwright Vite host must create the production preview in its own process.',
);
assert.doesNotMatch(
  playwrightViteHost,
  /node:child_process|\bspawn(?:Sync)?\s*\(/u,
  'PC Playwright Vite host must not create a child process that can outlive Playwright.',
);
assert.match(
  playwrightRunner,
  /VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: plan\.mockApiBaseUrl/u,
  'PC Playwright must expose the canonical Vite application-public URL to production builds.',
);
assert.match(
  playwrightRunner,
  /packages\/sdkwork-birdcoder-pc-web/u,
  'PC Playwright lifecycle runner must target the pc-web host package.',
);
assert.match(
  playwrightRunner,
  /pc-e2e-mock-api-server[\s\S]*startPcE2EMockApiServer/u,
  'PC Playwright lifecycle runner must start the mock API server before the Vite host.',
);
assert.match(
  playwrightRunner,
  /PC_E2E_MOCK_API_PORT \?\? 11_240/u,
  'PC Playwright mock API must use a dedicated port instead of reusing the standalone gateway port.',
);
assert.match(
  playwrightRunner,
  /SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: plan\.mockApiBaseUrl/u,
  'PC Playwright must inject the application-public mock API URL through source-config keys.',
);
assert.match(
  playwrightRunner,
  /SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE: 'standalone'/u,
  'PC Playwright must select the standalone profile for its single mock application ingress.',
);
assert.match(
  playwrightConfig,
  /mergeRepoBootstrapAccessTokenEnv/u,
  'PC Playwright must bootstrap IAM credential entry through the canonical helper.',
);
assert.match(
  playwrightConfig,
  /allowTestTokenGeneration: true/u,
  'PC Playwright may generate a bootstrap Access-Token only for its isolated test runtime.',
);
assert.match(
  playwrightRunner,
  /SDKWORK_ACCESS_TOKEN: e2eBootstrapAccessToken/u,
  'PC Playwright must pass the private bootstrap Access-Token to the Vite host.',
);
assert.doesNotMatch(
  playwrightRunner,
  /SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL: mockApiBaseUrl/u,
  'PC Playwright standalone topology must not inject a second platform API URL.',
);
assert.match(
  playwrightConfig,
  /PLAYWRIGHT_SKIP_WEB_SERVER !== '1'[\s\S]*run-pc-playwright-e2e\.mjs/u,
  'PC Playwright config must reject the Windows webServer taskkill path outside the lifecycle runner.',
);
assert.doesNotMatch(
  playwrightConfig,
  /\bwebServer\s*:/u,
  'PC Playwright config must not delegate managed server cleanup to Playwright on Windows.',
);
assert.match(
  mockServer,
  /PC_E2E_MOCK_API_PORT \?\? 11240/u,
  'PC e2e mock API server must default to the dedicated Playwright port.',
);
assert.match(
  mockServer,
  /```typescript[\s\S]*const productionRuntimeReady: boolean = true;/u,
  'PC e2e fixtures must exercise the lazy syntax-highlighting production chunk.',
);

assert.match(
  productionWebRuntimeRunner,
  /resolveAvailablePort/u,
  'PC production browser smoke must allocate isolated ports for every run.',
);
assert.match(
  productionWebRuntimeRunner,
  /SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: mockApiBaseUrl/u,
  'PC production browser smoke must provide the source-config application URL.',
);
assert.match(
  productionWebRuntimeRunner,
  /VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: mockApiBaseUrl/u,
  'PC production browser smoke must provide the Vite application URL at build time.',
);
assert.match(
  productionWebRuntimeRunner,
  /run-vite-host\.mjs[\s\S]*'build'[\s\S]*'production'/u,
  'PC production browser smoke must build production assets before preview.',
);
assert.match(
  productionWebRuntimeRunner,
  /web-bundle-budget\.test\.mjs/u,
  'PC production browser smoke must verify bundle budgets and the complete static chunk graph.',
);
assert.equal(
  String(rootPackage.scripts?.['check:web-bundle-budget'] ?? ''),
  'node --test scripts/web-bundle-graph.test.mjs && node scripts/web-bundle-budget.test.mjs',
  'The governed web bundle check must verify the graph algorithm before inspecting production assets.',
);
assert.match(
  webBundleBudget,
  /parseStaticChunkDependencies/u,
  'The web bundle budget must parse every production JS asset through the shared graph module.',
);
assert.match(
  webBundleBudget,
  /findStaticImportCycles\(staticImportGraph\)/u,
  'The web bundle budget must run SCC detection over the complete production static import graph.',
);
assert.doesNotMatch(
  webBundleBudget,
  /UniversalChat/u,
  'The web bundle cycle gate must not regress to checking only UniversalChat chunk prefixes.',
);
assert.match(
  webBundleGraph,
  /from 'typescript'/u,
  'The static chunk graph parser must use the declared TypeScript Compiler API instead of regex parsing.',
);
assert.match(
  webBundleGraph,
  /lowLinks[\s\S]*activeNodes[\s\S]*components/u,
  'The static chunk graph must use strongly connected components to detect every cycle.',
);
assert.match(
  webBundleGraph,
  /component\.length > 1[\s\S]*includes\(component\[0\]\)/u,
  'The static chunk graph must reject both multi-chunk cycles and self-import cycles.',
);
assert.match(
  productionWebRuntimeSpec,
  /Claude architecture review/u,
  'PC production browser smoke must open the provider-backed Claude Session.',
);
assert.match(
  productionWebRuntimeSpec,
  /data-chat-mermaid=["']ready["']/u,
  'PC production browser smoke must verify Mermaid rendering from production chunks.',
);
assert.match(
  productionWebRuntimeSpec,
  /productionRuntimeReady/u,
  'PC production browser smoke must verify syntax-highlighted code rendering.',
);
for (const errorCollection of ['pageErrors', 'consoleErrors', 'failedScripts']) {
  assert.match(
    productionWebRuntimeSpec,
    new RegExp(`expect\\(${errorCollection}\\)\\.toEqual\\(\\[\\]\\)`, 'u'),
    `PC production browser smoke must reject non-empty ${errorCollection}.`,
  );
}

assert.match(
  testEnv,
  /VITE_BIRDCODER_API_BASE_URL=http:\/\/127\.0\.0\.1:10240/u,
  'PC web test mode must declare the local mock API base URL.',
);
assert.match(
  testEnv,
  /VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED=true/u,
  'PC web test mode must enable auth development prefill for e2e login.',
);

assert.match(
  bootSpec,
  /getByRole\('heading', \{ name: 'Birdcoder', exact: true \}\)/u,
  'PC boot-shell e2e must assert the accessible product heading.',
);
assert.match(
  bootSpec,
  /getByRole\('progressbar'\).*aria-valuenow/u,
  'PC boot-shell e2e must assert startup progress through the accessible progressbar.',
);
assert.match(
  bootSpec,
  /data-birdcoder-boot-shell/u,
  'PC boot-shell e2e must assert the stable boot-shell marker.',
);

assert.match(
  authSpec,
  /#\/auth\/login/u,
  'PC auth-surface e2e must boot from the canonical auth hash route.',
);
assert.match(
  authSpec,
  /sdkwork-birdcoder-auth-shell/u,
  'PC auth-surface e2e must assert the IAM auth shell marker.',
);
assert.match(
  authSpec,
  /e2e-password/u,
  'PC auth-surface e2e must exercise the mock IAM password credential.',
);
assert.match(
  authSpec,
  /getByRole\('textbox', \{ name: 'Account' \}\)\.fill\('e2e@test\.sdkwork\.local'\)/u,
  'PC auth-surface password e2e must provide the canonical account credential.',
);

assert.match(
  guestSpec,
  /getByRole\('button', \{ name: 'Sign in', exact: true \}\)/u,
  'PC guest-home e2e must use the exact auth action instead of ambiguous copy.',
);

assert.match(
  authenticatedCodeSpec,
  /New Project/u,
  'PC authenticated-code e2e must assert the code workbench project explorer.',
);
assert.match(
  authenticatedCodeSpec,
  /data-agent-session-id=["']e2e-codex-session["']/u,
  'PC authenticated-code e2e must assert a concrete Agent Session row in the project explorer.',
);
assert.match(
  authenticatedCodeSpec,
  /e2e-password/u,
  'PC authenticated-code e2e must exercise the mock IAM password credential.',
);

assert.match(
  codexSessionParitySpec,
  /Codex canonical Session presents history and completes a streamed Turn/u,
  'PC e2e must verify Codex history, streaming, and canonical Session reconciliation.',
);
assert.match(
  codexSessionParitySpec,
  /data-chat-inspected-images=["']true["']/u,
  'PC Codex parity e2e must verify image grouping presentation.',
);
assert.match(
  codexSessionParitySpec,
  /data-chat-lifecycle-event=["']compacted["']/u,
  'PC Codex parity e2e must verify context compaction presentation.',
);
assert.match(
  codexSessionCancelSpec,
  /Stop response[\s\S]*expectedVersion[\s\S]*status:\s*'cancelled'/u,
  'PC Codex cancellation e2e must stop a versioned Turn and verify terminal cancellation.',
);
assert.match(
  codexSessionCancelSpec,
  /waitForTimeout\(mockCompletionDelayMs \+ 500\)[\s\S]*toHaveCount\(0\)/u,
  'PC Codex cancellation e2e must prove delayed completion is not committed.',
);
assert.match(
  codexSessionInteractionsSpec,
  /Codex canonical Session claims and resolves pending interactions/u,
  'PC e2e must verify canonical Codex approval and user-question interactions.',
);
assert.match(
  codexSessionInteractionsSpec,
  /claimOwner:[\s\S]*claimToken:[\s\S]*fencingToken:[\s\S]*expectedVersion:/u,
  'PC Codex Interaction e2e must preserve claim, fencing, and version fields.',
);
assert.match(
  codexSessionInteractionsSpec,
  /selectedOptionValue:\s*'strict'/u,
  'PC Codex question e2e must preserve the selected canonical option value.',
);
assert.doesNotMatch(
  [codexSessionParitySpec, codexSessionCancelSpec, codexSessionInteractionsSpec].join('\n'),
  /\bThread\b|\bthreadId\b/u,
  'PC Codex application e2e must use canonical Session terminology.',
);
assert.match(
  webViteConfig,
  /createBirdcoderCanonicalPlatformDevProxyEntries\(devProxyTargets\.platform\)/u,
  'PC web Vite config must retain the cloud-only platform proxy implementation.',
);
assert.match(
  webViteConfig,
  /createBirdcoderCanonicalEmbeddedAppDevProxyEntries\(devProxyTargets\.application\)/u,
  'PC web test mode must route embedded IAM and Agents paths through the BirdCoder application gateway.',
);
assert.match(
  mockServer,
  /\/app\/v3\/api\/ai\/code_engines[\s\S]*createBirdCoderDataEnvelope\(createCodeEngineCatalogFixture\(\)\)/u,
  'PC mock API must expose the canonical authenticated Agents code-engine catalog envelope.',
);
assert.doesNotMatch(
  webMain,
  /loadWorkbenchCodeEngineCatalog/u,
  'PC runtime bootstrap must not request the authenticated code-engine catalog before IAM authentication completes.',
);
assert.match(
  appContent,
  /if \(isAuthLoading\)[\s\S]*if \(!isAuthenticated\)[\s\S]*resetWorkbenchCodeEngineCatalog\(\)[\s\S]*loadWorkbenchCodeEngineCatalog\(\)/u,
  'PC app content must load the code-engine catalog only after authentication and clear it outside an authenticated session.',
);

assert.match(
  terminalSpec,
  /\/app\/v3\/api\/ai\/projects/u,
  'PC browser terminal e2e must consume the canonical Agents project catalog.',
);
assert.match(
  terminalSpec,
  /legacyProjectRequests[\s\S]*toEqual\(\[\]\)/u,
  'PC browser terminal e2e must prove no retired application-owned project route is called.',
);
assert.match(
  terminalSpec,
  /terminalRequests[\s\S]*toEqual\(\[\]\)/u,
  'PC browser terminal must fail closed before invoking a device terminal without a governed runtime binding.',
);
assert.match(
  terminalSpec,
  /runtimeLocationId:\s*'runtime-location\.e2e-terminal-ready'[\s\S]*terminalCreateBodies/u,
  'PC browser terminal e2e must provide a current Agents Session Runtime Binding and capture the terminal create request.',
);
assert.match(
  terminalSpec,
  /terminalCreateBodies\[0\][\s\S]*projectId:[\s\S]*runtimeLocationId:[\s\S]*command:\s*\['\/bin\/bash', '-l'\]/u,
  'PC browser terminal e2e must prove the governed runtime binding launches the expected remote shell.',
);
assert.match(
  terminalSpec,
  /not\.toHaveProperty\('path'\)[\s\S]*not\.toHaveProperty\('workingDirectory'\)/u,
  'PC browser terminal e2e must prove client filesystem paths never cross the Browser runtime boundary.',
);

console.log('pc e2e standard contract passed.');
