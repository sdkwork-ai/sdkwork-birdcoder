#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, 'apps', 'sdkwork-birdcoder-pc', 'packages');
let fieldUpdates = 0;
let filesUpdated = 0;

for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) {
    continue;
  }

  const packageDir = path.join(packagesDir, entry.name);
  const specPath = path.join(packageDir, 'specs', 'component.spec.json');
  if (!fs.existsSync(specPath)) {
    continue;
  }

  const packageJsonPath = path.join(packageDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const nextRoot = `sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/${entry.name}`;
  let changed = false;

  if (spec.component?.root !== nextRoot) {
    spec.component.root = nextRoot;
    fieldUpdates += 1;
    changed = true;
  }

  if (packageJson.name && spec.component?.name !== packageJson.name) {
    spec.component.name = packageJson.name;
    fieldUpdates += 1;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
    filesUpdated += 1;
  }
}

console.log(
  JSON.stringify({
    filesUpdated,
    fieldUpdates,
  }),
);
