import type { DeployApplicationPublisher } from '@sdkwork/deployments-app-sdk/application-publisher';

import {
  DEPLOY_TYPE_UPLOAD,
  normalizeApplicationPublishRequest,
  normalizeApplicationPublishSha256,
  relayDeployApplicationPublishProgress,
  resolveDeployApplicationSiteIdentity,
  resolveDeployPackageType,
  resolveDeploySiteType,
} from '../applicationPublishDeployMapping.ts';
import {
  TauriApplicationPublishHost,
  type ApplicationPublishHostPort,
} from '../applicationPublishHost.ts';
import type {
  NativeApplicationPublishArtifactSnapshot,
  NativeApplicationPublishPreflightSnapshot,
} from '../applicationPublishHostContract.ts';
import {
  readStagedArtifactIds,
  settleApplicationPublishOperationWithin,
  toApplicationPublishOperationError,
} from '../applicationPublishLifecycle.ts';
import {
  buildApplicationPublishPreflightChecks,
  isApplicationCollectionWorkspace,
  mapPublishableApplication,
} from '../applicationPublishMapping.ts';
import { createBirdCoderDeployApplicationPublisher } from '../applicationPublishSdk.ts';
import {
  ApplicationPublishError,
  type ApplicationPublishDiscovery,
  type ApplicationPublishEvidence,
  type ApplicationPublishPreflight,
  type ApplicationPublishPreflightRequest,
  type ApplicationPublishProgress,
  type ApplicationPublishRequest,
  type IApplicationPublishService,
} from '../interfaces/IApplicationPublishService.ts';
import type { IProjectRuntimeLocationService } from '../interfaces/IProjectRuntimeLocationService.ts';

const MAX_ACTIVE_PLANS = 64;
const MAX_PLAN_TTL_MILLIS = 15 * 60 * 1000;
const ARTIFACT_CLEANUP_TIMEOUT_MILLIS = 5_000;

interface PreparedApplicationPublishPlan {
  expiresAt: number;
  snapshot: NativeApplicationPublishPreflightSnapshot;
}

export interface ApplicationPublishServiceOptions {
  createPublisher?: () => DeployApplicationPublisher;
  host?: ApplicationPublishHostPort;
  now?: () => number;
  projectRuntimeLocationService: Pick<
    IProjectRuntimeLocationService,
    'resolveProjectLocalWorkingDirectory'
  >;
  publisher?: DeployApplicationPublisher;
}

export class ApplicationPublishService implements IApplicationPublishService {
  private readonly activePlanIds = new Set<string>();
  private readonly createPublisher: () => DeployApplicationPublisher;
  private readonly host: ApplicationPublishHostPort;
  private readonly now: () => number;
  private readonly plans = new Map<string, PreparedApplicationPublishPlan>();
  private readonly projectRuntimeLocationService: ApplicationPublishServiceOptions['projectRuntimeLocationService'];
  private publisher?: DeployApplicationPublisher;

  constructor({
    createPublisher = createBirdCoderDeployApplicationPublisher,
    host = new TauriApplicationPublishHost(),
    now = Date.now,
    projectRuntimeLocationService,
    publisher,
  }: ApplicationPublishServiceOptions) {
    this.createPublisher = createPublisher;
    this.host = host;
    this.now = now;
    this.projectRuntimeLocationService = projectRuntimeLocationService;
    this.publisher = publisher;
  }

