import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const repositoryRoots = [
  'crates/sdkwork-birdcoder-skill-packages-repository-sqlx',
  'crates/sdkwork-birdcoder-app-templates-repository-sqlx',
  'crates/sdkwork-birdcoder-coding-sessions-repository-sqlx',
  'crates/sdkwork-birdcoder-chat-repository-sqlx',
  'crates/sdkwork-birdcoder-commerce-repository-sqlx',
  'crates/sdkwork-birdcoder-document-repository-sqlx',
  'crates/sdkwork-birdcoder-membership-repository-sqlx',
  'crates/sdkwork-birdcoder-workspace-repository-sqlx',
  'crates/sdkwork-birdcoder-model-config-repository-sqlx',
];

function walkRustFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkRustFiles(absolutePath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.rs')) {
      files.push(absolutePath);
    }
  }
  return files;
}

const violations = [];

for (const repositoryRoot of repositoryRoots) {
  const absoluteRoot = path.join(rootDir, repositoryRoot);
  assert.ok(fs.existsSync(absoluteRoot), `${repositoryRoot} must exist`);
  for (const filePath of walkRustFiles(absoluteRoot)) {
    if (filePath.includes(`${path.sep}tests${path.sep}`)) {
      continue;
    }
    const source = fs.readFileSync(filePath, 'utf8');
    if (/is_deleted\s*=\s*0/.test(source) || /is_deleted\s*=\s*1/.test(source)) {
      violations.push(path.relative(rootDir, filePath));
    }
  }
}

assert.deepEqual(
  violations,
  [],
  `repository SQL must use cross-engine soft-delete predicates (IS_NOT_DELETED), not integer literals:\n${violations.join('\n')}`,
);

console.log('repository soft-delete dialect contract passed.');
