import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const declarationsPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'react-syntax-highlighter.d.ts',
);

assert.ok(
  fs.existsSync(declarationsPath),
  'sdkwork-birdcoder-ui must provide local ESM subpath declarations for react-syntax-highlighter.',
);

const declarationsSource = fs.readFileSync(declarationsPath, 'utf8');

for (const moduleName of [
  'react-syntax-highlighter/dist/esm/prism-light',
  'react-syntax-highlighter/dist/esm/languages/prism/bash',
  'react-syntax-highlighter/dist/esm/languages/prism/css',
  'react-syntax-highlighter/dist/esm/languages/prism/diff',
  'react-syntax-highlighter/dist/esm/languages/prism/javascript',
  'react-syntax-highlighter/dist/esm/languages/prism/json',
  'react-syntax-highlighter/dist/esm/languages/prism/jsx',
  'react-syntax-highlighter/dist/esm/languages/prism/markdown',
  'react-syntax-highlighter/dist/esm/languages/prism/markup',
  'react-syntax-highlighter/dist/esm/languages/prism/python',
  'react-syntax-highlighter/dist/esm/languages/prism/rust',
  'react-syntax-highlighter/dist/esm/languages/prism/sql',
  'react-syntax-highlighter/dist/esm/languages/prism/toml',
  'react-syntax-highlighter/dist/esm/languages/prism/tsx',
  'react-syntax-highlighter/dist/esm/languages/prism/typescript',
  'react-syntax-highlighter/dist/esm/languages/prism/yaml',
  'react-syntax-highlighter/dist/esm/styles/prism',
]) {
  assert.match(
    declarationsSource,
    new RegExp(`declare module ['"]${moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
    `Missing local declaration for ${moduleName}.`,
  );
}

console.log('react-syntax-highlighter type contract passed.');
