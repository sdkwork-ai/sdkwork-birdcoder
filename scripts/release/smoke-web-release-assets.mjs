#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import {
  RELEASE_ASSET_MANIFEST_FILE_NAME,
} from './release-profiles.mjs';
import {
  writeReleaseSmokeReport,
} from './release-smoke-contract.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const DEFAULT_RELEASE_ASSETS_DIR = path.join(rootDir, 'artifacts', 'release');

const INTERNAL_DOC_PREFIXES = [
  'community/',
  'prompts/',
  'release/',
  'reports/',
  'review/',
  'step/',
  'plans/',
  'superpowers/',
  'zh-CN/community/',
  'zh-CN/prompts/',
  'zh-CN/release/',
  'zh-CN/reports/',
  'zh-CN/review/',
  'zh-CN/step/',
  'zh-CN/plans/',
  'zh-CN/superpowers/',
  `${String.fromCodePoint(0x67b6, 0x6784)}/`,
];
const PUBLIC_INTERNAL_DOC_ASSET_PREFIXES = [
  'community/',
  'zh-CN/community/',
];
const PUBLIC_DOC_ASSET_EXTENSIONS = new Set([
  '.avif',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp',
]);

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();
  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function resolveCliPath(value) {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) {
    return '';
  }

  return path.resolve(process.cwd(), normalizedValue);
}

function parseTarOctal(buffer) {
  const trimmed = buffer.toString('utf8').replace(/\0.*$/, '').trim();
  return trimmed ? Number.parseInt(trimmed, 8) : 0;
}

function parsePaxHeaders(content) {
  const headers = new Map();
  const source = content.toString('utf8');
  let offset = 0;

  while (offset < source.length) {
    const separatorIndex = source.indexOf(' ', offset);
    if (separatorIndex === -1) {
      break;
    }

    const length = Number.parseInt(source.slice(offset, separatorIndex), 10);
    if (!Number.isFinite(length) || length <= 0) {
      break;
    }

    const record = source.slice(separatorIndex + 1, offset + length - 1);
    const equalsIndex = record.indexOf('=');
    if (equalsIndex !== -1) {
      headers.set(record.slice(0, equalsIndex), record.slice(equalsIndex + 1));
    }

    offset += length;
  }

  return headers;
}

function normalizeArchiveEntryPath(entryPath) {
  return String(entryPath ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
}

function assertArchiveEntryPathSafe(entryPath) {
  const normalizedPath = normalizeArchiveEntryPath(entryPath);
  if (!normalizedPath || normalizedPath.startsWith('/') || /^[A-Za-z]:\//.test(normalizedPath)) {
    throw new Error(`Web release archive contains unsafe absolute path: ${entryPath}`);
  }
  if (normalizedPath.split('/').some((segment) => segment === '..')) {
    throw new Error(`Web release archive contains unsafe parent traversal path: ${entryPath}`);
  }

  return normalizedPath;
}

export function readTarGzEntries(archivePath) {
  const archiveBuffer = gunzipSync(readFileSync(archivePath));
  const entries = new Map();
  let offset = 0;
  let pendingPathOverride = '';

  while (offset + 512 <= archiveBuffer.length) {
    const header = archiveBuffer.subarray(offset, offset + 512);
    if (header.every((value) => value === 0)) {
      break;
    }

    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    const fullName = prefix ? `${prefix}/${name}` : name;
    const size = parseTarOctal(header.subarray(124, 136));
    const type = header.subarray(156, 157).toString('utf8').replace(/\0.*$/, '');
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    const content = archiveBuffer.subarray(contentStart, contentEnd);

    if (type === 'x') {
      pendingPathOverride = parsePaxHeaders(content).get('path') ?? pendingPathOverride;
      offset = contentStart + Math.ceil(size / 512) * 512;
      continue;
    }
    if (type === 'L') {
      pendingPathOverride = content.toString('utf8').replace(/\0.*$/, '');
      offset = contentStart + Math.ceil(size / 512) * 512;
      continue;
    }

    entries.set(assertArchiveEntryPathSafe(pendingPathOverride || fullName), {
      content,
      size,
      type: type || '0',
    });
    pendingPathOverride = '';
    offset = contentStart + Math.ceil(size / 512) * 512;
  }

  return entries;
}

function readWebReleaseAssetManifest({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
} = {}) {
  const manifestPath = path.join(
    releaseAssetsDir,
    'web',
    RELEASE_ASSET_MANIFEST_FILE_NAME,
  );
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing web release asset manifest: ${manifestPath}`);
  }

  return {
    manifest: JSON.parse(readFileSync(manifestPath, 'utf8')),
    manifestPath,
  };
}

function assertWebManifestMatchesTarget({
  manifest,
  manifestPath,
}) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error(`Web release asset manifest must be a JSON object: ${manifestPath}`);
  }
  if (String(manifest.family ?? '').trim() !== 'web') {
    throw new Error(
      `Web release asset manifest family mismatch at ${manifestPath}: expected web, received ${manifest.family ?? 'unknown'}`,
    );
  }
  if (String(manifest.platform ?? '').trim()) {
    throw new Error(
      `Web release asset manifest platform must be empty for BirdCoder web assets: ${manifestPath}`,
    );
  }
  if (String(manifest.arch ?? '').trim()) {
    throw new Error(
      `Web release asset manifest arch must be empty for BirdCoder web assets: ${manifestPath}`,
    );
  }
}

function resolveArtifactAbsolutePath(releaseAssetsDir, relativePath) {
  const normalizedRelativePath = String(relativePath ?? '').trim();
  if (!normalizedRelativePath) {
    throw new Error('Web release asset manifest is missing archiveRelativePath.');
  }

  const absolutePath = path.resolve(releaseAssetsDir, normalizedRelativePath);
  const releaseAssetsRoot = path.resolve(releaseAssetsDir);
  if (
    absolutePath !== releaseAssetsRoot &&
    !absolutePath.startsWith(`${releaseAssetsRoot}${path.sep}`)
  ) {
    throw new Error(`Web release artifact resolves outside release assets directory: ${normalizedRelativePath}`);
  }
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing web release artifact at ${absolutePath}`);
  }

  return absolutePath;
}

