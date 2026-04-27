import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const ciWorkflow = fs.readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf8');
const userCenterUpstreamSyncWorkflowPath = path.join(rootDir, '.github/workflows/user-center-upstream-sync.yml');
const rootPackageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const qualityFastRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-quality-fast-check.mjs')).href
);
const qualityStandardRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-quality-standard-check.mjs')).href
);
const qualityReleaseRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-quality-release-check.mjs')).href
);

assert.match(ciWorkflow, /concurrency:/);
assert.match(ciWorkflow, /pnpm-lock\.yaml/);
assert.match(ciWorkflow, /SDKWORK_SHARED_SDK_MODE:\s*git/);
assert.match(ciWorkflow, /prepare-shared-sdk-git-sources\.mjs/);
assert.match(ciWorkflow, /pnpm prepare:shared-sdk/);
assert.match(ciWorkflow, /pnpm lint/);
assert.match(ciWorkflow, /pnpm check:desktop/);
assert.match(ciWorkflow, /pnpm check:server/);
assert.match(ciWorkflow, /cargo test --manifest-path packages\/sdkwork-birdcoder-desktop\/src-tauri\/Cargo\.toml/);
assert.match(ciWorkflow, /pnpm server:build/);
assert.match(ciWorkflow, /pnpm docs:build/);
assert.match(ciWorkflow, /libgbm-dev/);
assert.match(ciWorkflow, /libpipewire-0\.3-dev/);
assert.match(ciWorkflow, /desktop-rust-windows:/);
assert.ok(
  fs.existsSync(userCenterUpstreamSyncWorkflowPath),
  'BirdCoder CI governance must keep the dedicated user-center upstream sync workflow in the repository.',
);

