import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const ciWorkflow = fs.readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf8');
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

assert.equal(rootPackageJson.scripts.typecheck, 'node scripts/run-local-typescript.mjs --noEmit');
assert.equal(rootPackageJson.scripts['check:quality-matrix'], 'node scripts/quality-gate-matrix-contract.test.mjs');
assert.equal(rootPackageJson.scripts['quality:report'], 'node scripts/quality-gate-matrix-report.mjs');
assert.equal(rootPackageJson.scripts['check:quality:fast'], rootPackageJson.scripts.lint);
assert.equal(rootPackageJson.scripts.lint, 'node scripts/run-quality-fast-check.mjs');
assert.equal(rootPackageJson.scripts['check:quality:standard'], 'node scripts/run-quality-standard-check.mjs');
assert.equal(rootPackageJson.scripts['check:quality:release'], 'node scripts/run-quality-release-check.mjs');
assert.deepEqual(qualityFastRunnerModule.QUALITY_FAST_CHECK_COMMANDS, [
  'node scripts/run-workspace-package-script.mjs . typecheck',
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
  'node scripts/run-workspace-package-script.mjs . check:runtime-symlink-dependency-resolution',
  'node scripts/run-workspace-package-script.mjs . check:tailwind-source',
  'node scripts/run-workspace-package-script.mjs . check:studio-chat-layout',
  'node scripts/run-workspace-package-script.mjs . check:studio-sidebar-stability',
  'node scripts/run-workspace-package-script.mjs . check:studio-stage-header',
  'node scripts/run-workspace-package-script.mjs . check:studio-page-componentization',
  'node scripts/run-workspace-package-script.mjs . check:code-page-componentization',
  'node scripts/run-workspace-package-script.mjs . check:code-editor-surface-boundary',
  'node scripts/run-workspace-package-script.mjs . check:file-system-boundary',
  'node scripts/run-workspace-package-script.mjs . check:code-workbench-command-boundary',
  'node scripts/run-workspace-package-script.mjs . check:code-run-entry-boundary',
  'node scripts/run-workspace-package-script.mjs . check:local-store-browser-fallback',
  'node scripts/run-workspace-package-script.mjs . check:package-governance',
  'node scripts/run-workspace-package-script.mjs . check:package-subpath-exports',
  'node scripts/run-workspace-package-script.mjs . check:governance-baseline',
  'node scripts/run-workspace-package-script.mjs . check:terminal-governance',
  'node scripts/run-workspace-package-script.mjs . check:governance-regression-contract',
  'node scripts/run-workspace-package-script.mjs . check:live-docs-governance-baseline',
  'node scripts/run-workspace-package-script.mjs . check:quality-loop-scoreboard',
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
