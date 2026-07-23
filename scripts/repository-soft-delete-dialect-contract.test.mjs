import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const ownedRepositoryRoot = 'crates/sdkwork-birdcoder-workspace-repository-sqlx';
const retiredRepositoryRoots = [
  'crates/sdkwork-birdcoder-skill-packages-repository-sqlx',
  'crates/sdkwork-birdcoder-app-templates-repository-sqlx',
  'crates/sdkwork-birdcoder-coding-sessions-repository-sqlx',
  'crates/sdkwork-birdcoder-chat-repository-sqlx',
  'crates/sdkwork-birdcoder-commerce-repository-sqlx',
  'crates/sdkwork-birdcoder-document-repository-sqlx',
  'crates/sdkwork-birdcoder-membership-repository-sqlx',
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

for (const retiredRepositoryRoot of retiredRepositoryRoots) {
  const absoluteRoot = path.join(rootDir, retiredRepositoryRoot);
  const hasCargoManifest = fs.existsSync(path.join(absoluteRoot, 'Cargo.toml'));
  const hasRustSource =
    fs.existsSync(absoluteRoot) && walkRustFiles(absoluteRoot).length > 0;
  assert.equal(
    hasCargoManifest || hasRustSource,
    false,
    `${retiredRepositoryRoot} must not retain an authored repository authority`,
  );
}

const absoluteOwnedRepositoryRoot = path.join(rootDir, ownedRepositoryRoot);
assert.ok(fs.existsSync(absoluteOwnedRepositoryRoot), `${ownedRepositoryRoot} must exist`);
for (const filePath of walkRustFiles(absoluteOwnedRepositoryRoot)) {
  if (filePath.includes(`${path.sep}tests${path.sep}`)) {
    continue;
  }
  const relativePath = path.relative(rootDir, filePath).replaceAll('\\', '/');
  const source = fs.readFileSync(filePath, 'utf8');
  if (
    relativePath.endsWith('/postgres.rs') &&
    /is_deleted\s*=\s*[01]\b/i.test(source)
  ) {
    violations.push(`${relativePath}: PostgreSQL must use boolean soft-delete literals`);
  }
  if (
    relativePath.endsWith('/sqlite.rs') &&
    /is_deleted\s*=\s*(?:TRUE|FALSE)\b/i.test(source)
  ) {
    violations.push(`${relativePath}: SQLite must use integer soft-delete literals`);
  }
}

assert.deepEqual(
  violations,
  [],
  `repository SQL must use the correct soft-delete literal for each database engine:\n${violations.join('\n')}`,
);

console.log('repository soft-delete dialect contract passed.');