assert.equal(rootPackageJson.scripts.typecheck, 'node scripts/run-local-typescript.mjs --noEmit');
assert.equal(rootPackageJson.scripts['check:quality-matrix'], 'node scripts/quality-gate-matrix-contract.test.mjs');
assert.equal(rootPackageJson.scripts['quality:report'], 'node scripts/quality-gate-matrix-report.mjs');
assert.equal(rootPackageJson.scripts['check:quality:fast'], rootPackageJson.scripts.lint);
assert.equal(rootPackageJson.scripts.lint, 'node scripts/run-quality-fast-check.mjs');
assert.equal(rootPackageJson.scripts['check:quality:standard'], 'node scripts/run-quality-standard-check.mjs');
assert.equal(rootPackageJson.scripts['check:quality:release'], 'node scripts/run-quality-release-check.mjs');
assert.equal(
  rootPackageJson.scripts['test:react-syntax-highlighter-types-contract'],
  'node scripts/react-syntax-highlighter-types-contract.test.mjs',
);
assert.equal(
  rootPackageJson.scripts['test:prompt-service-contract'],
  'node scripts/prompt-service-contract.test.mjs',
);
assert.equal(
  rootPackageJson.scripts['test:coding-session-prompt-history-persistence-contract'],
  'node --experimental-strip-types scripts/coding-session-prompt-history-persistence-contract.test.ts',
);
assert.equal(
  rootPackageJson.scripts['test:user-center-standard'],
  'node scripts/run-user-center-standard.mjs',
);
assert.equal(
  rootPackageJson.scripts['check:auth-session-standard'],
  'node scripts/auth-bootstrap-gating-contract.test.mjs && node scripts/auth-required-tab-navigation-contract.test.mjs && node scripts/auth-workspace-loading-gating-contract.test.mjs && node scripts/auth-config-hydration-retry-contract.test.mjs && node scripts/auth-config-null-profile-preserves-adopted-user-contract.test.mjs && node scripts/auth-bootstrap-stale-current-user-guard-contract.test.mjs && node scripts/auth-interactive-refresh-stale-mutation-guard-contract.test.mjs && node --experimental-strip-types scripts/auth-user-identity-contract.test.ts && node scripts/auth-surface-successful-login-adoption-contract.test.mjs && node --experimental-strip-types scripts/runtime-server-session-persistence-contract.test.ts && node --experimental-strip-types scripts/runtime-auth-unbound-profile-preserves-session-contract.test.ts',
  'Root quality scripts must expose non-blocking auth bootstrap, urgent auth-required navigation, authenticated workspace loading gates, metadata-synchronized hydration retry, null-profile preservation, stale bootstrap guards, stale interactive refresh guards, canonical auth user identity matching, successful login adoption, and durable runtime session persistence as one first-class standard.',
);
assert.equal(
  rootPackageJson.scripts['check:terminal-surface-standard'],
  'node scripts/terminal-request-surface-contract.test.mjs && node scripts/app-terminal-request-focus-contract.test.mjs && node scripts/code-topbar-terminal-default-path-contract.test.mjs && node scripts/code-terminal-panel-close-contract.test.mjs',
  'Root quality scripts must expose workspace-vs-embedded terminal routing, forced Terminal focus, topbar default paths, and embedded terminal close behavior as one first-class standard.',
);
assert.equal(
  rootPackageJson.scripts['check:universal-chat-scroll'],
  'node --experimental-strip-types scripts/universal-chat-scroll-behavior-contract.test.ts && node --experimental-strip-types scripts/universal-chat-scroll-ownership-contract.test.ts && node scripts/universal-chat-scroll-ownership-source-contract.test.mjs && node scripts/universal-chat-scroll-performance-contract.test.mjs && node scripts/universal-chat-transcript-performance-contract.test.mjs && node scripts/transcript-scroll-gating-performance-contract.test.mjs && node scripts/transcript-top-load-contract.test.mjs && node --experimental-strip-types scripts/transcript-pagination-contract.test.ts',
  'Root quality scripts must expose chat transcript scroll ownership, mount stability, and overflow gating as one first-class standard.',
);
assert.equal(
  rootPackageJson.scripts['check:workbench-activity-performance'],
  'node scripts/hidden-workbench-activity-gating-contract.test.mjs && node scripts/hidden-workbench-sidebar-refresh-performance-contract.test.mjs && node scripts/app-main-body-tab-switch-performance-contract.test.mjs && node scripts/app-shell-startup-lazy-load-contract.test.mjs',
  'Root quality scripts must expose persistent workbench activity gating, sidebar refresh gating, tab switch, and startup lazy-load behavior as one first-class performance standard.',
);
assert.equal(
  rootPackageJson.scripts['check:universal-chat-rendering-performance'],
  'node scripts/universal-chat-inactive-gating-performance-contract.test.mjs && node scripts/universal-chat-row-animation-performance-contract.test.mjs && node scripts/transcript-inactive-measurement-gating-contract.test.mjs',
  'Root quality scripts must expose UniversalChat inactive gating and no per-row animation churn as one first-class rendering standard.',
);
assert.equal(
  rootPackageJson.scripts['check:project-explorer-hover-stability'],
  'node scripts/project-explorer-scrollbar-contract.test.mjs && node scripts/sidebar-row-animation-performance-contract.test.mjs',
  'Root quality scripts must guard project/sidebar row hover geometry and per-row animation stability as one first-class standard.',
);
assert.equal(
  rootPackageJson.scripts['check:code-page-componentization'],
  'node scripts/code-page-componentization-contract.test.mjs && node scripts/code-tab-switch-performance-contract.test.mjs && node scripts/code-main-chat-width-stability-contract.test.mjs',
  'Root quality scripts must keep Code view composition, tab switching, and main chat width stability covered by one first-class standard.',
);
assert.equal(
  rootPackageJson.scripts['check:code-active-surface-performance'],
  'node scripts/code-active-surface-memo-contract.test.mjs && node scripts/code-sidebar-callback-stability-contract.test.mjs',
  'Root quality scripts must expose Code active-surface memoization and sidebar callback identity stability as one first-class performance standard.',
);
assert.equal(
  rootPackageJson.scripts['check:file-explorer-rendering-performance'],
  'node scripts/file-explorer-inactive-gating-performance-contract.test.mjs && node scripts/file-explorer-node-render-performance-contract.test.mjs',
  'Root quality scripts must expose FileExplorer inactive gating and no per-node animation churn as one first-class rendering standard.',
);
assert.equal(
  rootPackageJson.scripts['check:workbench-session-standard'],
  'node scripts/code-new-session-transcript-reset-contract.test.mjs && node scripts/coding-session-creation-standardization-contract.test.mjs && node scripts/workbench-coding-session-creation-actions-contract.test.mjs && node scripts/selected-session-hydration-loading-contract.test.mjs && node scripts/app-session-inventory-refresh-contract.test.mjs && node --experimental-strip-types scripts/project-mirror-snapshot-authoritative-sessions-contract.test.ts && node --experimental-strip-types scripts/selected-session-stale-project-refresh-contract.test.ts && node --experimental-strip-types scripts/selected-session-user-scope-refresh-contract.test.ts && node --experimental-strip-types scripts/workbench-recovery-user-scope-contract.test.ts',
);
assert.equal(
  rootPackageJson.scripts['check:project-inventory-standard'],
  'node scripts/project-inventory-mirror-snapshot-contract.test.mjs && node --experimental-strip-types scripts/project-mirror-snapshot-syncs-authority-project-contract.test.ts && node --experimental-strip-types scripts/session-inventory-native-session-id-contract.test.ts && node scripts/projects-inventory-lazy-transcript-contract.test.mjs && node scripts/projects-store-message-reuse-contract.test.mjs && node scripts/projects-store-nonblocking-contract.test.mjs && node scripts/project-refresh-cache-bypass-contract.test.mjs && node scripts/api-backed-project-service-parallel-mirror-contract.test.mjs && node --experimental-strip-types scripts/api-backed-project-service-user-scope-fallback-contract.test.ts && node --experimental-strip-types scripts/api-backed-workspace-service-user-scope-fallback-contract.test.ts',
  'Root quality scripts must expose project inventory mirror, authority project mirror sync, native session id inventory, lazy transcript, nonblocking store, refresh cache bypass, parallel mirror behavior, and user-scoped local project/workspace fallback as one first-class project loading standard.',
);
assert.equal(
  rootPackageJson.scripts['check:project-session-index-performance'],
  'node scripts/project-session-index-performance-contract.test.mjs && node --experimental-strip-types scripts/project-session-index-cache-performance-contract.test.ts && node --experimental-strip-types scripts/project-session-location-cache-performance-contract.test.ts && node --experimental-strip-types scripts/project-session-navigation-cache-performance-contract.test.ts && node --experimental-strip-types scripts/coding-session-authoritative-summary-cache-contract.test.ts',
  'Root quality scripts must expose project/session index, location lookup, navigation lookup, and authoritative summary cache behavior as one first-class session loading performance standard.',
);
assert.equal(
  rootPackageJson.scripts['check:code-session-standard'],
  'node scripts/code-session-executing-ui-contract.test.mjs && node scripts/code-session-refresh-ui-contract.test.mjs && node scripts/selected-session-executing-refresh-performance-contract.test.mjs && node scripts/new-session-engine-management-contract.test.mjs && node scripts/code-session-sync-loop-contract.test.mjs && node scripts/selected-session-reselection-contract.test.mjs && node scripts/selected-session-stale-hydration-write-contract.test.mjs && node --experimental-strip-types scripts/coding-session-message-synchronization-contract.test.ts',
  'Root quality scripts must expose code/session executing UI, refresh UI, refresh performance, new-session engine management, and synchronization behavior as a first-class standard.',
);
assert.equal(
  rootPackageJson.scripts['check:api-transport-standard'],
  'node --experimental-strip-types scripts/http-api-transport-cors-contract.test.ts',
  'Root quality scripts must expose API transport/CORS behavior as a first-class standard.',
);
assert.match(
  rootPackageJson.scripts['check:data-kernel'] ?? '',
  /provider-dialect-contract\.test\.mjs/,
  'Root quality scripts must expose provider dialect and data-kernel storage contracts as a first-class standard.',
);
assert.match(
  rootPackageJson.scripts['check:data-kernel'] ?? '',
  /console-default-bootstrap-contract\.test\.ts/,
  'Root quality scripts must expose default console workspace bootstrap as part of the data-kernel standard.',
);

