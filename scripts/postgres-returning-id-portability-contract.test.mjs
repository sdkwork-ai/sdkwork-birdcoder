import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const crateRoots = [
  'crates/sdkwork-birdcoder-commerce-repository-sqlx',
  'crates/sdkwork-birdcoder-workspace-repository-sqlx',
  'crates/sdkwork-birdcoder-coding-sessions-repository-sqlx',
  'crates/sdkwork-birdcoder-chat-repository-sqlx',
  'crates/sdkwork-birdcoder-skill-packages-repository-sqlx',
  'crates/sdkwork-birdcoder-document-repository-sqlx',
  'crates/sdkwork-birdcoder-membership-repository-sqlx',
  'crates/sdkwork-birdcoder-app-templates-repository-sqlx',
  'crates/sdkwork-birdcoder-sqlx-repository-pool',
];

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function walkRustFiles(relativeDir) {
  const absoluteDir = path.join(rootDir, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  /** @type {string[]} */
  const files = [];
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const entryPath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkRustFiles(entryPath));
      continue;
    }
    if (entry.name.endsWith('.rs')) {
      files.push(entryPath);
    }
  }
  return files;
}

const dialect = read('crates/sdkwork-birdcoder-sqlx-repository-pool/src/dialect.rs');
assert.match(dialect, /SQL_RETURNING_ID/u, 'dialect helper must expose RETURNING id suffix.');
assert.match(dialect, /inserted_row_id/u, 'dialect helper must read RETURNING id rows.');

for (const crateRoot of crateRoots) {
  for (const filePath of walkRustFiles(crateRoot)) {
    const source = read(filePath);
    assert.doesNotMatch(
      source,
      /last_insert_rowid\(\)|last_insert_id\(\)/u,
      `${filePath} must not use SQLite-only last insert helpers.`,
    );
    assert.doesNotMatch(
      source,
      /is_deleted\s*=\s*0/u,
      `${filePath} must use IS_NOT_DELETED instead of is_deleted = 0 for PostgreSQL portability.`,
    );
  }
}

console.log('postgres returning-id portability contract passed.');
