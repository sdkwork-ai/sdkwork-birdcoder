import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  assert.ok(fs.existsSync(absolutePath), `${relativePath} must exist`);
  return fs.readFileSync(absolutePath, 'utf8');
}

function fail(message) {
  failures.push(message);
}

function walkFiles(directoryPath, predicate) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const matches = [];
  const stack = [directoryPath];
  while (stack.length > 0) {
    const currentPath = stack.pop();
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (predicate(absolutePath)) {
        matches.push(absolutePath);
      }
    }
  }

  return matches.sort((left, right) => left.localeCompare(right));
}

function relativeFromRoot(absolutePath) {
  return path.relative(rootDir, absolutePath).split(path.sep).join('/');
}

const rootCargo = read('Cargo.toml');
if (!rootCargo.includes('sdkwork-utils-rust = {')) {
  fail('root Cargo.toml must declare sdkwork-utils-rust workspace dependency');
}

const pnpmWorkspace = read('pnpm-workspace.yaml');
if (!pnpmWorkspace.includes('../sdkwork-utils/packages/sdkwork-utils-typescript')) {
  fail('pnpm-workspace.yaml must include sdkwork-utils-typescript package');
}

const workflow = JSON.parse(read('sdkwork.workflow.json'));
const dependencyIds = new Set((workflow.dependencies || []).map((dependency) => dependency.id));
if (!dependencyIds.has('sdkwork-utils')) {
  fail('sdkwork.workflow.json must declare sdkwork-utils dependency');
}

const packageJson = JSON.parse(read('package.json'));
if (!packageJson.devDependencies?.['@sdkwork/utils']) {
  fail('root package.json must declare @sdkwork/utils devDependency');
}

const digestHelper = read('scripts/sdkwork-utils-digest.mjs');
if (!digestHelper.includes('@sdkwork/utils/crypto')) {
  fail('sdkwork-utils-digest.mjs must re-export digests from @sdkwork/utils/crypto');
}

const rustServiceCrates = [
  'crates/sdkwork-birdcoder-workspace-service',
  'crates/sdkwork-birdcoder-project-service',
  'crates/sdkwork-birdcoder-deployment-service',
  'crates/sdkwork-birdcoder-coding-sessions-service',
  'crates/sdkwork-birdcoder-document-service',
  'crates/sdkwork-birdcoder-system-descriptor-service',
  'crates/sdkwork-birdcoder-skill-packages-service',
  'crates/sdkwork-birdcoder-app-templates-service',
  'crates/sdkwork-birdcoder-coding-sessions-repository-sqlx',
  'crates/sdkwork-routes-engine-catalog-app-api',
  'crates/sdkwork-routes-workspace-app-api',
];

for (const crateDir of rustServiceCrates) {
  const cargoToml = read(`${crateDir}/Cargo.toml`);
  if (!cargoToml.includes('sdkwork-utils-rust.workspace = true')) {
    fail(`${crateDir}/Cargo.toml must depend on sdkwork-utils-rust`);
  }

  const sourceFiles = walkFiles(
    path.join(rootDir, crateDir, 'src'),
    (filePath) => filePath.endsWith('.rs'),
  );
  for (const sourceFile of sourceFiles) {
    const source = fs.readFileSync(sourceFile, 'utf8');
    if (source.includes('.trim().is_empty()')) {
      fail(`${relativeFromRoot(sourceFile)} must not keep local blank-string checks after sdkwork-utils adoption`);
    }
    if (source.includes('sdkwork_utils_rust::is_blank') || source.includes('use sdkwork_utils_rust::is_blank')) {
      continue;
    }
    if (source.includes('is_blank(')) {
      continue;
    }
  }
}

const typescriptPackages = [
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/package.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/package.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/package.json',
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-chat/package.json',
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-core/package.json',
];
for (const packageManifestPath of typescriptPackages) {
  const manifest = JSON.parse(read(packageManifestPath));
  if (!manifest.dependencies?.['@sdkwork/utils']) {
    fail(`${packageManifestPath} must declare @sdkwork/utils dependency`);
  }
}

const typescriptSourceRoots = [
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src',
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-chat/src',
];
for (const sourceRoot of typescriptSourceRoots) {
  const sourceFiles = walkFiles(
    path.join(rootDir, sourceRoot),
    (filePath) => filePath.endsWith('.ts') || filePath.endsWith('.tsx'),
  );
  for (const sourceFile of sourceFiles) {
    const source = fs.readFileSync(sourceFile, 'utf8');
    if (source.includes('.trim().length === 0')) {
      fail(`${relativeFromRoot(sourceFile)} must use @sdkwork/utils/string isBlank instead of local blank checks`);
    }
    if (source.includes("from '@sdkwork/utils'") || source.includes('from "@sdkwork/utils"')) {
      fail(`${relativeFromRoot(sourceFile)} must import browser-safe utils through @sdkwork/utils/* subpaths`);
    }
  }
}

const scriptFiles = walkFiles(
  path.join(rootDir, 'scripts'),
  (filePath) => (
    (filePath.endsWith('.mjs') || filePath.endsWith('.ts'))
    && !filePath.endsWith('utils-standard-contract.test.mjs')
  ),
);
for (const scriptFile of scriptFiles) {
  const source = fs.readFileSync(scriptFile, 'utf8');
  if (source.includes("createHash('sha256')") || source.includes('.createHash("sha256")')) {
    fail(`${relativeFromRoot(scriptFile)} must compute digests through scripts/sdkwork-utils-digest.mjs`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`Utils standard failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('Utils standard passed\n');
