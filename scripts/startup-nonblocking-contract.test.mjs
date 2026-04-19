import assert from 'node:assert/strict';
import fs from 'node:fs';

const entryPaths = [
  new URL('../src/main.tsx', import.meta.url),
  new URL('../packages/sdkwork-birdcoder-web/src/main.tsx', import.meta.url),
  new URL('../packages/sdkwork-birdcoder-desktop/src/main.tsx', import.meta.url),
];

for (const entryPath of entryPaths) {
  const source = fs.readFileSync(entryPath, 'utf8');

  assert.match(
    source,
    /createRoot\(document\.getElementById\('root'\)!\)\.render\(/,
    `Startup entry ${entryPath.pathname} must still mount a React root immediately.`,
  );

  assert.match(
    source,
    /<BootstrapGate\s+bootstrap=\{bootstrapRuntime\}>/,
    `Startup entry ${entryPath.pathname} must render through BootstrapGate so startup work happens after the first paint.`,
  );
}

console.log('startup nonblocking contract passed.');