for (const governedWorkflowContract of [
  'scripts/user-center-upstream-sync-payload.test.mjs',
  'scripts/user-center-upstream-sync-workflow.test.mjs',
]) {
  const result = spawnSync(process.execPath, [governedWorkflowContract], {
    cwd: rootDir,
    shell: false,
    stdio: 'inherit',
    windowsHide: process.platform === 'win32',
  });

  assert.equal(
    result.status,
    0,
    `BirdCoder CI flow must pass the governed ${governedWorkflowContract} contract.`,
  );
}
assert.deepEqual(qualityFastRunnerModule.QUALITY_FAST_CHECK_COMMANDS, [
  'node scripts/run-workspace-package-script.mjs . typecheck',
  'node scripts/run-workspace-package-script.mjs . check:workspace-package-script-runner',
  'node scripts/run-workspace-package-script.mjs . check:source-parse',
  'node scripts/run-workspace-package-script.mjs . check:vite-config-esm',
  'node scripts/run-workspace-package-script.mjs . check:vite-build-entry',
  'node scripts/run-workspace-package-script.mjs . check:web-vite-build',
  'node scripts/run-workspace-package-script.mjs . check:vite-windows-realpath',
  'node scripts/run-workspace-package-script.mjs . check:vite-host-preflight',
  'node scripts/run-workspace-package-script.mjs . check:i18n',
  'node scripts/run-workspace-package-script.mjs . check:tauri-rust-toolchain',
  'node scripts/run-workspace-package-script.mjs . check:run-tauri-cli',
  'node scripts/run-workspace-package-script.mjs . check:desktop-tauri-dev',
  'node scripts/run-workspace-package-script.mjs . check:windows-tauri-bundle',
  'node scripts/run-workspace-package-script.mjs . check:tauri-dev-binary-unlock',
  'node scripts/run-workspace-package-script.mjs . check:tauri-target-clean',
  'node scripts/run-workspace-package-script.mjs . check:desktop-vite-host',
  'node scripts/run-workspace-package-script.mjs . check:desktop-standard-vite-server',
  'node scripts/run-workspace-package-script.mjs . check:desktop-react-compat',
  'node scripts/run-workspace-package-script.mjs . check:desktop-startup-graph',
  'node scripts/run-workspace-package-script.mjs . check:ui-dependency-resolution',
  'node scripts/run-workspace-package-script.mjs . check:ui-bundle-segmentation',
  'node scripts/run-workspace-package-script.mjs . check:workbench-activity-performance',
  'node scripts/run-workspace-package-script.mjs . check:universal-chat-scroll',
  'node scripts/run-workspace-package-script.mjs . check:universal-chat-rendering-performance',
  'node scripts/run-workspace-package-script.mjs . test:react-syntax-highlighter-types-contract',
  'node scripts/run-workspace-package-script.mjs . check:runtime-symlink-dependency-resolution',
  'node scripts/run-workspace-package-script.mjs . check:tailwind-source',
  'node scripts/run-workspace-package-script.mjs . check:studio-chat-layout',
  'node scripts/run-workspace-package-script.mjs . check:studio-sidebar-stability',
  'node scripts/run-workspace-package-script.mjs . check:studio-stage-header',
  'node scripts/run-workspace-package-script.mjs . check:project-explorer-hover-stability',
  'node scripts/run-workspace-package-script.mjs . check:project-git-header-controls',
  'node scripts/run-workspace-package-script.mjs . check:code-topbar-git-overview',
  'node scripts/run-workspace-package-script.mjs . check:git-overview-drawer',
  'node scripts/run-workspace-package-script.mjs . check:studio-page-componentization',
  'node scripts/run-workspace-package-script.mjs . check:code-page-componentization',
  'node scripts/run-workspace-package-script.mjs . check:code-active-surface-performance',
  'node scripts/run-workspace-package-script.mjs . check:code-editor-surface-boundary',
  'node scripts/run-workspace-package-script.mjs . check:file-system-boundary',
  'node scripts/run-workspace-package-script.mjs . check:file-explorer-rendering-performance',
  'node scripts/run-workspace-package-script.mjs . check:code-workbench-command-boundary',
  'node scripts/run-workspace-package-script.mjs . check:code-run-entry-boundary',
  'node scripts/run-workspace-package-script.mjs . check:api-transport-standard',
  'node scripts/run-workspace-package-script.mjs . check:auth-session-standard',
  'node scripts/run-workspace-package-script.mjs . check:terminal-surface-standard',
  'node scripts/run-workspace-package-script.mjs . check:workbench-session-standard',
  'node scripts/run-workspace-package-script.mjs . check:project-inventory-standard',
  'node scripts/run-workspace-package-script.mjs . check:project-session-index-performance',
  'node scripts/run-workspace-package-script.mjs . check:code-session-standard',
  'node scripts/run-workspace-package-script.mjs . check:data-kernel',
  'node scripts/run-workspace-package-script.mjs . check:local-store-browser-fallback',
  'node scripts/run-workspace-package-script.mjs . check:package-governance',
  'node scripts/run-workspace-package-script.mjs . check:package-subpath-exports',
  'node scripts/run-workspace-package-script.mjs . test:user-center-standard',
  'node scripts/run-workspace-package-script.mjs . check:governance-baseline',
  'node scripts/run-workspace-package-script.mjs . check:governance-regression-contract',
  'node scripts/run-workspace-package-script.mjs . check:live-docs-governance-baseline',
  'node scripts/run-workspace-package-script.mjs . check:quality-matrix',
  'node scripts/run-workspace-package-script.mjs . check:quality-loop-scoreboard',
  'node scripts/run-workspace-package-script.mjs . test:prompt-service-contract',
  'node scripts/run-workspace-package-script.mjs . test:coding-session-prompt-history-persistence-contract',
  'node scripts/run-workspace-package-script.mjs . test:skill-binding-contract',
  'node scripts/run-workspace-package-script.mjs . test:template-instantiation-contract',
  'node scripts/run-workspace-package-script.mjs . test:prompt-skill-template-runtime-assembly-contract',
  'node scripts/run-workspace-package-script.mjs . test:prompt-skill-template-evidence-repository-contract',
  'node scripts/run-workspace-package-script.mjs . test:prompt-skill-template-evidence-consumer-contract',
  'node scripts/run-workspace-package-script.mjs . test:coding-server-prompt-skill-template-evidence-consumer-contract',
  'node scripts/run-workspace-package-script.mjs . test:postgresql-live-smoke-contract',
  'node scripts/run-workspace-package-script.mjs packages/sdkwork-birdcoder-web lint',
  'node scripts/run-workspace-package-script.mjs . check:arch',
  'node scripts/run-workspace-package-script.mjs . check:sdkwork-birdcoder-structure',
  'node scripts/run-workspace-package-script.mjs . check:release-flow',
  'node scripts/run-workspace-package-script.mjs . check:ci-flow',
]);
assert.deepEqual(qualityStandardRunnerModule.QUALITY_STANDARD_CHECK_COMMANDS, [
  'node scripts/run-workspace-package-script.mjs . check:desktop',
  'node scripts/run-workspace-package-script.mjs . check:server',
  'node scripts/run-workspace-package-script.mjs . check:web-vite-build',
  'node scripts/run-workspace-package-script.mjs . check:web-bundle-budget',
  'node scripts/run-workspace-package-script.mjs . server:build',
  'node scripts/run-workspace-package-script.mjs . docs:build',
]);
assert.deepEqual(qualityReleaseRunnerModule.QUALITY_RELEASE_CHECK_COMMANDS, [
  'node scripts/run-workspace-package-script.mjs . check:quality:fast',
  'node scripts/run-workspace-package-script.mjs . check:quality:standard',
  'node scripts/run-workspace-package-script.mjs . check:quality-matrix',
  'node scripts/run-workspace-package-script.mjs . check:release-flow',
  'node scripts/run-workspace-package-script.mjs . check:ci-flow',
  'node scripts/run-workspace-package-script.mjs . check:governance-regression',
]);

console.log('ci flow contract passed.');