function computeSha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function assertArtifactIntegrity({
  archivePath,
  manifest,
}) {
  const archiveRelativePath = String(manifest.archiveRelativePath ?? '').trim();
  const archiveArtifact = Array.isArray(manifest.artifacts)
    ? manifest.artifacts.find((artifact) =>
      String(artifact?.relativePath ?? '').trim() === archiveRelativePath)
    : undefined;
  if (!archiveArtifact) {
    throw new Error(`Web release manifest artifacts[] must include ${archiveRelativePath}.`);
  }

  const expectedSize = Number(archiveArtifact.size);
  const actualSize = statSync(archivePath).size;
  if (Number.isFinite(expectedSize) && expectedSize !== actualSize) {
    throw new Error(
      `Web release artifact size mismatch for ${archivePath}: manifest expected ${expectedSize}, received ${actualSize}.`,
    );
  }

  return computeSha256(archivePath);
}

function requireEntry(entries, entryPath, description) {
  if (!entries.has(entryPath)) {
    throw new Error(`Web release archive is missing ${description}: ${entryPath}`);
  }

  return entries.get(entryPath);
}

function hasEntryUnder(entries, prefix) {
  for (const [entryPath, entry] of entries.entries()) {
    if (entryPath.startsWith(prefix) && (entry?.type === '0' || entry?.type === '')) {
      return true;
    }
  }

  return false;
}

function collectPublicDocsAssetPaths({
  publicDir = path.join(rootDir, 'docs', 'public'),
} = {}) {
  const assetPaths = new Set();
  if (!existsSync(publicDir)) {
    return assetPaths;
  }

  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      assetPaths.add(path.relative(publicDir, absolutePath).replaceAll('\\', '/'));
    }
  };

  visit(publicDir);
  return assetPaths;
}

function isDirectoryEntry(entryPath, entry) {
  return entryPath.endsWith('/') || entry?.type === '5';
}

function isAllowedPublicInternalDocsAsset(docsRelativePath, publicDocsAssetPaths) {
  const normalizedPath = normalizeArchiveEntryPath(docsRelativePath);
  const extension = path.posix.extname(normalizedPath).toLowerCase();
  return PUBLIC_INTERNAL_DOC_ASSET_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))
    && PUBLIC_DOC_ASSET_EXTENSIONS.has(extension)
    && publicDocsAssetPaths.has(normalizedPath);
}

