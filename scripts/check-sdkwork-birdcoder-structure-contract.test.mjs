import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const repoRootDir = process.cwd();
const structureCheckModulePath = path.join(repoRootDir, 'scripts', 'check-sdkwork-birdcoder-structure.mjs');
const structureCheckSource = fs.readFileSync(structureCheckModulePath, 'utf8');

function extractConstArrayLiteral(source, constName) {
  const match = source.match(new RegExp(`const ${constName} = \\[(?:.|\\r|\\n)*?\\];`));
  assert.ok(match, `Unable to locate ${constName} in check-sdkwork-birdcoder-structure.mjs.`);
  return match[0];
}

function extractRequiredPaths(source) {
  const arrayLiteral = extractConstArrayLiteral(source, 'requiredPaths');
  return [...arrayLiteral.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

function extractRequiredPackages(source) {
  const arrayLiteral = extractConstArrayLiteral(source, 'requiredPackages');
  return [...arrayLiteral.matchAll(/\[\s*'([^']+)'\s*,\s*'([^']+)'\s*\]/g)].map((match) => ({
    relativeDir: match[1],
    expectedName: match[2],
  }));
}

function writeWorkspaceFile(rootDir, relativePath, content = '') {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf8');
}

function createStructureFixtureWorkspace({ scripts }) {
  const fixtureRootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-structure-contract-'));
  const requiredPaths = extractRequiredPaths(structureCheckSource);
  const requiredPackages = extractRequiredPackages(structureCheckSource);

  writeWorkspaceFile(
    fixtureRootDir,
    'pnpm-workspace.yaml',
    "packages:\n  - 'packages/sdkwork-birdcoder-*'\n",
  );
  writeWorkspaceFile(
    fixtureRootDir,
    'package.json',
    JSON.stringify(
      {
        name: '@sdkwork/birdcoder-workspace',
        private: true,
        scripts,
      },
      null,
      2,
    ),
  );

  for (const { relativeDir, expectedName } of requiredPackages) {
    writeWorkspaceFile(
      fixtureRootDir,
      path.join(relativeDir, 'package.json'),
      JSON.stringify({ name: expectedName }, null, 2),
    );
  }

  for (const relativePath of requiredPaths) {
    if (relativePath === 'package.json') {
      continue;
    }

    if (relativePath.endsWith('/package.json')) {
      continue;
    }

    const content = relativePath.endsWith('.json') ? '{}\n' : '\n';
    writeWorkspaceFile(fixtureRootDir, relativePath, content);
  }

  return fixtureRootDir;
}

async function importStructureCheckForWorkspace(fixtureRootDir) {
  const previousCwd = process.cwd();
  process.chdir(fixtureRootDir);

  try {
    return await import(
      `${pathToFileURL(structureCheckModulePath).href}?fixture=${encodeURIComponent(fixtureRootDir)}-${Date.now()}`,
    );
  } finally {
    process.chdir(previousCwd);
  }
}

const fixtureRootDir = createStructureFixtureWorkspace({
  scripts: {
    build: 'pnpm --dir packages/sdkwork-birdcoder-web exec node ../../scripts/existing-topology-check.mjs build --mode production',
    'check:tauri-dev-binary-unlock': 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/existing-topology-check.ps1',
    'check:missing-topology': 'node scripts/missing-topology-check.mjs',
  },
});

writeWorkspaceFile(fixtureRootDir, 'scripts/existing-topology-check.mjs', "console.log('ok');\n");
writeWorkspaceFile(fixtureRootDir, 'scripts/existing-topology-check.ps1', "Write-Output 'ok'\n");

const structureCheckModule = await importStructureCheckForWorkspace(fixtureRootDir);
const stderr = [];
const stdout = [];
const exitCode = structureCheckModule.runSdkworkBirdcoderStructureCheck({
  stderr: (message) => stderr.push(String(message)),
  stdout: (message) => stdout.push(String(message)),
});

assert.equal(exitCode, 1, 'structure check must fail when package.json references a missing local script file.');
assert.match(
  stderr.join('\n'),
  /Root package script check:missing-topology references missing repo file: scripts\/missing-topology-check\.mjs/,
  'structure check must surface the missing repo file and the owning root script name.',
);
assert.doesNotMatch(
  stderr.join('\n'),
  /existing-topology-check/,
  'structure check must not flag root package script targets that already exist in the workspace.',
);
assert.deepEqual(stdout, []);

console.log('sdkwork-birdcoder structure contract passed.');
