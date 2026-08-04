import { describe, expect, it } from 'vitest';

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
      expect([...new Uint8Array(await request.artifact.file.readRange!(0, 4))]).toEqual([1, 2, 3, 4]);
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

describe('ApplicationPublishService', () => {
  it('discovers applications through the native host', async () => {
    const calls: CommandCall[] = [];
    const service = createService(calls, successfulPublisher({}));
    const discovery = await service.discoverApplications('project-1');
    expect(discovery.workspaceKind).toBe('sdkwork-workspace');
    expect(discovery.applications[0]).toEqual({
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
    expect(calls.map((call) => call.command)).toEqual(['application_publish_discover']);
    expect(calls[0]?.args).toEqual({ rootPath: ROOT_PATH });
  });

  it('preflights a target through the native host', async () => {
    const calls: CommandCall[] = [];
    const service = createService(calls, successfulPublisher({}));
    const preflight = await service.preflightApplication({
      appRelativePath: 'apps/customer-web',
      projectId: 'project-1',
      targetId: 'web-production',
    });
    expect(preflight.planId).toBe('plan-1');
    expect(preflight.command).toBe('pnpm build');
    expect(preflight.cwd).toBe('.');
    expect(preflight.checks.every((check) => check.status === 'passed')).toBe(true);
    expect(calls.map((call) => call.command)).toEqual(['application_publish_preflight']);
    expect(calls[0]?.args).toEqual({
      applicationRelativePath: 'apps/customer-web',
      rootPath: ROOT_PATH,
      targetId: 'web-production',
    });
  });

  it('publishes with progress, evidence, and the captured deploy request', async () => {
    const calls: CommandCall[] = [];
    const captured: { request?: DeployApplicationPublishRequest } = {};
    const service = createService(calls, successfulPublisher(captured));
    const preflight = await service.preflightApplication({
      appRelativePath: 'apps/customer-web',
      projectId: 'project-1',
      targetId: 'web-production',
    });
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
    expect(evidence).toEqual({
      artifactId: 'deploy-artifact-1',
      checksumSha256: CHECKSUM,
      deploymentId: 'deployment-1',
      fileName: 'web.zip',
      releaseId: 'release-1',
      siteId: 'site-1',
      uploadItemId: 'upload-item-1',
      uploadSessionId: 'upload-session-1',
    });
    expect(captured.request?.site.kind).toBe('resolveOrCreate');
    expect(captured.request?.site.kind === 'resolveOrCreate' && captured.request.site.slug).toBe('customer-web');
    expect(captured.request?.site.kind === 'resolveOrCreate' && captured.request.site.siteType).toBe(2);
    expect(captured.request?.artifact.packageType).toBe(2);
    expect(captured.request?.deployment).toEqual({
      deployType: 1,
      environment: 'production',
      versionTag: '1.2.3',
    });
    expect(progress).toEqual([
      'building',
      'packaging',
      'uploading',
      'uploading',
      'registering',
      'releasing',
      'deploying',
      'completed',
    ]);
    expect(calls.map((call) => call.command)).toEqual([
      'application_publish_preflight',
      'application_publish_build_package',
      'application_publish_read_artifact_range',
      'application_publish_artifact_discard',
    ]);
  });

  it('fails closed and discards the artifact when the deploy gateway is unavailable', async () => {
    const calls: CommandCall[] = [];
    const failedService = createService(
      calls,
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
    await expect(failedService.publishApplication({
      deployAfterRelease: false,
      environment: 'staging',
      planId: 'plan-failure',
      version: '2.0.0',
    })).rejects.toMatchObject({
      code: 'cloud_publish_failed',
      message: 'Deploy gateway unavailable.',
    });
    expect(calls.at(-1)?.command).toBe('application_publish_artifact_discard');
  });

  it('rejects a publish without a preflight plan', async () => {
    const calls: CommandCall[] = [];
    const failedService = createService(calls, successfulPublisher({}));
    await expect(failedService.publishApplication({
      deployAfterRelease: false,
      environment: 'staging',
      planId: 'unused-plan',
      version: '02.0.0',
    })).rejects.toMatchObject({ code: 'preflight_failed' });
  });
});
