#!/usr/bin/env node
/**
 * Kernel ↔ BirdCoder alignment contract.
 * Reads specs/kernel-birdcoder-alignment.spec.json and verifies evidence + gate tasks.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const specPath = path.join(root, 'specs/kernel-birdcoder-alignment.spec.json');
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

function resolveFromRoot(relativePath) {
  return path.join(root, relativePath);
}

function readSource(relativePath) {
  return readFileSync(resolveFromRoot(relativePath), 'utf8');
}

function assertPathExists(relativePath, message) {
  assert.equal(
    existsSync(resolveFromRoot(relativePath)),
    true,
    message ?? `Missing required path: ${relativePath}`,
  );
}

function assertPathAbsent(relativePath, message) {
  assert.equal(
    existsSync(resolveFromRoot(relativePath)),
    false,
    message ?? `Retired path must not exist: ${relativePath}`,
  );
}

// Authority docs
for (const doc of spec.authorityDocs) {
  assertPathExists(doc, `Authority doc missing: ${doc}`);
}

// Sibling bindings
for (const dep of spec.siblingDependencies ?? []) {
  for (const engine of dep.requiredBindings ?? []) {
    const manifest = path.join(
      root,
      dep.path,
      'bindings/agent-providers',
      engine,
      'provider-binding.manifest.json',
    );
    assert.equal(
      existsSync(manifest),
      true,
      `sdkwork-kernel binding manifest missing for ${engine}`,
    );
  }
}

const errors = [];

for (const task of spec.tasks) {
  const evidence = task.evidence ?? {};

  for (const relativePath of evidence.paths ?? []) {
    if (!existsSync(resolveFromRoot(relativePath))) {
      errors.push(`[${task.id}] missing path: ${relativePath}`);
    }
  }

  for (const relativePath of evidence.forbiddenPaths ?? []) {
    if (existsSync(resolveFromRoot(relativePath))) {
      errors.push(`[${task.id}] forbidden path still exists: ${relativePath}`);
    }
  }

  for (const siblingPath of evidence.siblingPaths ?? []) {
    const absolute = path.isAbsolute(siblingPath)
      ? siblingPath
      : path.join(root, siblingPath);
    if (!existsSync(absolute)) {
      errors.push(`[${task.id}] missing sibling path: ${siblingPath}`);
    }
  }

  for (const entry of evidence.requiredPatterns ?? []) {
    const source = readSource(entry.file);
    const pattern = new RegExp(entry.pattern, entry.flags ?? 's');
    if (!pattern.test(source)) {
      errors.push(
        `[${task.id}] required pattern not found in ${entry.file}: /${entry.pattern}/`,
      );
    }
  }

  for (const entry of evidence.forbiddenPatterns ?? []) {
    const source = readSource(entry.file);
    const pattern = new RegExp(entry.pattern, entry.flags ?? 's');
    if (pattern.test(source)) {
      errors.push(
        `[${task.id}] forbidden pattern found in ${entry.file}: /${entry.pattern}/`,
      );
    }
  }

  if (task.gate && task.status !== 'done') {
    errors.push(
      `[${task.id}] gate task status is "${task.status}" but must be "done" (${task.title})`,
    );
  }
}

// Verification matrix commands must be registered when they use pnpm run
for (const command of spec.verificationMatrix?.governanceSubset ?? []) {
  const match = command.match(/^pnpm run ([\w:-]+)$/);
  if (match && !packageJson.scripts?.[match[1]]) {
    errors.push(`package.json missing script for governance command: ${match[1]}`);
  }
}

assert.deepEqual(
  errors,
  [],
  `Kernel-BirdCoder alignment evidence failed:\n${errors.map((line) => `  - ${line}`).join('\n')}`,
);

const summary = {
  total: spec.tasks.length,
  done: spec.tasks.filter((task) => task.status === 'done').length,
  pending: spec.tasks.filter((task) => task.status === 'pending').length,
  gateDone: spec.tasks.filter((task) => task.gate && task.status === 'done').length,
  gateTotal: spec.tasks.filter((task) => task.gate).length,
};

console.log('kernel-birdcoder alignment contract passed.');
console.log(
  `tasks: ${summary.done}/${summary.total} done, gate: ${summary.gateDone}/${summary.gateTotal}, pending: ${summary.pending}`,
);

if (summary.pending > 0) {
  const pending = spec.tasks.filter((task) => task.status === 'pending');
  console.log('pending tasks (tracked, non-gate unless noted):');
  for (const task of pending) {
    console.log(`  - [${task.owner}] ${task.id}: ${task.title}`);
    if (task.notes) {
      console.log(`      ${task.notes}`);
    }
  }
}
