#!/usr/bin/env node

// Stages the SDKWork Models catalog (manifest + models tree) from the
// sdkwork-models workspace into artifacts/ so the desktop bundle can ship it
// as a tauri resource. The embedded gateway resolves it through
// SDKWORK_MODELS_CATALOG_ROOT at runtime; the root must own the
// `sdkwork-models.json` manifest.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const MODELS_REPO_ROOT = path.resolve(rootDir, '../sdkwork-models');
const MODELS_MANIFEST = path.join(MODELS_REPO_ROOT, 'sdkwork-models.json');
const MODELS_TREE = path.join(MODELS_REPO_ROOT, 'models');
const MODELS_TARGET_DIR = path.resolve(rootDir, 'artifacts/models-catalog');

if (!fs.existsSync(MODELS_MANIFEST) || !fs.existsSync(path.join(MODELS_TREE, 'index.json'))) {
  throw new Error(
    `SDKWork Models catalog source is missing (${MODELS_REPO_ROOT}). ` +
    'Resolve the sdkwork-models workspace sibling before bundling the desktop app.',
  );
}

fs.rmSync(MODELS_TARGET_DIR, { recursive: true, force: true });
fs.mkdirSync(MODELS_TARGET_DIR, { recursive: true });
fs.copyFileSync(MODELS_MANIFEST, path.join(MODELS_TARGET_DIR, 'sdkwork-models.json'));
fs.cpSync(MODELS_TREE, path.join(MODELS_TARGET_DIR, 'models'), { recursive: true });
console.log(`staged models catalog -> ${MODELS_TARGET_DIR}`);
