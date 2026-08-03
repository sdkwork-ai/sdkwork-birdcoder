#!/usr/bin/env node
// Publishes a finalized BirdCoder release archive through the SDKWork Deploy
// control plane (sdkwork-deployments App SDK publisher). The publisher
// resolves-or-creates a Deploy site, uploads the immutable release archive to
// Drive, registers the artifact (SHA-256), and records the release — the same
// pipeline the studio publish UI uses.
//
// Run through tsx (node scripts/run-local-tsx.mjs scripts/release/publish-release.ts ...)
// because the SDK packages export TypeScript sources directly.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createClient as createDeployAppClient } from '@sdkwork/deployments-app-sdk';
import {
  createDeployApplicationPublisher,
  type ApplicationPublishProgress,
  type ApplicationPublishResult,
} from '@sdkwork/deployments-app-sdk/application-publisher';
import { createDriveAppClient } from '@sdkwork/drive-app-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '../..');

const SITE_TYPE_SPA = 2;
const PACKAGE_TYPE_STATIC = 2;
const DEPLOY_TYPE_UPLOADED_ARTIFACT = 1;
const DEFAULT_ENVIRONMENT = 'development';
const DEFAULT_FAMILY = 'web';
const DEFAULT_SLUG = 'sdkwork-birdcoder';

const PROFILE_PATTERN = /^(standalone|cloud)$/u;
const ENVIRONMENT_PATTERN = /^(development|test|staging|production)$/u;

interface PublishOptions {
  releaseAssetsDir: string;
  family: string;
  deploymentProfile: string;
  environment: string;
  baseUrl?: string;
  siteId?: string;
  siteSlug: string;
  versionTag?: string;
  accessToken?: string;
  authToken?: string;
  deploy: boolean;
  commitHash?: string;
  dryRun: boolean;
  outputPath: string;
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function readOptionValue(argv: string[], index: number, flag: string): string {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();
  if (!normalizedNext || normalizedNext.startsWith('--')) {
    fail(`Missing value for ${flag}.`);
  }
  return normalizedNext;
}

function parseOptions(argv: string[]): PublishOptions {
  let releaseAssetsDir = path.join(WORKSPACE_ROOT, 'artifacts', 'release');
  let family = DEFAULT_FAMILY;
  let deploymentProfile = 'standalone';
  let environment = DEFAULT_ENVIRONMENT;
  let baseUrl: string | undefined;
  let siteId: string | undefined;
  let siteSlug = DEFAULT_SLUG;
  let versionTag: string | undefined;
  let accessToken: string | undefined;
  let authToken: string | undefined;
  let deploy = false;
  let commitHash: string | undefined;
  let dryRun = false;
  let outputPath = path.join(releaseAssetsDir, 'publish-evidence.json');

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    switch (flag) {
      case '--release-assets-dir':
        releaseAssetsDir = readOptionValue(argv, index, flag);
        index += 1;
        break;
      case '--family':
        family = readOptionValue(argv, index, flag);
        index += 1;
        break;
      case '--deployment-profile':
        deploymentProfile = readOptionValue(argv, index, flag);
        index += 1;
        break;
      case '--environment':
        environment = readOptionValue(argv, index, flag);
        index += 1;
        break;
      case '--base-url':
        baseUrl = readOptionValue(argv, index, flag);
        index += 1;
        break;
      case '--site-id':
        siteId = readOptionValue(argv, index, flag);
        index += 1;
        break;
      case '--site-slug':
        siteSlug = readOptionValue(argv, index, flag);
        index += 1;
        break;
      case '--version-tag':
        versionTag = readOptionValue(argv, index, flag);
        index += 1;
        break;
      case '--access-token':
        accessToken = readOptionValue(argv, index, flag);
        index += 1;
        break;
      case '--auth-token':
        authToken = readOptionValue(argv, index, flag);
        index += 1;
        break;
      case '--commit-hash':
        commitHash = readOptionValue(argv, index, flag);
        index += 1;
        break;
      case '--output':
        outputPath = readOptionValue(argv, index, flag);
        index += 1;
        break;
      case '--deploy':
        deploy = true;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '-h':
      case '--help': {
        console.log(`Usage: publish-release.ts [options]

Publishes a finalized release archive through the SDKWork Deploy control plane.

Options:
  --release-assets-dir <dir>   Release assets root (default: artifacts/release)
  --family <family>            Release family to publish (default: web)
  --deployment-profile <p>     standalone | cloud (default: standalone)
  --environment <env>          development | test | staging | production (default: development)
  --base-url <url>             Deploy App API base URL (default: resolved from etc/sdkwork.deployment.config.json)
  --site-id <id>               Publish to an existing Deploy site
  --site-slug <slug>           Deploy site slug when creating a site (default: sdkwork-birdcoder)
  --version-tag <tag>          Release version tag (default: release manifest releaseTag)
  --access-token <token>       Dual-token access token (env: SDKWORK_CLI_ACCESS_TOKEN)
  --auth-token <token>         Dual-token auth token (env: SDKWORK_CLI_AUTH_TOKEN)
  --deploy                     Also create an uploaded-artifact deployment record
  --commit-hash <hash>         Optional commit hash for the deployment record
  --dry-run                    Validate and build the publish request without uploading
  --output <path>              Publish evidence output (default: <release-assets-dir>/publish-evidence.json)`);
        process.exit(0);
      }
      default:
        fail(`Unknown option: ${flag}`);
    }
  }