function parseSearchIndex(entry, entryPath) {
  try {
    const parsed = JSON.parse(entry.content.toString('utf8'));
    if (!Array.isArray(parsed)) {
      throw new Error('search index is not an array');
    }

    return parsed;
  } catch (error) {
    throw new Error(
      `Web release archive has an invalid docs search index at ${entryPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function assertPublicDocsBoundary({
  entries,
  bundleRoot,
  searchIndex,
}) {
  const docsRootPrefix = `${bundleRoot}/docs/`;
  const docsSourcePrefix = `${bundleRoot}/docs-source/`;
  const publicDocsAssetPaths = collectPublicDocsAssetPaths();

  if (hasEntryUnder(entries, docsSourcePrefix)) {
    throw new Error(`Web release archive must not include docs source payloads under ${docsSourcePrefix}`);
  }

  for (const [entryPath, entry] of entries.entries()) {
    if (!entryPath.startsWith(docsRootPrefix)) {
      continue;
    }

    const docsRelativePath = entryPath.slice(docsRootPrefix.length);
    const internalPrefix = INTERNAL_DOC_PREFIXES.find((prefix) => docsRelativePath.startsWith(prefix));
    if (!internalPrefix) {
      continue;
    }
    if (
      isDirectoryEntry(entryPath, entry) ||
      isAllowedPublicInternalDocsAsset(docsRelativePath, publicDocsAssetPaths)
    ) {
      continue;
    }

    throw new Error(
      `Web release archive must not include internal documentation path: ${entryPath}`,
    );
  }

  for (const record of searchIndex) {
    const url = String(record?.url ?? '').replace(/^\/+/, '');
    const internalPrefix = INTERNAL_DOC_PREFIXES.find((prefix) => url.startsWith(prefix));
    if (internalPrefix) {
      throw new Error(
        `Web release docs search index must not include internal documentation URL: /${url}`,
      );
    }
  }
}

function buildBundleRoot(manifest) {
  const archiveName = path.posix.basename(String(manifest.archiveRelativePath ?? '').replaceAll('\\', '/'));
  if (!archiveName.endsWith('.tar.gz')) {
    throw new Error(`Web release artifact must be a .tar.gz archive: ${archiveName}`);
  }

  return archiveName.slice(0, -'.tar.gz'.length);
}

export async function smokeWebReleaseAssets({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
} = {}) {
  const { manifest, manifestPath } = readWebReleaseAssetManifest({
    releaseAssetsDir,
  });
  assertWebManifestMatchesTarget({
    manifest,
    manifestPath,
  });

  const archivePath = resolveArtifactAbsolutePath(
    releaseAssetsDir,
    manifest.archiveRelativePath,
  );
  assertArtifactIntegrity({
    archivePath,
    manifest,
  });

  const entries = readTarGzEntries(archivePath);
  const bundleRoot = buildBundleRoot(manifest);
  const appIndexPath = `${bundleRoot}/app/index.html`;
  const appAssetsPrefix = `${bundleRoot}/app/assets/`;
  const docsIndexPath = `${bundleRoot}/docs/index.html`;
  const docsNotFoundPath = `${bundleRoot}/docs/404.html`;
  const docsSearchIndexPath = `${bundleRoot}/docs/search-index.json`;

  requireEntry(entries, appIndexPath, 'app/index.html');
  if (!hasEntryUnder(entries, appAssetsPrefix)) {
    throw new Error(`Web release archive is missing built browser assets under ${appAssetsPrefix}`);
  }
  requireEntry(entries, docsIndexPath, 'docs/index.html');
  requireEntry(entries, docsNotFoundPath, 'docs/404.html');
  const searchIndex = parseSearchIndex(
    requireEntry(entries, docsSearchIndexPath, 'docs/search-index.json'),
    docsSearchIndexPath,
  );
  assertPublicDocsBoundary({
    entries,
    bundleRoot,
    searchIndex,
  });

  const artifactRelativePaths = Array.isArray(manifest.artifacts)
    ? manifest.artifacts
      .map((artifact) => String(artifact?.relativePath ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    : [];
  const report = writeReleaseSmokeReport({
    releaseAssetsDir,
    family: 'web',
    platform: 'web',
    arch: 'any',
    smokeKind: 'web-archive-content',
    status: 'passed',
    manifestPath,
    artifactRelativePaths,
    checks: [
      {
        id: 'artifact-integrity',
        status: 'passed',
        detail: 'archive is present, bounded to release assets, and matches manifest metadata',
      },
      {
        id: 'app-index',
        status: 'passed',
        detail: 'app/index.html is present in the archive',
      },
      {
        id: 'app-assets',
        status: 'passed',
        detail: 'app/assets contains browser assets',
      },
      {
        id: 'docs-index',
        status: 'passed',
        detail: 'docs/index.html is present in the archive',
      },
      {
        id: 'docs-404',
        status: 'passed',
        detail: 'docs/404.html is present in the archive',
      },
      {
        id: 'docs-search-index',
        status: 'passed',
        detail: 'docs/search-index.json is present and parseable',
      },
      {
        id: 'public-doc-boundary',
        status: 'passed',
        detail: 'docs excludes source and internal-only documentation directories',
      },
    ],
  });

  return {
    arch: 'any',
    archivePath,
    manifest,
    manifestPath,
    platform: 'web',
    report,
  };
}

export function parseArgs(argv) {
  const options = {
    releaseAssetsDir: DEFAULT_RELEASE_ASSETS_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = resolveCliPath(
        readOptionValue(argv, index, '--release-assets-dir'),
      );
      index += 1;
    }
  }

  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const result = await smokeWebReleaseAssets(parseArgs(argv));
  console.log(
    `Smoke-verified packaged web archive at ${path.relative(process.cwd(), result.archivePath) || result.archivePath}.`,
  );
  return result;
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
