import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const topBarPath = path.join(
  process.cwd(),
  'packages/sdkwork-birdcoder-code/src/components/TopBar.tsx',
);
const source = fs.readFileSync(topBarPath, 'utf8');

assert.match(
  source,
  /Publish App/,
  'Code header publish modal must present IDE users with app publishing, not generic project release wording.',
);

assert.match(
  source,
  /One-click publish from the IDE/,
  'Publish modal must explain that the header action publishes the current app from the IDE.',
);

assert.match(
  source,
  /SDKWORK Cloud/,
  'Publish modal must make SDKWORK Cloud the default publish destination for app publishing.',
);

assert.match(
  source,
  /App mode/,
  'Publish modal must surface app mode so web, backend, container, and Kubernetes app styles are explicit.',
);

assert.match(
  source,
  /publishRuntime === 'web'\s*\? 'SDKWORK Cloud Web'/s,
  'New web app publish targets must default to SDKWORK Cloud Web for one-click frontend publishing.',
);

assert.doesNotMatch(
  source,
  /Reuse an existing target or create a new target before the release flow is recorded\./,
  'Publish modal must not lead with backend release-flow terminology in the IDE header experience.',
);

console.log('code header publish IDE experience contract passed.');
