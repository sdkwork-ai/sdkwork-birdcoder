import type {
  NativeApplicationPublishApplicationSnapshot,
  NativeApplicationPublishPreflightSnapshot,
  NativeApplicationPublishTargetSnapshot,
} from './applicationPublishHostContract.ts';
import type {
  ApplicationPublishFramework,
  ApplicationPublishPreflightCheck,
  ApplicationPublishReadiness,
  ApplicationPublishTarget,
  PublishableApplication,
} from './interfaces/IApplicationPublishService.ts';

function mapFramework(
  applicationKind: string,
  framework?: string,
): ApplicationPublishFramework {
  switch (applicationKind) {
    case 'flutter':
      return 'flutter';
    case 'mini-program':
      return 'mini-program';
    case 'react':
      return 'react';
    case 'static-web':
      return 'static-web';
    case 'vue':
      return 'vue';
    case 'sdkwork-app':
    case 'sdkwork-module':
      return 'sdkwork';
    default:
      break;
  }

  const normalized = framework?.trim().toLowerCase() ?? '';
  if (normalized.includes('flutter')) return 'flutter';
  if (normalized.includes('mini-program') || normalized.includes('miniprogram')) {
    return 'mini-program';
  }
  if (normalized.includes('react')) return 'react';
  if (normalized.includes('static')) return 'static-web';
  if (normalized.includes('vue')) return 'vue';
  return 'unknown';
}

function mapReadiness(value: string): ApplicationPublishReadiness {
  if (value === 'ready') return 'ready';
  if (value === 'setupRequired') return 'setup_required';
  return 'unsupported';
}

function mapTarget(target: NativeApplicationPublishTargetSnapshot): ApplicationPublishTarget {
  return {
    command: target.command,
    cwd: target.cwd,
    id: target.id,
    name: target.label,
    outputs: target.outputs.map((output) => ({
      archive: output.archive === 'zip' ? 'zip' : undefined,
      fileName: output.fileName,
      path: output.path,
      type: output.outputType,
    })),
    packageId: target.packageId,
    readiness: target.ready ? 'ready' : 'setup_required',
    setupIssues: [...target.issues],
  };
}

function manifestRelativePath(
  application: NativeApplicationPublishApplicationSnapshot,
): string | undefined {
  if (application.manifestStatus !== 'valid') {
    return undefined;
  }
  return application.relativePath === '.'
    ? 'sdkwork.app.config.json'
    : `${application.relativePath}/sdkwork.app.config.json`;
}

export function mapPublishableApplication(
  application: NativeApplicationPublishApplicationSnapshot,
): PublishableApplication {
  return {
    appKey: application.appKey,
    framework: mapFramework(application.kind, application.framework),
    manifestRelativePath: manifestRelativePath(application),
    name: application.name,
    readiness: mapReadiness(application.publishStatus),
    relativePath: application.relativePath,
    setupIssues: [...application.issues],
    targets: application.targets.map(mapTarget),
  };
}

export function isApplicationCollectionWorkspace(
  applications: readonly NativeApplicationPublishApplicationSnapshot[],
): boolean {
  return applications.some((application) =>
    application.kind === 'sdkwork-module'
    || application.relativePath === 'apps'
    || application.relativePath.startsWith('apps/'));
}

export function buildApplicationPublishPreflightChecks(
  snapshot: NativeApplicationPublishPreflightSnapshot,
): ApplicationPublishPreflightCheck[] {
  return [
    {
      code: 'manifest_valid',
      message: 'The SDKWork application manifest is valid and bound to this publish plan.',
      status: 'passed',
    },
    {
      code: 'application_identity',
      message: snapshot.appKey
        ? 'The application key provides the stable Deploy Site identity.'
        : 'This legacy manifest has no application key; a deterministic compatibility identity will be used.',
      status: snapshot.appKey ? 'passed' : 'warning',
    },
    {
      code: 'target_ready',
      message: 'The selected build command, package id, and declared outputs passed native preflight.',
      status: snapshot.target.ready && Boolean(snapshot.target.packageId)
        ? 'passed'
        : 'failed',
    },
    {
      code: 'single_release_artifact',
      message: snapshot.target.outputs.length === 1
        ? 'The target declares one immutable release artifact.'
        : 'A publish target must declare exactly one immutable release artifact.',
      status: snapshot.target.outputs.length === 1 ? 'passed' : 'failed',
    },
  ];
}
