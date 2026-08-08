#!/usr/bin/env node
/**
 * sdkwork-birdcoder package content standard checker (PACKAGING_SPEC §6/§7).
 *
 * Verifies an install package archive (tar.gz) or an unpacked package
 * directory against the packaging content standard:
 *   - forbidden content absent (node_modules/, .git/, target/, build state,
 *     secrets, dev env files, source trees, test fixtures)
 *   - required content present (gateway binary, portal dist, database
 *     modules, sdkwork.app.config.json, install-manifest.json)
 *   - staged gateway binary is a Linux ELF
 *   - install-manifest.json matches the archive (every file has path, size,
 *     sha256)
 *
 * Public script: `pnpm install:package:check:content`.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  EDGE_BINARY_BASENAME,
} from './plan-birdcoder-install-packages.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

// Forbidden content markers (PACKAGING_SPEC §2). Matching any marker under the
// package root is a validation failure.
const FORBIDDEN_PATH_MARKERS = [
  '/node_modules/',
  '/.git/',
  '/.svn/',
  '/.hg/',
  '/.sdkwork/',
  '/.github/',
  '/.vscode/',
  '/.idea/',
  '/target/',
  '/build/',
  '/dist/install-package-staging',
  '/dist/container-image-build',
  '/__pycache__/',
  '/.pnpm/',
  '/Pods/',
  '/.dart_tool/',
  '/.venv/',
  '/venv/',
  '/.cargo/',
];

const FORBIDDEN_FILE_NAMES = [
  '.env',
  '.env.local',
  '.env.release',
  '.env.development',
  '.env.production',
  '.env.test',
  '.env.postgres',
  '.dockerignore',
  '.gitignore',
  '.gitattributes',
  '.gitmodules',
  'CLAUDE.md',
  'GEMINI.md',
  'CODEX.md',
  'AGENTS.md',
  '.npmrc',
];

// Required entries that must exist in the package (PACKAGING_SPEC §3).
const REQUIRED_ENTRIES = [
  `bin/${EDGE_BINARY_BASENAME}`,
  'portal/dist/index.html',
  'sdkwork.app.config.json',
  'database-modules/sdkwork-iam/database/database.manifest.json',
  'database-modules/sdkwork-agents/database/database.manifest.json',
  'database-modules/sdkwork-models/database/database.manifest.json',
  'container/entrypoint',
  'container/Containerfile',
  'container/metadata.json',
  'INSTALL.md',
  'install-manifest.json',
];

function printHelp() {
  console.log(`Usage: node scripts/check-birdcoder-package-content.mjs [options]

Check an install package against the packaging content standard.

Options:
  --archive <path>   Install package tar.gz to inspect.
  --dir <path>       Unpacked package directory to inspect.
  --json             Print machine-readable JSON.
  -h, --help         Show this help.
`);
}

function parseArgs(argv = process.argv.slice(2)) {
  const settings = { archive: null, dir: null, json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--archive':
        settings.archive = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--dir':
        settings.dir = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--json':
        settings.json = true;
        break;
      case '-h':
      case '--help':
        settings.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!settings.archive && !settings.dir) {
    throw new Error('--archive or --dir is required');
  }
  return settings;
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function listDirectoryEntries(dirPath) {
  const entries = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const fullPath = path.join(dir, name);
      const relativePath = path.relative(dirPath, fullPath).replaceAll('\\', '/');
      const stat = statSync(fullPath);
      entries.push(relativePath);
      if (stat.isDirectory()) {
        walk(fullPath);
      }
    }
  };
  walk(dirPath);
  return entries;
}

function isForbidden(relativePath) {
  const normalized = `/${relativePath.replaceAll('\\', '/')}/`;
  if (FORBIDDEN_PATH_MARKERS.some((marker) => normalized.includes(marker))) {
    return true;
  }
  const basename = path.posix.basename(relativePath);
  return FORBIDDEN_FILE_NAMES.some((name) => basename === name);
}

function sha256Of(absolutePath) {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

function extractArchiveToTemp(archivePath) {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'birdcoder-pkg-check-'));
  execFileSync('tar', ['-xzf', archivePath, '-C', tempDir], { stdio: 'pipe' });
  return { tempDir, cleanup: () => rmSync(tempDir, { recursive: true, force: true }) };
}

function validateContent(entries, rootDirForHashes) {
  const issues = [];
  const present = new Set(entries);
  for (const required of REQUIRED_ENTRIES) {
    if (!present.has(required)) {
      issues.push(`missing required entry: ${required}`);
    }
  }
  for (const entry of entries) {
    if (isForbidden(entry)) {
      issues.push(`forbidden content: ${entry}`);
    }
  }

  // install-manifest.json cross-check (path, size, sha256) when hashing root
  // is available.
  if (rootDirForHashes && present.has('install-manifest.json')) {
    try {
      const manifest = JSON.parse(
        readFileSync(path.join(rootDirForHashes, 'install-manifest.json'), 'utf8'),
      );
      for (const file of manifest.files ?? []) {
        const absolutePath = path.join(rootDirForHashes, file.path);
        if (!existsSync(absolutePath)) {
          issues.push(`manifest entry missing on disk: ${file.path}`);
          continue;
        }
        if (statSync(absolutePath).size !== file.size) {
          issues.push(`manifest size mismatch: ${file.path}`);
        }
        if (sha256Of(absolutePath) !== file.sha256) {
          issues.push(`manifest sha256 mismatch: ${file.path}`);
        }
      }
    } catch (error) {
      issues.push(`install-manifest.json is invalid: ${error.message}`);
    }
  }

  // The gateway binary must be a Linux ELF (PACKAGING_SPEC §5.1).
  if (rootDirForHashes) {
    const gatewayPath = path.join(rootDirForHashes, 'bin', EDGE_BINARY_BASENAME);
    if (existsSync(gatewayPath)) {
      const buffer = readFileSync(gatewayPath);
      if (!(buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45
        && buffer[2] === 0x4c && buffer[3] === 0x46)) {
        issues.push(`gateway binary is not a Linux ELF: bin/${EDGE_BINARY_BASENAME}`);
      }
    }
  }

  return issues;
}

function main(argv = process.argv.slice(2)) {
  const settings = parseArgs(argv);
  if (settings.help) {
    printHelp();
    return 0;
  }

  let entries;
  let tempDir = null;
  let cleanup = null;
  let hashRoot;
  if (settings.archive) {
    const extraction = extractArchiveToTemp(path.resolve(settings.archive));
    tempDir = extraction.tempDir;
    cleanup = extraction.cleanup;
    entries = listDirectoryEntries(tempDir);
    hashRoot = tempDir;
  } else {
    const dir = path.resolve(settings.dir);
    entries = listDirectoryEntries(dir);
    hashRoot = dir;
  }

  const issues = validateContent(entries, hashRoot);
  const result = {
    ok: issues.length === 0,
    source: settings.archive ?? settings.dir,
    entryCount: entries.length,
    issues,
  };
  if (settings.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`[birdcoder-package-content] checked ${result.entryCount} entries from ${result.source}`);
    for (const issue of issues) {
      console.error(`[birdcoder-package-content]   ${issue}`);
    }
    console.log(`[birdcoder-package-content] ${result.ok ? 'PASS' : 'FAIL'}`);
  }
  if (cleanup) {
    cleanup();
  }
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'))) {
  process.exitCode = main();
}

export { main, validateContent };
