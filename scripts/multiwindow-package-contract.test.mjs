import assert from 'node:assert/strict';
import fs from 'node:fs';

const packageDir = new URL('../packages/sdkwork-birdcoder-multiwindow/', import.meta.url);
const packageJsonPath = new URL('package.json', packageDir);
const tsconfigPath = new URL('tsconfig.json', packageDir);
const indexPath = new URL('src/index.ts', packageDir);

assert.ok(
  fs.existsSync(packageJsonPath),
  'Multi-window programming must live in an independent workspace package.',
);
assert.ok(
  fs.existsSync(tsconfigPath),
  'Multi-window package must own its TypeScript project boundary.',
);
assert.ok(
  fs.existsSync(indexPath),
  'Multi-window package must expose a canonical src/index.ts entry.',
);

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const indexSource = fs.readFileSync(indexPath, 'utf8');

assert.equal(
  packageJson.name,
  '@sdkwork/birdcoder-multiwindow',
  'Multi-window package must use the scoped @sdkwork/birdcoder-* manifest name.',
);

assert.equal(
  packageJson.type,
  'module',
  'Multi-window package must be an ESM package like the rest of the workspace.',
);

assert.equal(
  packageJson.exports?.['.']?.import,
  './src/index.ts',
  'Multi-window package must export its source entry through the package exports map.',
);

const requiredDependencies = [
  '@sdkwork/birdcoder-codeengine',
  '@sdkwork/birdcoder-commons',
  '@sdkwork/birdcoder-types',
  '@sdkwork/birdcoder-ui',
  '@sdkwork/birdcoder-ui-shell',
  'lucide-react',
  'react',
  'react-dom',
  'react-i18next',
];

for (const dependencyName of requiredDependencies) {
  assert.ok(
    packageJson.dependencies?.[dependencyName] || packageJson.peerDependencies?.[dependencyName],
    `Multi-window package must declare ${dependencyName} instead of relying on transitive dependencies.`,
  );
}

assert.match(
  indexSource,
  /export \{ MultiWindowProgrammingPage \} from '\.\/pages\/MultiWindowProgrammingPage(?:\.tsx)?';/,
  'Multi-window package entry must export MultiWindowProgrammingPage.',
);

assert.match(
  indexSource,
  /export \* from '\.\/runtime\/multiWindowLayout(?:\.ts)?';/,
  'Multi-window package entry must export layout constants.',
);

assert.match(
  indexSource,
  /export \* from '\.\/runtime\/multiWindowAddFlow(?:\.ts)?';/,
  'Multi-window package entry must export pure add-flow helpers.',
);

assert.match(
  indexSource,
  /export \* from '\.\/runtime\/multiWindowDispatch(?:\.ts)?';/,
  'Multi-window package entry must export the concurrent dispatch runtime.',
);

assert.match(
  indexSource,
  /export \* from '\.\/runtime\/multiWindowDispatchability(?:\.ts)?';/,
  'Multi-window package entry must export pane dispatchability helpers.',
);

assert.match(
  indexSource,
  /export \* from '\.\/runtime\/multiWindowParameters(?:\.ts)?';/,
  'Multi-window package entry must export pure parameter normalization helpers.',
);

assert.match(
  indexSource,
  /export \* from '\.\/runtime\/multiWindowPromptProfile(?:\.ts)?';/,
  'Multi-window package entry must export prompt profile compilation helpers.',
);

assert.match(
  indexSource,
  /export \* from '\.\/runtime\/multiWindowPreviewUrl(?:\.ts)?';/,
  'Multi-window package entry must export pure preview URL detection helpers.',
);

assert.match(
  indexSource,
  /export type \{[\s\S]*MultiWindowPaneConfig[\s\S]*\} from '\.\/types(?:\.ts)?';/,
  'Multi-window package entry must export its public pane configuration types.',
);

console.log('multi-window package contract passed.');
