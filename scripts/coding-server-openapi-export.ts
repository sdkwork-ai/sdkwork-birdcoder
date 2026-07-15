import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { sha256Value } from './sdkwork-utils-digest.mjs';

import {
  BIRDCODER_CODING_SERVER_OPENAPI_PATH,
  buildBirdCoderCodingServerOpenApiDocument,
  type BirdServerDistributionId,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/index.ts';

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

interface DeploymentOpenApiSidecar {
  artifactRelativePath: string;
  manifestRelativePath: string;
  openApiRelativePath: string;
}

interface DeploymentReleaseAssetManifest {
  artifacts?: Array<{
    relativePath?: string;
    size?: number;
  }>;
}

const DEPLOYMENT_OPENAPI_SIDECARS: readonly DeploymentOpenApiSidecar[] = [
  {
    artifactRelativePath: 'server/windows/x64/openapi/coding-server-v1.json',
    manifestRelativePath: 'deployments/server-windows/x64/release-asset-manifest.json',
    openApiRelativePath: 'deployments/server-windows/x64/openapi/coding-server-v1.json',
  },
  {
    artifactRelativePath: 'server/win32/x64/openapi/coding-server-v1.json',
    manifestRelativePath: 'deployments/server-win32/x64/release-asset-manifest.json',
    openApiRelativePath: 'deployments/server-win32/x64/openapi/coding-server-v1.json',
  },
];

function resolveSnapshotFileName(): string {
  return path.posix.basename(BIRDCODER_CODING_SERVER_OPENAPI_PATH) || 'coding-server-v1.json';
}

function computeSha256(content: string): string {
  return sha256Value(content);
}

function normalizeRelativeReleasePath(value: string | undefined): string | null {
  const normalizedValue = String(value ?? '').trim().replaceAll('\\', '/');
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function refreshDeploymentOpenApiSidecarManifest(
  rootDir: string,
  sidecar: DeploymentOpenApiSidecar,
): void {
  const manifestPath = path.join(rootDir, sidecar.manifestRelativePath);
  if (!fs.existsSync(manifestPath)) {
    return;
  }

  const manifestSource = fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/u, '');
  const manifest = JSON.parse(manifestSource) as DeploymentReleaseAssetManifest;
  if (!Array.isArray(manifest.artifacts)) {
    throw new Error(`Deployment release manifest is missing artifacts: ${manifestPath}`);
  }

  const expectedArtifactPath = normalizeRelativeReleasePath(sidecar.artifactRelativePath);
  if (!expectedArtifactPath) {
    throw new Error(`Deployment OpenAPI sidecar has no artifact path: ${sidecar.openApiRelativePath}`);
  }
  const matchingArtifacts = manifest.artifacts.filter(
    (artifact) => normalizeRelativeReleasePath(artifact.relativePath) === expectedArtifactPath,
  );
  if (matchingArtifacts.length !== 1) {
    throw new Error(
      `Deployment release manifest must contain one OpenAPI sidecar artifact: ${manifestPath}`,
    );
  }

  const [openApiArtifact] = matchingArtifacts;
  if (!openApiArtifact) {
    throw new Error(`Deployment release manifest OpenAPI sidecar is unavailable: ${manifestPath}`);
  }

  const openApiPath = path.join(rootDir, sidecar.openApiRelativePath);
  openApiArtifact.size = fs.statSync(openApiPath).size;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function syncDeploymentOpenApiMirrors(rootDir: string, serializedDocument: string): void {
  for (const sidecar of DEPLOYMENT_OPENAPI_SIDECARS) {
    const absolutePath = path.join(rootDir, sidecar.openApiRelativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, serializedDocument, 'utf8');
    refreshDeploymentOpenApiSidecarManifest(rootDir, sidecar);
  }
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
  syncDeploymentOpenApiMirrors(rootDir, serializedDocument);
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
