export type ApplicationPublishFramework =
  | 'flutter'
  | 'mini-program'
  | 'react'
  | 'sdkwork'
  | 'static-web'
  | 'unknown'
  | 'vue';

export type ApplicationPublishReadiness =
  | 'ready'
  | 'setup_required'
  | 'unsupported';

export type ApplicationPublishOutputType =
  | 'android-aab'
  | 'android-apk'
  | 'directory'
  | 'file'
  | 'flutter-web'
  | 'ios-ipa'
  | 'mini-program'
  | 'web';

export interface ApplicationPublishTargetOutput {
  archive?: 'zip';
  fileName: string;
  path: string;
  type: ApplicationPublishOutputType;
}

export interface ApplicationPublishTarget {
  command?: string;
  cwd?: string;
  id: string;
  name: string;
  outputs: ApplicationPublishTargetOutput[];
  packageId?: string;
  readiness: ApplicationPublishReadiness;
  setupIssues: string[];
}

export interface PublishableApplication {
  appKey?: string;
  framework: ApplicationPublishFramework;
  manifestRelativePath?: string;
  name: string;
  relativePath: string;
  readiness: ApplicationPublishReadiness;
  setupIssues: string[];
  targets: ApplicationPublishTarget[];
}

export interface ApplicationPublishDiscovery {
  applications: PublishableApplication[];
  projectId: string;
  runtime: 'desktop';
  workspaceKind: 'application' | 'sdkwork-workspace' | 'unknown';
}

export interface ApplicationPublishPreflightRequest {
  appRelativePath: string;
  projectId: string;
  targetId: string;
}

export interface ApplicationPublishPreflightCheck {
  code: string;
  message: string;
  status: 'failed' | 'passed' | 'warning';
}

export interface ApplicationPublishPreflight {
  appRelativePath: string;
  checks: ApplicationPublishPreflightCheck[];
  command: string;
  cwd: string;
  fileName: string;
  packageId: string;
  planId: string;
  projectId: string;
  targetId: string;
}

export type ApplicationPublishStage =
  | 'building'
  | 'completed'
  | 'deploying'
  | 'packaging'
  | 'registering'
  | 'releasing'
  | 'uploading';

export interface ApplicationPublishProgress {
  detail?: string;
  percent?: number;
  stage: ApplicationPublishStage;
}

export interface ApplicationPublishRequest {
  deployAfterRelease: boolean;
  environment: string;
  planId: string;
  releaseNotes?: string;
  version: string;
}

export interface ApplicationPublishEvidence {
  artifactId: string;
  checksumSha256: string;
  deploymentId?: string;
  fileName: string;
  releaseId: string;
  siteId: string;
  uploadItemId: string;
  uploadSessionId: string;
}

export type ApplicationPublishErrorCode =
  | 'artifact_unavailable'
  | 'build_failed'
  | 'cloud_publish_failed'
  | 'desktop_runtime_required'
  | 'discovery_failed'
  | 'invalid_host_response'
  | 'preflight_failed'
  | 'project_required';

export class ApplicationPublishError extends Error {
  readonly code: ApplicationPublishErrorCode;
  readonly details?: string;

  constructor(
    code: ApplicationPublishErrorCode,
    message: string,
    options: { cause?: unknown; details?: string } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ApplicationPublishError';
    this.code = code;
    this.details = options.details;
  }
}

export interface IApplicationPublishService {
  discoverApplications(projectId: string): Promise<ApplicationPublishDiscovery>;

  preflightApplication(
    request: ApplicationPublishPreflightRequest,
  ): Promise<ApplicationPublishPreflight>;

  publishApplication(
    request: ApplicationPublishRequest,
    onProgress?: (progress: ApplicationPublishProgress) => void,
  ): Promise<ApplicationPublishEvidence>;
}