  if (!PROFILE_PATTERN.test(deploymentProfile)) {
    fail(`Invalid --deployment-profile: ${deploymentProfile}; expected standalone or cloud.`);
  }
  if (!ENVIRONMENT_PATTERN.test(environment)) {
    fail(
      `Invalid --environment: ${environment}; expected development, test, staging, or production.`,
    );
  }

  const normalizedSlug = siteSlug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/u.test(normalizedSlug) || normalizedSlug.length > 100) {
    fail(`Invalid --site-slug: ${siteSlug}; must be a stable lowercase slug.`);
  }

  return {
    releaseAssetsDir: path.resolve(releaseAssetsDir),
    family: family.trim().toLowerCase(),
    deploymentProfile,
    environment,
    baseUrl,
    siteId: siteId?.trim() || undefined,
    siteSlug: normalizedSlug,
    versionTag: versionTag?.trim() || undefined,
    accessToken: accessToken ?? process.env.SDKWORK_CLI_ACCESS_TOKEN,
    authToken: authToken ?? process.env.SDKWORK_CLI_AUTH_TOKEN,
    deploy,
    commitHash: commitHash?.trim() || undefined,
    dryRun,
    outputPath: path.resolve(outputPath),
  };
}

interface ReleaseFamilyManifest {
  family: string;
  releaseTag?: string;
  archiveRelativePath?: string;
  artifacts?: Array<{ relativePath?: string; size?: number }>;
}

