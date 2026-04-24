import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const npmrcPath = path.join(rootDir, '.npmrc');
const uiPackageJsonPath = path.join(rootDir, 'packages', 'sdkwork-birdcoder-ui', 'package.json');
const uiShellPackageJsonPath = path.join(rootDir, 'packages', 'sdkwork-birdcoder-ui-shell', 'package.json');
const desktopViteConfigPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'vite.config.ts',
);

const uiPackageJson = JSON.parse(fs.readFileSync(uiPackageJsonPath, 'utf8'));
const uiShellPackageJson = JSON.parse(fs.readFileSync(uiShellPackageJsonPath, 'utf8'));
const npmrcSource = fs.readFileSync(npmrcPath, 'utf8');
const desktopViteConfigSource = fs.readFileSync(desktopViteConfigPath, 'utf8');

function assertDependencyVersion(packageName, dependencyName, actualVersion, expectedVersion) {
  const acceptedVersions = new Set([expectedVersion, 'catalog:']);

  assert.ok(
    acceptedVersions.has(actualVersion),
    `${packageName} must declare ${dependencyName} directly so desktop/web consumers share the verified compatibility set. Expected one of ${[...acceptedVersions].join(', ')}, received ${actualVersion ?? 'missing'}.`,
  );
}

const expectedUiDependencies = {
  '@monaco-editor/loader': '^1.7.0',
  '@monaco-editor/react': '^4.7.0',
  'lucide-react': '^1.7.0',
  'monaco-editor': '^0.55.1',
  'react-markdown': '^10.1.0',
  'react-syntax-highlighter': '^16.1.1',
  refractor: '^5.0.0',
};

const expectedUiShellDependencies = {
  '@radix-ui/react-slot': '^1.2.4',
  'class-variance-authority': '^0.7.1',
  clsx: '^2.1.1',
  'lucide-react': '^0.546.0',
  'tailwind-merge': '^3.3.1',
};

for (const [dependencyName, expectedVersion] of Object.entries(expectedUiDependencies)) {
  assertDependencyVersion(
    '@sdkwork/birdcoder-ui',
    dependencyName,
    uiPackageJson.dependencies?.[dependencyName],
    expectedVersion,
  );
}

for (const [dependencyName, expectedVersion] of Object.entries(expectedUiShellDependencies)) {
  assertDependencyVersion(
    '@sdkwork/birdcoder-ui-shell',
    dependencyName,
    uiShellPackageJson.dependencies?.[dependencyName],
    expectedVersion,
  );
}

assert.equal(
  uiPackageJson.devDependencies?.['@vitejs/plugin-react'],
  '^5.2.0',
  'sdkwork-birdcoder-ui must keep @vitejs/plugin-react on the latest Vite 6-compatible release.',
);

assert.equal(
  uiPackageJson.dependencies?.['@radix-ui/react-slot'],
  undefined,
  'sdkwork-birdcoder-ui must not retain @radix-ui/react-slot after the shared button primitives moved into sdkwork-birdcoder-ui-shell.',
);

assert.equal(
  uiPackageJson.dependencies?.['@radix-ui/react-compose-refs'],
  undefined,
  'sdkwork-birdcoder-ui must not retain @radix-ui/react-compose-refs after the Radix button primitive ownership moved into sdkwork-birdcoder-ui-shell.',
);

assert.match(
  npmrcSource,
  /link-workspace-packages\s*=\s*true/,
  'Workspace dependency management must link workspace packages from the root, following the claw-studio baseline.',
);

assert.doesNotMatch(
  desktopViteConfigSource,
  /preserveSymlinks\s*:\s*true/,
  'Desktop Vite config must use the claw-studio-style realpath resolution strategy instead of preserved symlink package paths.',
);

console.log('ui dependency resolution contract passed.');
