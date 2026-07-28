import assert from 'node:assert/strict';

import type {
  ApplicationPublishRequest as DeployApplicationPublishRequest,
  ApplicationPublishResult as DeployApplicationPublishResult,
  DeployApplicationPublisher,
} from '@sdkwork/deployments-app-sdk/application-publisher';

import { TauriApplicationPublishHost } from '../applicationPublishHost.ts';
import { ApplicationPublishService } from './ApplicationPublishService.ts';

const CHECKSUM = 'a'.repeat(64);
const ROOT_PATH = 'C:\\workspace\\birdcoder-fixture';

interface CommandCall {
  args?: Record<string, unknown>;
  command: string;
}

function nativeTarget() {
  return {
    command: 'pnpm build',
    cwd: '.',
    id: 'web-production',
    issues: [],
    label: 'Production web',
    outputs: [{
      archive: 'zip',
      fileName: 'web.zip',
      outputType: 'directory',
      path: 'dist',
    }],
    packageId: 'web-production-zip',
    platform: 'WEB',
    ready: true,
    runtimeTarget: 'browser',
  };
}

function nativePreflight(planId: string) {
  return {
    appKey: 'customer-web',
    applicationId: 'app:1234567890abcdef12345678',
    applicationKind: 'react',
    applicationName: 'Customer Web',
    applicationRelativePath: 'apps/customer-web',
    expiresInSeconds: 900,
    framework: 'react-vite',
    manifestDigest: `sha256:${'b'.repeat(64)}`,
    planId,
    target: nativeTarget(),
  };
}

function createNativeInvoke(
  calls: CommandCall[],
  planId = 'plan-1',
) {
  return async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
    calls.push({ args, command });
    switch (command) {
      case 'application_publish_discover':
        return {
          applications: [{
            appKey: 'customer-web',
            applicationId: 'app:1234567890abcdef12345678',
            framework: 'react-vite',
            issues: [],
            kind: 'react',
            manifestStatus: 'valid',
            name: 'Customer Web',
            publishStatus: 'ready',
            relativePath: 'apps/customer-web',
            targets: [nativeTarget()],
          }],
          scanLimitReached: false,
          warnings: [],
        } as T;
      case 'application_publish_preflight':
        return nativePreflight(planId) as T;
      case 'application_publish_build_package':
        return {
          artifacts: [{
            artifactId: `artifact-${planId}`,
            byteLength: 4,
            contentType: 'application/zip',
            fileName: 'web.zip',
            outputType: 'directory',
            packageId: 'web-production-zip',
            sha256: `sha256:${CHECKSUM}`,
          }],
          diagnostic: {
            exitCode: 0,
            stderr: '',
            stdout: 'built',
            truncated: false,
          },
          planId,
        } as T;
      case 'application_publish_read_artifact_range':
        return new Uint8Array([1, 2, 3, 4]) as T;
      case 'application_publish_artifact_discard':
        return { artifactId: `artifact-${planId}`, discarded: true } as T;
      default:
        throw new Error(`Unexpected native command ${command}`);
    }
  };
}

function successfulPublisher(
  captured: { request?: DeployApplicationPublishRequest },
): DeployApplicationPublisher {
  return {
    async publish(request) {
      captured.request = request;
      assert.deepEqual(
        [...new Uint8Array(await request.artifact.file.readRange!(0, 4))],
        [1, 2, 3, 4],
      );
      request.onProgress?.({
        evidence: {},
        kind: 'stage',
        stage: 'uploadArchive',
        status: 'started',
      });
      request.onProgress?.({
        evidence: {
          uploadItemId: 'upload-item-1',
          uploadSessionId: 'upload-session-1',
        },
        kind: 'upload',
        stage: 'uploadArchive',
        status: 'completed',
        totalBytes: 4,
        totalParts: 1,
        uploadedBytes: 4,
        uploadedPartsCount: 1,
      });
      request.onProgress?.({
        evidence: { artifactId: 'deploy-artifact-1' },
        kind: 'stage',
        stage: 'registerArtifact',
        status: 'started',
      });
      request.onProgress?.({
        evidence: { releaseId: 'release-1' },
        kind: 'stage',
        stage: 'createRelease',
        status: 'started',
      });
      request.onProgress?.({
        evidence: { deploymentId: 'deployment-1' },
        kind: 'stage',
        stage: 'createDeployment',
        status: 'started',
      });
      request.onProgress?.({
        evidence: { deploymentId: 'deployment-1' },
        kind: 'stage',
        stage: 'complete',
        status: 'completed',
      });
      return {
        artifact: { id: 'deploy-artifact-1', value: {} },
        deployment: { id: 'deployment-1', value: {} },
        release: { id: 'release-1', value: {} },
        site: { id: 'site-1', resolution: 'created', value: {} },
        upload: {
          driveNodeId: 'node-1',
          driveSpaceId: 'space-1',
          uploadItemId: 'upload-item-1',
          uploadSessionId: 'upload-session-1',
          value: {},
        },
      } as DeployApplicationPublishResult;
    },
  };
}

