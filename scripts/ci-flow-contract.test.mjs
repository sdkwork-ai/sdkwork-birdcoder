import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const ciWorkflow = fs.readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf8');
const rootPackageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

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

assert.equal(rootPackageJson.scripts.typecheck, 'pnpm -s exec tsc --noEmit');
assert.equal(rootPackageJson.scripts['check:quality-matrix'], 'node scripts/quality-gate-matrix-contract.test.mjs');
assert.equal(rootPackageJson.scripts['quality:report'], 'node scripts/quality-gate-matrix-report.mjs');
assert.equal(rootPackageJson.scripts['check:quality:fast'], rootPackageJson.scripts.lint);
assert.match(rootPackageJson.scripts.lint, /^pnpm exec tsc --noEmit && /);
assert.match(rootPackageJson.scripts.lint, /pnpm --filter @sdkwork\/birdcoder-web exec tsc --noEmit/);
assert.doesNotMatch(
  rootPackageJson.scripts['check:quality:fast'],
  /^pnpm lint$/,
  'check:quality:fast must avoid reopening a nested pnpm lint wrapper on Windows',
);
assert.equal(
  rootPackageJson.scripts['check:quality:standard'],
  `${rootPackageJson.scripts['check:desktop']} && ${rootPackageJson.scripts['check:server']} && ${rootPackageJson.scripts['prepare:shared-sdk']} && pnpm --dir packages/sdkwork-birdcoder-web exec node ../../scripts/run-vite-host.mjs build --mode production && ${rootPackageJson.scripts['check:web-bundle-budget']} && ${rootPackageJson.scripts['server:build']} && ${rootPackageJson.scripts['docs:build']}`,
);
assert.doesNotMatch(
  rootPackageJson.scripts['check:quality:standard'],
  /^pnpm check:desktop && pnpm check:server/,
  'check:quality:standard must avoid reopening nested desktop/server gate wrappers on Windows',
);
assert.doesNotMatch(
  rootPackageJson.scripts['check:quality:standard'],
  /&& pnpm build && pnpm server:build && pnpm docs:build$/,
  'check:quality:standard must avoid reopening nested root build/server/docs wrappers on Windows',
);
assert.equal(
  rootPackageJson.scripts['check:quality:release'],
  'pnpm check:quality:fast && pnpm check:quality:standard && pnpm check:quality-matrix && pnpm check:release-flow && pnpm check:ci-flow && pnpm check:governance-regression',
);

console.log('ci flow contract passed.');