function readFamilyManifest(options: PublishOptions): ReleaseFamilyManifest {
  const manifestPath = path.join(options.releaseAssetsDir, options.family, 'release-asset-manifest.json');
  if (!existsSync(manifestPath)) {
    fail(
      `Missing release family manifest: ${manifestPath}. Run release:package:${options.family} first.`,
    );
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ReleaseFamilyManifest;
  if (manifest.family !== options.family) {
    fail(`Release family manifest ${manifestPath} does not describe family ${options.family}.`);
  }
  return manifest;
}

function resolveArchivePath(options: PublishOptions, manifest: ReleaseFamilyManifest): string {
  const relativePath = manifest.archiveRelativePath ?? manifest.artifacts?.[0]?.relativePath;
  if (!relativePath) {
    fail(`Release family manifest has no archive artifact for family ${options.family}.`);
  }
  const archivePath = path.resolve(options.releaseAssetsDir, relativePath);
  if (!existsSync(archivePath)) {
    fail(`Missing release archive: ${archivePath}. Run release:package:${options.family} first.`);
  }
  return archivePath;
}

function sha256Buffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

interface DeploymentIndex {
  environments?: Record<
    string,
    { applicationOrigin?: string; cloudApiBaseUrl?: string }
  >;
}

function resolveBaseUrl(options: PublishOptions): string {
  if (options.baseUrl) {
    return options.baseUrl.replace(/\/+$/u, '');
  }
  const indexPath = path.join(WORKSPACE_ROOT, 'etc', 'sdkwork.deployment.config.json');
  if (!existsSync(indexPath)) {
    fail(`Missing deployment config index: ${indexPath}.`);
  }
  const index = JSON.parse(readFileSync(indexPath, 'utf8')) as DeploymentIndex;
  const environment = index.environments?.[options.environment];
  if (!environment) {
    fail(`Deployment config index has no environment entry: ${options.environment}.`);
  }
  // The Deploy App API is composed into the BirdCoder gateway itself
  // (api-assembly), so the publish target is the application origin. Local
  // development runs the gateway on 127.0.0.1:10240.
  const origin = options.environment === 'development'
    ? 'http://127.0.0.1:10240'
    : environment.applicationOrigin ?? environment.cloudApiBaseUrl;
  if (!origin) {
    fail(`Deployment config index declares no origin for environment ${options.environment}.`);
  }
  return origin.replace(/\/+$/u, '');
}

interface CliTokenManager {
  getAccessToken(): string | undefined;
  getAuthToken(): string | undefined;
  getRefreshToken(): string | undefined;
  getTokens(): { accessToken?: string; authToken?: string; refreshToken?: string };
  setTokens(): void;
  setAccessToken(): void;
  setAuthToken(): void;
  setRefreshToken(): void;
  clearTokens(): void;
  clearAuthToken(): void;
  clearAccessToken(): void;
  isExpired(): boolean;
  isValid(): boolean;
  hasToken(): boolean;
  hasAuthToken(): boolean;
  hasAccessToken(): boolean;
  willExpireIn(): boolean;
}

function createCliTokenManager(accessToken?: string, authToken?: string): CliTokenManager {
  return {
    getAccessToken: () => accessToken,
    getAuthToken: () => authToken,
    getRefreshToken: () => undefined,
    getTokens: () => ({ accessToken, authToken }),
    setTokens: () => undefined,
    setAccessToken: () => undefined,
    setAuthToken: () => undefined,
    setRefreshToken: () => undefined,
    clearTokens: () => undefined,
    clearAuthToken: () => undefined,
    clearAccessToken: () => undefined,
    isExpired: () => false,
    isValid: () => Boolean(accessToken || authToken),
    hasToken: () => Boolean(accessToken || authToken),
    hasAuthToken: () => Boolean(authToken),
    hasAccessToken: () => Boolean(accessToken),
    willExpireIn: () => false,
  };
}

function printProgress(progress: ApplicationPublishProgress): void {
  const prefix = `[publish:${progress.stage}]`;
  if (progress.kind === 'upload') {
    const percent = progress.totalBytes > 0
      ? Math.min(100, Math.round((progress.uploadedBytes / progress.totalBytes) * 100))
      : 0;
    console.log(`${prefix} ${percent}%`);
    return;
  }
  if (progress.kind === 'failure') {
    console.error(`${prefix} failed: ${progress.error.message}`);
    return;
  }
  console.log(`${prefix} ${progress.status ?? ''}`.trim());
}

async function run(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const manifest = readFamilyManifest(options);
  const archivePath = resolveArchivePath(options, manifest);
  const archiveSize = statSync(archivePath).size;
  const archiveBuffer = readFileSync(archivePath);
  const checksumSha256 = sha256Buffer(archiveBuffer);
  const versionTag = options.versionTag
    ?? manifest.releaseTag
    ?? '0.1.0';
  const baseUrl = resolveBaseUrl(options);

  console.log(`publish ${options.family} archive ${path.basename(archivePath)} (${archiveSize} bytes)`);
  console.log(`target ${options.deploymentProfile}.${options.environment} -> ${baseUrl}`);
  console.log(`checksum sha256:${checksumSha256}`);
  console.log(`versionTag ${versionTag}`);
  console.log(`site ${options.siteId ? `existing ${options.siteId}` : `resolve-or-create ${options.siteSlug}`}`);

  const request = {
    site: options.siteId
      ? { kind: 'existing' as const, siteId: options.siteId }
      : {
          kind: 'resolveOrCreate' as const,
          name: options.siteSlug,
          slug: options.siteSlug,
          description: 'SDKWork BirdCoder web application',
          siteType: SITE_TYPE_SPA,
        },
    artifact: {
      file: new Blob([archiveBuffer]),
      packageType: PACKAGE_TYPE_STATIC,
      fileName: path.basename(archivePath),
      contentType: 'application/gzip',
      checksumSha256,
      scene: 'deployment-package',
      source: 'birdcoder-release-publish',
    },
    release: { versionTag },
    deployment: options.deploy
      ? {
          deployType: DEPLOY_TYPE_UPLOADED_ARTIFACT,
          versionTag,
          environment: options.environment,
          ...(options.commitHash ? { commitHash: options.commitHash } : {}),
        }
      : undefined,
    idempotencyKeys: {
      site: `birdcoder-site-${options.siteSlug}`,
      artifact: `birdcoder-artifact-${checksumSha256}`,
      release: `birdcoder-release-${options.deploymentProfile}.${options.environment}-${versionTag}`,
      deployment: options.deploy
        ? `birdcoder-deployment-${options.deploymentProfile}.${options.environment}-${versionTag}`
        : undefined,
    },
  };

  if (options.dryRun) {
    console.log('[dry-run] publish request validated; no remote side effects executed.');
    return;
  }

  if (!options.accessToken && !options.authToken) {
    console.warn(
      'warning: no dual-token credentials provided (--access-token/--auth-token or '
      + 'SDKWORK_CLI_ACCESS_TOKEN/SDKWORK_CLI_AUTH_TOKEN); local development may proceed when '
      + 'the IAM dev auth fallback is enabled.',
    );
  }

  const tokenManager = createCliTokenManager(options.accessToken, options.authToken);
  const clientConfig = {
    authMode: 'dual-token' as const,
    baseUrl,
    platform: 'cli',
    tokenManager,
  };
  const deployClient = createDeployAppClient(clientConfig);
  const driveClient = createDriveAppClient(clientConfig);
  const publisher = createDeployApplicationPublisher({ deployClient, driveClient });

  let result: ApplicationPublishResult;
  try {
    result = await publisher.publish({
      ...request,
      onProgress: printProgress,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error ? (error as { cause?: unknown }).cause : undefined;
    const causeMessage = cause instanceof Error ? cause.message : undefined;
    fail(causeMessage && causeMessage !== message ? `publish failed: ${message} (${causeMessage})` : `publish failed: ${message}`);
  }

  const evidence = {
    publisher: '@sdkwork/deployments-app-sdk',
    publishedAt: new Date().toISOString(),
    deploymentProfile: options.deploymentProfile,
    environment: options.environment,
    baseUrl,
    family: options.family,
    archivePath: path.relative(WORKSPACE_ROOT, archivePath).split(path.sep).join('/'),
    checksumSha256,
    site: {
      id: result.site.id,
      resolution: result.site.resolution,
      slug: options.siteSlug,
    },
    artifact: {
      id: result.artifact.id,
      fileName: path.basename(archivePath),
      size: archiveSize,
    },
    release: {
      id: result.release.id,
      versionTag,
    },
    ...(result.deployment ? { deployment: { id: result.deployment.id } } : {}),
  };

  const outputDir = path.dirname(options.outputPath);
  if (!existsSync(outputDir)) {
    fail(`Evidence output directory does not exist: ${outputDir}.`);
  }
  await import('node:fs/promises').then((fs) => fs.writeFile(
    options.outputPath,
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  ));
  console.log(`site ${result.site.id} (${result.site.resolution})`);
  console.log(`artifact ${result.artifact.id}`);
  console.log(`release ${result.release.id} (${versionTag})`);
  if (result.deployment) {
    console.log(`deployment ${result.deployment.id}`);
  }
  console.log(`evidence ${options.outputPath}`);
}

run().catch((error) => {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
