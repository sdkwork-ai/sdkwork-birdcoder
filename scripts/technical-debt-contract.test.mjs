import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const scanRoots = [
  '.github',
  'DATABASE_SPEC.md',
  'deploy',
  'docs',
  'package.json',
  'packages',
  'pnpm-workspace.yaml',
  'scripts',
];

const scannableExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.ps1',
  '.rs',
  '.scss',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

const excludedDirectoryNames = new Set([
  '.git',
  'artifacts',
  'coverage',
  'dist',
  'external',
  'node_modules',
  'target',
]);

const excludedRelativePathPatterns = [
  /^packages\/sdkwork-birdcoder-desktop\/src-tauri\/gen\//u,
  /(^|\/)generated(\/|$)/u,
  /(^|\/)(?:package-lock|pnpm-lock)\.(?:json|ya?ml)$/u,
  /^scripts\/technical-debt-contract\.test\.mjs$/u,
];

const debtTokenPattern = /depreacted|@deprecated|\bdeprecated\b/iu;

const allowedDebtTokenLines = [
  {
    relativePath: 'DATABASE_SPEC.md',
    pattern: /`status`\s*\|\s*`ACTIVE`.*`DEPRECATED`.*`RESERVED`/u,
    reason: 'database status enum documents released prefix lifecycle states',
  },
  {
    relativePath: 'DATABASE_SPEC.md',
    pattern: /废弃前缀只能标记为 `DEPRECATED` 或 `RESERVED`/u,
    reason: 'database prefix governance uses DEPRECATED as a lifecycle state',
  },
  {
    relativePath: 'DATABASE_SPEC.md',
    pattern: /存量字段废弃 SHOULD 使用 `deprecated_at`/u,
    reason: 'database migration guidance requires a deprecation timestamp field',
  },
  {
    relativePath: 'packages/sdkwork-birdcoder-server/src-host/src/user_center.rs',
    pattern: /deprecated_at TEXT NULL/u,
    reason: 'user-center schema carries a nullable lifecycle timestamp column',
  },
  {
    relativePath: 'packages/sdkwork-birdcoder-server/src/index.ts',
    pattern: /BIRDCODER_MODEL_STATUSES = \['active', 'preview', 'deprecated', 'disabled'\]/u,
    reason: 'model catalog exposes deprecated as a business lifecycle status',
  },
  {
    relativePath: 'packages/sdkwork-birdcoder-types/src/data.ts',
    pattern: /name: 'deprecated_at'.*description: 'Deprecation time\.'/u,
    reason: 'data schema exposes the canonical lifecycle timestamp column',
  },
  {
    relativePath: 'packages/sdkwork-birdcoder-types/src/engine.ts',
    pattern: /\| 'deprecated'/u,
    reason: 'engine availability status includes deprecated as lifecycle state',
  },
  {
    relativePath: 'scripts/desktop-tauri-dev-contract.test.mjs',
    pattern: /permission manifest must remove deprecated terminal command/u,
    reason: 'contract forbids a retired Tauri terminal command',
  },
  {
    relativePath: 'scripts/problem-list-remediation-contract.test.mjs',
    pattern: /\/@deprecated\|sectionId\//u,
    reason: 'contract forbids reintroducing a deprecated VIP route option',
  },
  {
    relativePath: 'scripts/problem-list-remediation-contract.test.mjs',
    pattern: /remove deprecated sectionId compatibility debt/u,
    reason: 'contract message names the forbidden VIP compatibility debt',
  },
  {
    relativePath: 'scripts/user-center-plus-entity-standard-contract.test.mjs',
    pattern: /'deprecated_at'/u,
    reason: 'user-center schema contract freezes the lifecycle timestamp column',
  },
  {
    relativePath: 'scripts/user-center-plus-entity-standard-contract.test.mjs',
    pattern: /deprecated_at: 'TEXT NULL'/u,
    reason: 'user-center schema contract freezes nullable lifecycle timestamp DDL',
  },
];

function normalizeRelativePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function isExcludedRelativePath(relativePath) {
  return excludedRelativePathPatterns.some((pattern) => pattern.test(relativePath));
}

function collectFiles(entryPath, files) {
  if (!fs.existsSync(entryPath)) {
    return;
  }

  const stat = fs.statSync(entryPath);
  if (stat.isDirectory()) {
    const directoryName = path.basename(entryPath);
    if (excludedDirectoryNames.has(directoryName)) {
      return;
    }

    for (const entry of fs.readdirSync(entryPath, { withFileTypes: true })) {
      collectFiles(path.join(entryPath, entry.name), files);
    }
    return;
  }

  const relativePath = normalizeRelativePath(path.relative(rootDir, entryPath));
  if (
    isExcludedRelativePath(relativePath) ||
    !scannableExtensions.has(path.extname(entryPath))
  ) {
    return;
  }

  files.push(entryPath);
}

function isAllowedDebtTokenLine(relativePath, line) {
  return allowedDebtTokenLines.some(
    (entry) => entry.relativePath === relativePath && entry.pattern.test(line),
  );
}

const files = [];
for (const scanRoot of scanRoots) {
  collectFiles(path.join(rootDir, scanRoot), files);
}
files.sort();

const violations = [];
for (const filePath of files) {
  const relativePath = normalizeRelativePath(path.relative(rootDir, filePath));
  const source = fs.readFileSync(filePath, 'utf8');
  const lines = source.split(/\r?\n/u);

  lines.forEach((line, index) => {
    if (!debtTokenPattern.test(line)) {
      return;
    }

    if (isAllowedDebtTokenLine(relativePath, line)) {
      return;
    }

    violations.push(`${relativePath}:${index + 1}: ${line.trim()}`);
  });
}

assert.deepEqual(
  violations,
  [],
  [
    'Deprecated technical debt scan failed.',
    'Only explicit domain lifecycle statuses, schema deprecation timestamps, and contracts that forbid retired APIs are allowed.',
    ...violations,
  ].join('\n'),
);

console.log('technical debt contract passed.');
