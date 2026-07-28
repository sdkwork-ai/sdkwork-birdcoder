import type { DriveUploaderBlobLike } from '@sdkwork/birdcoder-pc-core/sdk/drive-app';

import {
  resolveBirdCoderTauriInvoke,
  type BirdCoderTauriInvoke,
} from '../platform/tauriRuntime.ts';
import {
  copyApplicationPublishBinaryResponse,
  readApplicationPublishBuildSnapshot,
  readApplicationPublishDiscoverySnapshot,
  readApplicationPublishPreflightSnapshot,
  type NativeApplicationPublishArtifactSnapshot,
  type NativeApplicationPublishBuildSnapshot,
  type NativeApplicationPublishDiscoverySnapshot,
  type NativeApplicationPublishPreflightSnapshot,
} from './applicationPublishHostContract.ts';
import { ApplicationPublishError } from './interfaces/IApplicationPublishService.ts';

export type {
  NativeApplicationPublishApplicationSnapshot,
  NativeApplicationPublishArtifactSnapshot,
  NativeApplicationPublishBuildSnapshot,
  NativeApplicationPublishDiagnostic,
  NativeApplicationPublishDiscoverySnapshot,
  NativeApplicationPublishOutputSnapshot,
  NativeApplicationPublishPreflightSnapshot,
  NativeApplicationPublishTargetSnapshot,
} from './applicationPublishHostContract.ts';

const MAX_ARTIFACT_RANGE_BYTES = 8 * 1024 * 1024;

export interface ApplicationPublishHostPort {
  buildPackage(planId: string): Promise<NativeApplicationPublishBuildSnapshot>;
  createArtifactFile(
    artifact: NativeApplicationPublishArtifactSnapshot,
  ): DriveUploaderBlobLike;
  discardArtifact(artifactId: string): Promise<void>;
  discover(rootPath: string): Promise<NativeApplicationPublishDiscoverySnapshot>;
  preflight(
    rootPath: string,
    applicationRelativePath: string,
    targetId: string,
  ): Promise<NativeApplicationPublishPreflightSnapshot>;
}

export interface TauriApplicationPublishHostOptions {
  invoke?: BirdCoderTauriInvoke;
  resolveInvoke?: () => Promise<BirdCoderTauriInvoke | null>;
}

export class TauriApplicationPublishHost implements ApplicationPublishHostPort {
  private readonly explicitInvoke?: BirdCoderTauriInvoke;
  private readonly resolveInvoke: () => Promise<BirdCoderTauriInvoke | null>;

  constructor({
    invoke,
    resolveInvoke = resolveBirdCoderTauriInvoke,
  }: TauriApplicationPublishHostOptions = {}) {
    this.explicitInvoke = invoke;
    this.resolveInvoke = resolveInvoke;
  }

  async discover(rootPath: string): Promise<NativeApplicationPublishDiscoverySnapshot> {
    const value = await this.invoke<unknown>('application_publish_discover', { rootPath });
    return readApplicationPublishDiscoverySnapshot(value);
  }

  async preflight(
    rootPath: string,
    applicationRelativePath: string,
    targetId: string,
  ): Promise<NativeApplicationPublishPreflightSnapshot> {
    const value = await this.invoke<unknown>('application_publish_preflight', {
      applicationRelativePath,
      rootPath,
      targetId,
    });
    return readApplicationPublishPreflightSnapshot(value);
  }

  async buildPackage(planId: string): Promise<NativeApplicationPublishBuildSnapshot> {
    const value = await this.invoke<unknown>('application_publish_build_package', { planId });
    return readApplicationPublishBuildSnapshot(value);
  }

  createArtifactFile(
    artifact: NativeApplicationPublishArtifactSnapshot,
  ): DriveUploaderBlobLike {
    return {
      name: artifact.fileName,
      size: artifact.byteLength,
      type: artifact.contentType,
      readRange: async (offsetBytes, lengthBytes) => {
        if (
          !Number.isSafeInteger(offsetBytes)
          || offsetBytes < 0
          || !Number.isSafeInteger(lengthBytes)
          || lengthBytes <= 0
          || lengthBytes > MAX_ARTIFACT_RANGE_BYTES
          || offsetBytes + lengthBytes > artifact.byteLength
        ) {
          throw new ApplicationPublishError(
            'artifact_unavailable',
            'The requested staged artifact range is invalid.',
          );
        }
        const value = await this.invoke<unknown>(
          'application_publish_read_artifact_range',
          {
            artifactId: artifact.artifactId,
            length: lengthBytes,
            offset: offsetBytes,
          },
        );
        return copyApplicationPublishBinaryResponse(value, lengthBytes);
      },
      slice() {
        throw new ApplicationPublishError(
          'artifact_unavailable',
          'Staged artifacts must be read through the native range bridge.',
        );
      },
    };
  }

  async discardArtifact(artifactId: string): Promise<void> {
    await this.invoke<unknown>('application_publish_artifact_discard', { artifactId });
  }

  private async invoke<T>(
    command: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    const invoke = this.explicitInvoke ?? await this.resolveInvoke();
    if (!invoke) {
      throw new ApplicationPublishError(
        'desktop_runtime_required',
        'Application publishing requires the BirdCoder desktop runtime.',
      );
    }
    return invoke<T>(command, args);
  }
}
