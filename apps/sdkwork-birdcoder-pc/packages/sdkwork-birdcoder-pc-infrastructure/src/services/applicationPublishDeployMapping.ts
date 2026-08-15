import type { ApplicationPublishProgress as DeployApplicationPublishProgress } from '@sdkwork/birdcoder-pc-core';

import type {
  NativeApplicationPublishPreflightSnapshot,
  NativeApplicationPublishTargetSnapshot,
} from './applicationPublishHostContract.ts';
import {
  ApplicationPublishError,
  type ApplicationPublishProgress,
  type ApplicationPublishRequest,
} from './interfaces/IApplicationPublishService.ts';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;

// Frozen Deploy API enums: Site 1=static, 2=SPA, 6=custom;
// package 1=archive, 2=static; deployment 1=uploaded artifact.
const DEPLOY_SITE_TYPE_STATIC = 1;
const DEPLOY_SITE_TYPE_SPA = 2;
const DEPLOY_SITE_TYPE_CUSTOM = 6;
const DEPLOY_PACKAGE_TYPE_ARCHIVE = 1;
const DEPLOY_PACKAGE_TYPE_STATIC = 2;
export const DEPLOY_TYPE_UPLOAD = 1;

export interface NormalizedApplicationPublishRequest {
  deployAfterRelease: boolean;
  environment: string;
  planId: string;
  version: string;
}

export interface DeployApplicationSiteIdentity {
  description?: string;
  name: string;
  slug: string;
}

export function normalizeApplicationPublishRequest(
  request: ApplicationPublishRequest,
): NormalizedApplicationPublishRequest {
  const planId = request.planId?.trim();
  if (!planId) {
    throw new ApplicationPublishError(
      'preflight_failed',
      'A current application publish plan is required.',
    );
  }
  const version = request.version?.trim();
  if (!version || version.length > 100 || !SEMVER_PATTERN.test(version)) {
    throw new ApplicationPublishError(
      'preflight_failed',
      'The release version must be a valid Semantic Version with at most 100 characters.',
    );
  }
  const environment = request.environment?.trim();
  if (!environment || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(environment)) {
    throw new ApplicationPublishError(
      'preflight_failed',
      'The deployment environment must be a valid environment identifier.',
    );
  }
  if (request.releaseNotes?.trim()) {
    throw new ApplicationPublishError(
      'preflight_failed',
      'Release notes are not supported by the current immutable Deploy release contract.',
    );
  }
  return {
    deployAfterRelease: request.deployAfterRelease === true,
    environment,
    planId,
    version,
  };
}

function stableIdentityHash(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function applicationSiteSlug(snapshot: NativeApplicationPublishPreflightSnapshot): string {
  const appKey = snapshot.appKey?.trim();
  if (!appKey) {
    const legacyId = snapshot.applicationId.replace(/[^a-f0-9]/giu, '').toLowerCase();
    if (!legacyId) {
      throw new ApplicationPublishError(
        'preflight_failed',
        'The legacy application manifest does not expose a stable publish identity.',
      );
    }
    return `legacy-app-${legacyId.slice(0, 48)}`;
  }

  const normalizedKey = appKey.toLowerCase();
  let slug = normalizedKey
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9-]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '');
  if (slug !== normalizedKey || slug.length > 100) {
    const suffix = stableIdentityHash(appKey);
    slug = `${slug.slice(0, 90).replace(/-$/u, '') || 'app'}-${suffix}`;
  }
  if (slug.length < 2) {
    slug = `${slug || 'app'}-${stableIdentityHash(appKey)}`;
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/u.test(slug) || slug.length > 100) {
    throw new ApplicationPublishError(
      'preflight_failed',
      'The application key cannot be represented as a stable Deploy Site identity.',
    );
  }
  return slug;
}

export function resolveDeployApplicationSiteIdentity(
  snapshot: NativeApplicationPublishPreflightSnapshot,
): DeployApplicationSiteIdentity {
  const slug = applicationSiteSlug(snapshot);
  const displayName = snapshot.applicationName.trim();
  return {
    description: displayName && displayName !== slug
      ? displayName.slice(0, 500)
      : undefined,
    name: slug,
    slug,
  };
}

function isDeclaredWebTarget(target: NativeApplicationPublishTargetSnapshot): boolean {
  const runtimeTarget = target.runtimeTarget?.trim().toLowerCase();
  const platform = target.platform?.trim().toLowerCase();
  return runtimeTarget === 'browser'
    || runtimeTarget === 'web'
    || platform === 'web';
}

export function resolveDeploySiteType(
  snapshot: NativeApplicationPublishPreflightSnapshot,
): 1 | 2 | 6 {
  if (snapshot.applicationKind === 'static-web') {
    return DEPLOY_SITE_TYPE_STATIC;
  }
  if (
    snapshot.applicationKind === 'react'
    || snapshot.applicationKind === 'vue'
    || isDeclaredWebTarget(snapshot.target)
  ) {
    return DEPLOY_SITE_TYPE_SPA;
  }
  return DEPLOY_SITE_TYPE_CUSTOM;
}

export function resolveDeployPackageType(siteType: 1 | 2 | 6): number {
  return siteType === DEPLOY_SITE_TYPE_STATIC || siteType === DEPLOY_SITE_TYPE_SPA
    ? DEPLOY_PACKAGE_TYPE_STATIC
    : DEPLOY_PACKAGE_TYPE_ARCHIVE;
}

export function normalizeApplicationPublishSha256(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/^sha256:/u, '');
  if (!SHA256_PATTERN.test(normalized)) {
    throw new ApplicationPublishError(
      'invalid_host_response',
      'The staged artifact checksum is not a valid SHA-256 digest.',
    );
  }
  return normalized;
}

function publicStage(
  stage: DeployApplicationPublishProgress['stage'],
): ApplicationPublishProgress['stage'] | undefined {
  switch (stage) {
    case 'uploadArchive':
      return 'uploading';
    case 'registerArtifact':
      return 'registering';
    case 'createRelease':
      return 'releasing';
    case 'createDeployment':
      return 'deploying';
    case 'complete':
      return 'completed';
    case 'resolveSite':
    case 'createSite':
      return undefined;
  }
}

export function relayDeployApplicationPublishProgress(
  progress: DeployApplicationPublishProgress,
  emit: (progress: ApplicationPublishProgress) => void,
): boolean {
  const stage = publicStage(progress.stage);
  if (!stage) {
    return false;
  }
  if (progress.kind === 'upload') {
    const percent = progress.totalBytes > 0
      ? Math.min(100, Math.round((progress.uploadedBytes / progress.totalBytes) * 100))
      : 0;
    emit({ detail: progress.status, percent, stage });
    return false;
  }
  if (progress.kind === 'failure') {
    emit({ detail: progress.error.message, stage });
    return false;
  }
  if (stage === 'completed' && progress.status === 'completed') {
    emit({ percent: 100, stage });
    return true;
  }
  if (progress.status === 'started') {
    emit({ stage });
  }
  return false;
}