  async discoverApplications(projectId: string): Promise<ApplicationPublishDiscovery> {
    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      throw new ApplicationPublishError(
        'project_required',
        'A project must be selected before discovering applications.',
      );
    }
    const rootPath = await this.resolveProjectRoot(normalizedProjectId);
    try {
      const snapshot = await this.host.discover(rootPath);
      return {
        applications: snapshot.applications.map(mapPublishableApplication),
        projectId: normalizedProjectId,
        runtime: 'desktop',
        workspaceKind: snapshot.applications.length === 0
          ? 'unknown'
          : isApplicationCollectionWorkspace(snapshot.applications)
            ? 'sdkwork-workspace'
            : 'application',
      };
    } catch (cause) {
      throw toApplicationPublishOperationError(
        'discovery_failed',
        'Application discovery failed.',
        cause,
      );
    }
  }

  async preflightApplication(
    request: ApplicationPublishPreflightRequest,
  ): Promise<ApplicationPublishPreflight> {
    const projectId = request.projectId.trim();
    if (!projectId) {
      throw new ApplicationPublishError(
        'project_required',
        'A project must be selected before application publish preflight.',
      );
    }
    const applicationRelativePath = request.appRelativePath.trim();
    const targetId = request.targetId.trim();
    if (!applicationRelativePath || !targetId) {
      throw new ApplicationPublishError(
        'preflight_failed',
        'An application and publish target must be selected before preflight.',
      );
    }
    const rootPath = await this.resolveProjectRoot(projectId);
    try {
      const snapshot = await this.host.preflight(
        rootPath,
        applicationRelativePath,
        targetId,
      );
      if (!snapshot.target.ready || !snapshot.target.packageId || !snapshot.target.command) {
        throw new ApplicationPublishError(
          'invalid_host_response',
          'Native preflight returned a publish target that is not ready.',
        );
      }
      this.rememberPlan(snapshot);
      const firstOutput = snapshot.target.outputs[0];
      return {
        appRelativePath: snapshot.applicationRelativePath,
        checks: buildApplicationPublishPreflightChecks(snapshot),
        command: snapshot.target.command,
        cwd: snapshot.target.cwd ?? '.',
        fileName: firstOutput?.fileName ?? snapshot.target.label,
        packageId: snapshot.target.packageId,
        planId: snapshot.planId,
        projectId,
        targetId: snapshot.target.id,
      };
    } catch (cause) {
      throw toApplicationPublishOperationError(
        'preflight_failed',
        'Application publish preflight failed.',
        cause,
      );
    }
  }

  async publishApplication(
    request: ApplicationPublishRequest,
    onProgress?: (progress: ApplicationPublishProgress) => void,
  ): Promise<ApplicationPublishEvidence> {
    const normalized = normalizeApplicationPublishRequest(request);
    const plan = this.claimPlan(normalized.planId);
    const emit = (progress: ApplicationPublishProgress): void => {
      try {
        onProgress?.(progress);
      } catch {
        // Observers cannot interrupt a build or a remote immutable publish operation.
      }
    };
    const artifactIds: string[] = [];
    let cloudPublishStarted = false;

    try {
      if (plan.snapshot.target.outputs.length !== 1) {
        throw new ApplicationPublishError(
          'preflight_failed',
          'The selected target must declare exactly one immutable release artifact.',
        );
      }
      emit({ percent: 0, stage: 'building' });
      let build;
      try {
        build = await this.host.buildPackage(normalized.planId);
      } catch (cause) {
        artifactIds.push(...readStagedArtifactIds(cause));
        throw toApplicationPublishOperationError(
          'build_failed',
          'The application build and packaging step failed.',
          cause,
        );
      }
      artifactIds.push(...build.artifacts.map((artifact) => artifact.artifactId));
      if (build.planId !== normalized.planId || build.artifacts.length !== 1) {
        throw new ApplicationPublishError(
          'invalid_host_response',
          'Native build returned an unexpected publish plan or artifact set.',
        );
      }
      const artifact = build.artifacts[0];
      this.validateBuiltArtifact(plan.snapshot, artifact);
      emit({ percent: 100, stage: 'packaging' });

      const checksumSha256 = normalizeApplicationPublishSha256(artifact.sha256);
      const siteType = resolveDeploySiteType(plan.snapshot);
      const siteIdentity = resolveDeployApplicationSiteIdentity(plan.snapshot);
      cloudPublishStarted = true;
      const publisher = this.getPublisher();
      let completedReported = false;
      const result = await publisher.publish({
        artifact: {
          checksumSha256,
          contentType: artifact.contentType,
          file: this.host.createArtifactFile(artifact),
          fileName: artifact.fileName,
          packageType: resolveDeployPackageType(siteType),
          source: 'sdkwork-birdcoder-pc',
          taskId: `birdcoder-publish-${normalized.planId}-${artifact.artifactId}`,
        },
        deployment: normalized.deployAfterRelease
          ? {
              deployType: DEPLOY_TYPE_UPLOAD,
              environment: normalized.environment,
              versionTag: normalized.version,
            }
          : undefined,
        onProgress: (progress) => {
          completedReported = relayDeployApplicationPublishProgress(progress, emit)
            || completedReported;
        },
        release: { versionTag: normalized.version },
        site: {
          ...siteIdentity,
          kind: 'resolveOrCreate',
          siteType,
        },
      });
      if (!completedReported) {
        emit({ percent: 100, stage: 'completed' });
      }
      return {
        artifactId: result.artifact.id,
        checksumSha256,
        deploymentId: result.deployment?.id,
        fileName: artifact.fileName,
        releaseId: result.release.id,
        siteId: result.site.id,
        uploadItemId: result.upload.uploadItemId,
        uploadSessionId: result.upload.uploadSessionId,
      };
    } catch (cause) {
      if (cause instanceof ApplicationPublishError) {
        throw cause;
      }
      throw toApplicationPublishOperationError(
        cloudPublishStarted ? 'cloud_publish_failed' : 'build_failed',
        cloudPublishStarted
          ? 'The cloud application publish operation failed.'
          : 'The application build and packaging step failed.',
        cause,
      );
    } finally {
      await this.discardArtifacts(artifactIds);
      this.activePlanIds.delete(normalized.planId);
    }
  }

  private async resolveProjectRoot(projectId: string): Promise<string> {
    let rootPath: string | null;
    try {
      rootPath = await this.projectRuntimeLocationService.resolveProjectLocalWorkingDirectory(
        projectId,
        {
          allowFolderSelection: false,
          capability: 'build',
        },
      );
    } catch (cause) {
      throw new ApplicationPublishError(
        'desktop_runtime_required',
        'A mounted desktop project folder is required for application publishing.',
        { cause },
      );
    }
    const normalized = rootPath?.trim();
    if (!normalized) {
      throw new ApplicationPublishError(
        'desktop_runtime_required',
        'A mounted desktop project folder is required for application publishing.',
      );
    }
    return normalized;
  }

  private rememberPlan(snapshot: NativeApplicationPublishPreflightSnapshot): void {
    this.removeExpiredPlans();
    while (this.plans.size >= MAX_ACTIVE_PLANS) {
      const oldestPlanId = this.plans.keys().next().value as string | undefined;
      if (!oldestPlanId) break;
      this.plans.delete(oldestPlanId);
    }
    this.plans.set(snapshot.planId, {
      expiresAt: this.now() + Math.min(
        snapshot.expiresInSeconds * 1000,
        MAX_PLAN_TTL_MILLIS,
      ),
      snapshot,
    });
  }

  private claimPlan(planId: string): PreparedApplicationPublishPlan {
    this.removeExpiredPlans();
    if (this.activePlanIds.has(planId)) {
      throw new ApplicationPublishError(
        'preflight_failed',
        'This application publish plan is already running.',
      );
    }
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new ApplicationPublishError(
        'preflight_failed',
        'The application publish plan is missing or expired. Run preflight again.',
      );
    }
    this.plans.delete(planId);
    this.activePlanIds.add(planId);
    return plan;
  }

  private removeExpiredPlans(): void {
    const now = this.now();
    for (const [planId, plan] of this.plans) {
      if (plan.expiresAt <= now) {
        this.plans.delete(planId);
      }
    }
  }

  private validateBuiltArtifact(
    snapshot: NativeApplicationPublishPreflightSnapshot,
    artifact: NativeApplicationPublishArtifactSnapshot,
  ): void {
    const expectedOutput = snapshot.target.outputs[0];
    if (
      !expectedOutput
      || artifact.packageId !== snapshot.target.packageId
      || artifact.fileName !== expectedOutput.fileName
      || artifact.outputType !== expectedOutput.outputType
    ) {
      throw new ApplicationPublishError(
        'invalid_host_response',
        'The staged artifact does not match the preflight-approved manifest output.',
      );
    }
  }

  private getPublisher(): DeployApplicationPublisher {
    this.publisher ??= this.createPublisher();
    return this.publisher;
  }

  private async discardArtifacts(artifactIds: readonly string[]): Promise<void> {
    const uniqueArtifactIds = [...new Set(artifactIds.filter(Boolean))];
    await Promise.all(uniqueArtifactIds.map((artifactId) =>
      settleApplicationPublishOperationWithin(
        this.host.discardArtifact(artifactId),
        ARTIFACT_CLEANUP_TIMEOUT_MILLIS,
      )));
  }
}
