#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const scanRoots = [
  'apps',
  'crates',
  'scripts',
  'configs',
  'docs',
  'specs',
  'sdks',
  'README.md',
  'AGENTS.md',
];

const skipPathFragments = [
  '/target/',
  '/node_modules/',
  '/generated/',
  '/dist/',
  '/external/',
  'sdkwork-birdcoder-topology-baggage.test.mjs',
  'docs/architecture/topology-standard.md',
  'scripts/birdcoder-iam-env.mjs',
  'scripts/lib/birdcoder-topology.mjs',
];

const allowlistPathFragments = ['specs/topology.spec.json'];

const bannedPatterns = [
  { id: 'topology v1 env key', pattern: /SDKWORK_BIRDCODER_TOPOLOGY/u },
  { id: 'client topology v1 env key', pattern: /VITE_BIRDCODER_TOPOLOGY/u },
  { id: 'client topology v1 sdkwork env key', pattern: /VITE_SDKWORK_BIRDCODER_TOPOLOGY/u },
  { id: 'topology CLI flag', pattern: /--topology\b/u },
  { id: 'legacy root server package path', pattern: /packages\/sdkwork-birdcoder-server/u },
];

function slash(value) {
  return String(value).replaceAll('\\', '/');
}

function shouldSkip(relativePath) {
  const normalized = slash(relativePath);
  return skipPathFragments.some((fragment) => normalized.includes(fragment));
}

function isAllowlisted(relativePath) {
  const normalized = slash(relativePath);
  return allowlistPathFragments.some((fragment) => normalized.endsWith(fragment));
}

function isTextCandidate(relativePath) {
  return /\.(?:md|mjs|json|yml|yaml|toml|rs|ps1|sh|cmd|ts|tsx|env(?:\.example)?|txt)$/u.test(
    slash(relativePath),
  );
}

function collectFiles(relativeRoot) {
  const absoluteRoot = path.join(repoRoot, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) {
    return [];
  }
  const stat = fs.statSync(absoluteRoot);
  if (stat.isFile()) {
    return stat.isFile() ? [relativeRoot] : [];
  }
  const files = [];
  for (const entry of fs.readdirSync(absoluteRoot, { withFileTypes: true })) {
    const relativePath = path.join(relativeRoot, entry.name);
    if (shouldSkip(relativePath)) {
      continue;
    }
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...collectFiles(relativePath));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    files.push(relativePath);
  }
  return files;
}

function readText(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  const stat = fs.statSync(absolutePath);
  if (!stat.isFile()) {
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

const files = scanRoots
  .flatMap((root) => collectFiles(root))
  .filter((relativePath) => isTextCandidate(relativePath));

for (const { id, pattern } of bannedPatterns) {
  const hits = [];
  for (const relativePath of files) {
    if (isAllowlisted(relativePath)) {
      continue;
    }
    const text = readText(relativePath);
    if (pattern.test(text)) {
      hits.push(relativePath);
    }
  }
  assert.equal(
    hits.length,
    0,
    `topology baggage (${id}) found in active paths: ${hits.join(', ')}`,
  );
}

assert.ok(fs.existsSync(path.join(repoRoot, 'specs/topology.spec.json')), 'topology spec required');
const spec = JSON.parse(readText('specs/topology.spec.json'));
assert.equal(spec.schemaVersion, 4);
assert.equal(spec.archetype, 'application-http-gateway');
assert.equal(spec.defaults.developmentProfileId, 'standalone.development');

const profileDir = path.join(repoRoot, 'etc/topology');
const profileFiles = fs.readdirSync(profileDir).filter((name) => name.endsWith('.env'));
assert.ok(profileFiles.length >= 2, 'topology profile env files required');

const packageJson = JSON.parse(readText('package.json'));
assert.match(
  JSON.stringify(packageJson.dependencies ?? {}),
  /"@sdkwork\/app-topology"/u,
  'package.json must depend on @sdkwork/app-topology',
);
assert.match(
  JSON.stringify(packageJson.scripts ?? {}),
  /birdcoder:dev/u,
  'package.json must expose birdcoder:dev',
);
assert.match(
  JSON.stringify(packageJson.scripts ?? {}),
  /check:topology-standard/u,
  'package.json must expose check:topology-standard',
);

assert.ok(fs.existsSync(path.join(repoRoot, 'scripts/birdcoder-dev.mjs')), 'birdcoder-dev orchestrator required');
assert.ok(
  fs.existsSync(path.join(repoRoot, 'scripts/lib/birdcoder-topology.mjs')),
  'birdcoder topology adapter required',
);
assert.ok(
  fs.existsSync(path.join(repoRoot, 'docs/architecture/topology-standard.md')),
  'topology-standard doc required',
);

console.log('[sdkwork-birdcoder-topology-baggage] ok');
