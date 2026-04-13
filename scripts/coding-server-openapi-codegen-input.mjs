import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  normalizeCodingServerOpenApiEvidenceSummary,
} from './release/coding-server-openapi-release-evidence.mjs';

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();
  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

export function parseArgs(argv) {
  const options = {
    releaseAssetsDir: path.join(process.cwd(), 'artifacts', 'release'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = path.resolve(readOptionValue(argv, index, '--release-assets-dir'));
      index += 1;
      continue;
    }
  }

  return options;
}

export function readCodingServerOpenApiCodegenInput({
  releaseAssetsDir = path.join(process.cwd(), 'artifacts', 'release'),
} = {}) {
  const manifestPath = path.join(releaseAssetsDir, 'release-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing finalized release manifest: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest.codingServerOpenApiEvidence) {
    throw new Error('Missing finalized manifest codingServerOpenApiEvidence summary.');
  }

  const summary = normalizeCodingServerOpenApiEvidenceSummary(manifest.codingServerOpenApiEvidence);
  const canonicalSnapshotPath = path.resolve(releaseAssetsDir, summary.canonicalRelativePath);
  if (!fs.existsSync(canonicalSnapshotPath)) {
    throw new Error(`Missing canonical coding-server OpenAPI snapshot: ${canonicalSnapshotPath}`);
  }

  return {
    releaseTag: String(manifest.releaseTag ?? '').trim(),
    manifestPath,
    canonicalRelativePath: summary.canonicalRelativePath,
    canonicalSnapshotPath,
    mirroredRelativePaths: summary.mirroredRelativePaths,
    targetCount: summary.targetCount,
    targets: summary.targets,
    sha256: summary.sha256,
    openapi: summary.openapi,
    version: summary.version,
    title: summary.title,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = readCodingServerOpenApiCodegenInput(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
