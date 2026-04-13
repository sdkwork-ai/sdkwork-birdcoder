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

function resolveSnapshotFileName(): string {
  return path.posix.basename(BIRDCODER_CODING_SERVER_OPENAPI_PATH) || 'coding-server-v1.json';
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
  const outputPath = resolveBirdCoderCodingServerOpenApiSnapshotPath(options);
  const document = buildBirdCoderCodingServerOpenApiDocument(options.distributionId ?? 'global');

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

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
