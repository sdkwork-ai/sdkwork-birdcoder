import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { validateAppComposition } from '../../sdkwork-specs/tools/lib/app-composition.mjs';

const rootDir = process.cwd();
const failures = [];

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

for (const issue of validateAppComposition(rootDir)) {
  fail(issue);
}

for (const manifestPath of walkFiles(rootDir, (filePath) => filePath.endsWith('dependency-manifest.ts') || filePath.endsWith('dependency_manifest.dart'))) {
  const source = fs.readFileSync(manifestPath, 'utf8');
  if (source.includes('dependency.composition.json')) {
    fail(`${path.relative(rootDir, manifestPath)} must reference component.spec.json, not dependency.composition.json`);
  }
  if (!source.includes('component.spec.json')) {
    fail(`${path.relative(rootDir, manifestPath)} must declare sdkworkComponentSpecPath`);
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
if (!packageJson.scripts?.['check:app-composition']) {
  fail('package.json must expose check:app-composition script');
}
if (!packageJson.scripts?.['check:api-response-envelope']) {
  fail('package.json must expose check:api-response-envelope script');
}

if (failures.length > 0) {
  process.stderr.write(`App composition standard failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('App composition standard passed\n');
