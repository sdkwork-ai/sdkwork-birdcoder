import fs from 'node:fs';
import path from 'node:path';

const MIGRATED_FROM = /^> Migrated from `([^`]+)` on /;

const MANUAL_OVERRIDES = new Map([
  ['docs/架构/README.md', 'docs/archive/migrated-legacy/架构/README.md'],
]);

export function buildCanonicalDocPathIndex(rootDir) {
  const index = new Map(MANUAL_OVERRIDES);
  const techDir = path.join(rootDir, 'docs/architecture/tech');

  if (!fs.existsSync(techDir)) {
    return index;
  }

  for (const entry of fs.readdirSync(techDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }

    const absolute = path.join(techDir, entry.name);
    const head = fs.readFileSync(absolute, 'utf8').split('\n', 3).join('\n');
    const match = head.match(MIGRATED_FROM);
    if (!match) {
      continue;
    }

    index.set(match[1].replace(/\\/g, '/'), `docs/architecture/tech/${entry.name}`);
  }

  return index;
}

export function resolveCanonicalDocPath(rootDir, legacyRelativePath, index) {
  const normalized = legacyRelativePath.replace(/\\/g, '/');
  const mapped = index.get(normalized) ?? normalized;
  const absolute = path.join(rootDir, mapped);

  if (fs.existsSync(absolute)) {
    return mapped;
  }

  const archivePath = path.join(
    rootDir,
    'docs/archive/migrated-legacy',
    normalized.replace(/^docs\//, ''),
  );
  if (fs.existsSync(archivePath)) {
    return path.relative(rootDir, archivePath).split(path.sep).join('/');
  }

  return mapped;
}

export function readCanonicalDoc(rootDir, legacyRelativePath, index) {
  const resolvedPath = resolveCanonicalDocPath(rootDir, legacyRelativePath, index);
  const absolute = path.join(rootDir, resolvedPath);

  if (!fs.existsSync(absolute)) {
    throw new Error(`Canonical doc not found for ${legacyRelativePath} (resolved: ${resolvedPath})`);
  }

  return {
    legacyPath: legacyRelativePath.replace(/\\/g, '/'),
    path: resolvedPath.replace(/\\/g, '/'),
    source: fs.readFileSync(absolute, 'utf8'),
  };
}
