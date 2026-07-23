import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const spec = JSON.parse(
  fs.readFileSync(path.join(root, 'specs/agents-birdcoder-alignment.spec.json'), 'utf8'),
);

function resolvePath(relativePath) {
  return path.resolve(root, relativePath);
}

function readSource(relativePath) {
  return fs.readFileSync(resolvePath(relativePath), 'utf8');
}

const errors = [];

assert.deepEqual(spec.dependencyDirection, [
  'sdkwork-birdcoder -> sdkwork-agents -> sdkwork-kernel',
  'sdkwork-im -> sdkwork-agents -> sdkwork-kernel',
  'sdkwork-agents -/-> sdkwork-im',
]);
assert.equal(
  spec.dependencyDirection.some((entry) => entry.startsWith('sdkwork-birdcoder -> sdkwork-im')),
  false,
  'IM ownership must not imply a BirdCoder runtime dependency before human messaging is enabled.',
);

for (const doc of spec.authorityDocs) {
  if (!fs.existsSync(resolvePath(doc))) {
    errors.push(`missing authority document: ${doc}`);
  }
}

for (const task of spec.tasks) {
  if (task.gate && task.status !== 'done') {
    errors.push(`[${task.id}] gate status must be done, received ${task.status}`);
  }

  const evidence = task.evidence ?? {};
  for (const relativePath of evidence.paths ?? []) {
    if (!fs.existsSync(resolvePath(relativePath))) {
      errors.push(`[${task.id}] missing path: ${relativePath}`);
    }
  }
  for (const relativePath of evidence.siblingPaths ?? []) {
    if (!fs.existsSync(resolvePath(relativePath))) {
      errors.push(`[${task.id}] missing sibling path: ${relativePath}`);
    }
  }
  for (const relativePath of evidence.forbiddenPaths ?? []) {
    if (fs.existsSync(resolvePath(relativePath))) {
      errors.push(`[${task.id}] forbidden path still exists: ${relativePath}`);
    }
  }
  for (const entry of evidence.requiredPatterns ?? []) {
    const source = readSource(entry.file);
    if (!new RegExp(entry.pattern, entry.flags ?? 'su').test(source)) {
      errors.push(`[${task.id}] missing pattern in ${entry.file}: /${entry.pattern}/`);
    }
  }
  for (const entry of evidence.forbiddenPatterns ?? []) {
    const source = readSource(entry.file);
    if (new RegExp(entry.pattern, entry.flags ?? 'su').test(source)) {
      errors.push(`[${task.id}] forbidden pattern in ${entry.file}: /${entry.pattern}/`);
    }
  }
}

assert.deepEqual(
  errors,
  [],
  `Agents-BirdCoder alignment failed:\n${errors.map((error) => `  - ${error}`).join('\n')}`,
);

console.log('agents-birdcoder alignment contract passed.');
console.log(`tasks: ${spec.tasks.length}/${spec.tasks.length} done`);