function createService(
  calls: CommandCall[],
  publisher: DeployApplicationPublisher,
  planId = 'plan-1',
): ApplicationPublishService {
  return new ApplicationPublishService({
    host: new TauriApplicationPublishHost({
      invoke: createNativeInvoke(calls, planId),
    }),
    projectRuntimeLocationService: {
      async resolveProjectLocalWorkingDirectory() {
        return ROOT_PATH;
      },
    },
    publisher,
  });
}

const calls: CommandCall[] = [];
const captured: { request?: DeployApplicationPublishRequest } = {};
const service = createService(calls, successfulPublisher(captured));
const discovery = await service.discoverApplications('project-1');
assert.equal(discovery.workspaceKind, 'sdkwork-workspace');
assert.deepEqual(discovery.applications[0], {
  appKey: 'customer-web',
  framework: 'react',
  manifestRelativePath: 'apps/customer-web/sdkwork.app.config.json',
  name: 'Customer Web',
  readiness: 'ready',
  relativePath: 'apps/customer-web',
  setupIssues: [],
  targets: [{
    command: 'pnpm build',
    cwd: '.',
    id: 'web-production',
    name: 'Production web',
    outputs: [{
      archive: 'zip',
      fileName: 'web.zip',
      path: 'dist',
      type: 'directory',
    }],
    packageId: 'web-production-zip',
    readiness: 'ready',
    setupIssues: [],
  }],
});

const preflight = await service.preflightApplication({
  appRelativePath: 'apps/customer-web',
  projectId: 'project-1',
  targetId: 'web-production',
});
assert.equal(preflight.planId, 'plan-1');
assert.equal(preflight.command, 'pnpm build');
assert.equal(preflight.cwd, '.');
assert.ok(preflight.checks.every((check) => check.status === 'passed'));

const progress: string[] = [];
const evidence = await service.publishApplication(
  {
    deployAfterRelease: true,
    environment: 'production',
    planId: preflight.planId,
    version: '1.2.3',
  },
  (update) => progress.push(update.stage),
);
assert.deepEqual(evidence, {
  artifactId: 'deploy-artifact-1',
  checksumSha256: CHECKSUM,
  deploymentId: 'deployment-1',
  fileName: 'web.zip',
  releaseId: 'release-1',
  siteId: 'site-1',
  uploadItemId: 'upload-item-1',
  uploadSessionId: 'upload-session-1',
});
assert.equal(captured.request?.site.kind, 'resolveOrCreate');
assert.equal(captured.request?.site.kind === 'resolveOrCreate' && captured.request.site.slug, 'customer-web');
assert.equal(captured.request?.site.kind === 'resolveOrCreate' && captured.request.site.siteType, 2);
assert.equal(captured.request?.artifact.packageType, 2);
assert.deepEqual(captured.request?.deployment, {
  deployType: 1,
  environment: 'production',
  versionTag: '1.2.3',
});
assert.deepEqual(progress, [
  'building',
  'packaging',
  'uploading',
  'uploading',
  'registering',
  'releasing',
  'deploying',
  'completed',
]);
assert.deepEqual(
  calls.map((call) => call.command),
  [
    'application_publish_discover',
    'application_publish_preflight',
    'application_publish_build_package',
    'application_publish_read_artifact_range',
    'application_publish_artifact_discard',
  ],
);
assert.deepEqual(calls[0]?.args, { rootPath: ROOT_PATH });
assert.deepEqual(calls[1]?.args, {
  applicationRelativePath: 'apps/customer-web',
  rootPath: ROOT_PATH,
  targetId: 'web-production',
});

const failedCalls: CommandCall[] = [];
const failedService = createService(
  failedCalls,
  {
    async publish() {
      throw new Error('Deploy gateway unavailable.');
    },
  },
  'plan-failure',
);
await failedService.preflightApplication({
  appRelativePath: 'apps/customer-web',
  projectId: 'project-1',
  targetId: 'web-production',
});
await assert.rejects(
  failedService.publishApplication({
    deployAfterRelease: false,
    environment: 'staging',
    planId: 'plan-failure',
    version: '2.0.0',
  }),
  { code: 'cloud_publish_failed', message: 'Deploy gateway unavailable.' },
);
assert.equal(
  failedCalls.at(-1)?.command,
  'application_publish_artifact_discard',
);

await assert.rejects(
  failedService.publishApplication({
    deployAfterRelease: false,
    environment: 'staging',
    planId: 'unused-plan',
    version: '02.0.0',
  }),
  { code: 'preflight_failed' },
);

console.log('application publish service tests passed');
