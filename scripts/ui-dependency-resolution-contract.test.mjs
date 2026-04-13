import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const npmrcPath = path.join(rootDir, '.npmrc');
const uiPackageJsonPath = path.join(rootDir, 'packages', 'sdkwork-birdcoder-ui', 'package.json');
const desktopViteConfigPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-desktop',
  'vite.config.ts',
);

const uiPackageJson = JSON.parse(fs.readFileSync(uiPackageJsonPath, 'utf8'));
const npmrcSource = fs.readFileSync(npmrcPath, 'utf8');
const desktopViteConfigSource = fs.readFileSync(desktopViteConfigPath, 'utf8');

const expectedDependencies = {
  '@radix-ui/react-compose-refs': '^1.1.2',
  '@radix-ui/react-slot': '^1.2.4',
  '@monaco-editor/loader': '^1.7.0',
  '@monaco-editor/react': '^4.7.0',
  'lucide-react': '^1.7.0',
  'monaco-editor': '^0.55.1',
  'react-markdown': '^10.1.0',
  'react-syntax-highlighter': '^16.1.1',
  refractor: '^5.0.0',
};

for (const [dependencyName, expectedVersion] of Object.entries(expectedDependencies)) {
  assert.equal(
    uiPackageJson.dependencies?.[dependencyName],
    expectedVersion,
    `sdkwork-birdcoder-ui must pin ${dependencyName} to ${expectedVersion} so desktop/web consumers share the verified latest-compatible dependency set.`,
  );
}

assert.equal(
  uiPackageJson.devDependencies?.['@vitejs/plugin-react'],
  '^5.2.0',
  'sdkwork-birdcoder-ui must keep @vitejs/plugin-react on the latest Vite 6-compatible release.',
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
