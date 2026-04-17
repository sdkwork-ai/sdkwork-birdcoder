import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  BIRDCODER_CODING_SERVER_OPENAPI_PATH,
  buildBirdCoderCodingServerOpenApiDocument,
  type BirdServerDistributionId,
} from '../packages/sdkwork-birdcoder-server/src/index.ts';

export interface ResolveBirdCoderCodingServerOpenApiSnapshotPathOptions {
  outputPath?: string;
  rootDir?: string;
}

export interface WriteBirdCoderCodingServerOpenApiSnapshotOptions
  extends ResolveBirdCoderCodingServerOpenApiSnapshotPathOptions {
  distributionId?: BirdServerDistributionId;
}

export interface BirdCoderCodingServerOpenApiSnapshotWriteResult {
  document: ReturnType<typeof buildBirdCoderCodingServerOpenApiDocument>;
  outputPath: string;
}

interface ReleaseManifestCodingServerOpenApiEvidence {
  canonicalRelativePath?: string;
  mirroredRelativePaths?: string[];
  sha256?: string;
  openapi?: string;
  version?: string;
  title?: string;
}

interface ReleaseManifestShape {
  codingServerOpenApiEvidence?: ReleaseManifestCodingServerOpenApiEvidence;
}

function resolveSnapshotFileName(): string {
  return path.posix.basename(BIRDCODER_CODING_SERVER_OPENAPI_PATH) || 'coding-server-v1.json';
}

function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function normalizeRelativeReleasePath(value: string | undefined): string | null {
  const normalizedValue = String(value ?? '').trim().replaceAll('\\', '/');
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function syncReleaseOpenApiSidecars(rootDir: string, serializedDocument: string): void {
  const releaseAssetsDir = path.join(rootDir, 'artifacts', 'release');
  const manifestPath = path.join(releaseAssetsDir, 'release-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ReleaseManifestShape;
  const evidence = manifest.codingServerOpenApiEvidence;
  if (!evidence) {
    return;
  }

  const relativePaths = Array.from(
    new Set(
      [
        normalizeRelativeReleasePath(evidence.canonicalRelativePath),
        ...(Array.isArray(evidence.mirroredRelativePaths)
          ? evidence.mirroredRelativePaths.map(normalizeRelativeReleasePath)
          : []),
      ].filter((value): value is string => value !== null),
    ),
  );

  for (const relativePath of relativePaths) {
    const absolutePath = path.resolve(releaseAssetsDir, ...relativePath.split('/'));
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, serializedDocument, 'utf8');
  }

  const parsedDocument = JSON.parse(serializedDocument) as {
    info?: { title?: string; version?: string };
    openapi?: string;
  };
  evidence.sha256 = computeSha256(serializedDocument);
  evidence.openapi = String(parsedDocument.openapi ?? '').trim();
  evidence.version = String(parsedDocument.info?.version ?? '').trim();
  evidence.title = String(parsedDocument.info?.title ?? '').trim();
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export function resolveBirdCoderCodingServerOpenApiSnapshotPath(
  options: ResolveBirdCoderCodingServerOpenApiSnapshotPathOptions = {},
): string {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const targetPath =
    options.outputPath ??
    path.join(rootDir, 'artifacts', 'openapi', resolveSnapshotFileName());

  return path.resolve(rootDir, targetPath);
}

export function writeBirdCoderCodingServerOpenApiSnapshot(
  options: WriteBirdCoderCodingServerOpenApiSnapshotOptions = {},
): BirdCoderCodingServerOpenApiSnapshotWriteResult {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const outputPath = resolveBirdCoderCodingServerOpenApiSnapshotPath({
    ...options,
    rootDir,
  });
  const document = buildBirdCoderCodingServerOpenApiDocument(options.distributionId ?? 'global');
  const serializedDocument = `${JSON.stringify(document, null, 2)}\n`;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serializedDocument, 'utf8');
  syncReleaseOpenApiSidecars(rootDir, serializedDocument);

  return {
    document,
    outputPath,
  };
}

function readOptionValue(argv: string[], index: number, flag: string): string {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();
  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

export function parseArgs(
  argv: string[] = process.argv.slice(2),
): WriteBirdCoderCodingServerOpenApiSnapshotOptions {
  const options: WriteBirdCoderCodingServerOpenApiSnapshotOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--output') {
      options.outputPath = readOptionValue(argv, index, '--output');
      index += 1;
      continue;
    }
    if (token === '--distribution') {
      options.distributionId = readOptionValue(argv, index, '--distribution') as BirdServerDistributionId;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = writeBirdCoderCodingServerOpenApiSnapshot(parseArgs());
  console.log(
    JSON.stringify(
      {
        outputPath: result.outputPath,
        openapi: result.document.openapi,
        version: result.document.info.version,
      },
      null,
      2,
    ),
  );
}
