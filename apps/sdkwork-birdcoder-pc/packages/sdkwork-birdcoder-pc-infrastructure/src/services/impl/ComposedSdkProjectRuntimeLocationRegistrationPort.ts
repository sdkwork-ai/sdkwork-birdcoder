import { sha256Hash } from '@sdkwork/utils/crypto';
import type {
  BirdCoderAppSdkApiClient,
  BirdCoderProjectRuntimeLocationRecord,
} from '../sdkClients.ts';
import type {
  DesktopRuntimeLocationBindingIdentity,
  DesktopRuntimeLocationIdentityPort,
} from '../interfaces/IDesktopRuntimeLocationIdentityPort.ts';
import type {
  ProjectRuntimeLocationRegistrationInput,
  ProjectRuntimeLocationRegistrationPort,
  ProjectRuntimeLocationRegistrationResult,
  ProjectRuntimeLocationCapability,
} from '../interfaces/IProjectRuntimeLocationService.ts';

export type ProjectRuntimeLocationRegistrationSdkPort = Pick<
  BirdCoderAppSdkApiClient,
  | 'createProjectRuntimeLocation'
  | 'getProjectRuntimeLocation'
  | 'listProjectRuntimeLocationPreferences'
  | 'rebindProjectRuntimeLocation'
>;

export interface ComposedSdkProjectRuntimeLocationRegistrationPortOptions {
  identityPort: DesktopRuntimeLocationIdentityPort;
  now?: () => number;
  sdkPort: ProjectRuntimeLocationRegistrationSdkPort;
}

const REMOTE_BINDING_VALIDATION_INTERVAL_MS = 5 * 60 * 1_000;

function createIdempotencyKey(values: readonly string[]): string {
  return sha256Hash(values.join('\u0001'));
}

function isRegistered(identity: DesktopRuntimeLocationBindingIdentity): boolean {
  return Boolean(
    identity.runtimeLocationId
      && identity.runtimeLocationVersion
      && !identity.requiresRebind,
  );
}

function toRegisteredResult(
  identity: DesktopRuntimeLocationBindingIdentity,
): ProjectRuntimeLocationRegistrationResult {
  if (!isRegistered(identity)) {
    return { remoteSynchronization: 'pending' };
  }

  return {
    remoteSynchronization: 'registered',
    runtimeLocationId: identity.runtimeLocationId,
  };
}

function assertRemoteBindingMatchesIdentity(
  remote: BirdCoderProjectRuntimeLocationRecord,
  identity: DesktopRuntimeLocationBindingIdentity,
): void {
  if (
    remote.runtimeTargetId !== identity.runtimeTargetId ||
    remote.rootLocator !== identity.rootLocator
  ) {
    throw new Error('The server returned a runtime location for a different desktop binding.');
  }
}

function toCachedRemoteBinding(
  identity: DesktopRuntimeLocationBindingIdentity,
): BirdCoderProjectRuntimeLocationRecord {
  if (!identity.runtimeLocationId || !identity.runtimeLocationVersion) {
    throw new Error('A cached desktop runtime location binding is incomplete.');
  }

  return {
    id: identity.runtimeLocationId,
    rootLocator: identity.rootLocator,
    runtimeTargetId: identity.runtimeTargetId,
    version: identity.runtimeLocationVersion,
  };
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as { httpStatus?: unknown; status?: unknown };
  return record.httpStatus === 404 || record.status === 404;
}

function createValidationKey(identity: DesktopRuntimeLocationBindingIdentity): string {
  return [
    identity.runtimeTargetId,
    identity.rootLocator,
    String(identity.runtimeLocationCreateGeneration),
    identity.runtimeLocationId,
    identity.runtimeLocationVersion,
  ].join('\u0001');
}

/**
 * Persists a desktop checkout through the public composed app SDK. It sends
 * only host-derived target identity plus write-only path material, never
 * client-inferred capabilities, health, verification, Git metadata, or a
 * runtime-location preference.
 */
export class ComposedSdkProjectRuntimeLocationRegistrationPort
  implements ProjectRuntimeLocationRegistrationPort {
  private readonly identityPort: DesktopRuntimeLocationIdentityPort;
  private readonly lastValidatedAt = new Map<string, number>();
  private readonly now: () => number;
  private readonly sdkPort: ProjectRuntimeLocationRegistrationSdkPort;

  constructor({
    identityPort,
    now = Date.now,
    sdkPort,
  }: ComposedSdkProjectRuntimeLocationRegistrationPortOptions) {
    this.identityPort = identityPort;
    this.now = now;
    this.sdkPort = sdkPort;
  }

  async resolvePreferredProjectRuntimeLocationId(
    projectId: string,
    capability: ProjectRuntimeLocationCapability,
  ): Promise<string | null> {
    const preferences = await this.sdkPort.listProjectRuntimeLocationPreferences(projectId);
    const runtimeLocationId = preferences.find(
      (preference) => preference.capability === capability,
    )?.runtimeLocationId;
    return runtimeLocationId?.trim() || null;
  }

  async inspectLocalDesktopRuntimeLocation(
    input: ProjectRuntimeLocationRegistrationInput,
  ): Promise<ProjectRuntimeLocationRegistrationResult> {
    const identity = await this.identityPort.resolveDesktopRuntimeLocationBinding(input);
    return identity ? toRegisteredResult(identity) : { remoteSynchronization: 'not_configured' };
  }

  async synchronizeLocalDesktopRuntimeLocation(
    input: ProjectRuntimeLocationRegistrationInput,
  ): Promise<ProjectRuntimeLocationRegistrationResult> {
    const identity = await this.identityPort.resolveDesktopRuntimeLocationBinding(input);
    if (!identity) {
      return { remoteSynchronization: 'not_configured' };
    }

    const remote = await this.synchronizeRemoteBinding(input, identity);
    assertRemoteBindingMatchesIdentity(remote, identity);
    await this.identityPort.persistRemoteRuntimeLocationBinding({
      absolutePath: input.absolutePath,
      projectId: input.projectId,
      rootLocator: identity.rootLocator,
      runtimeLocationId: remote.id,
      runtimeLocationVersion: remote.version,
    });

    return {
      remoteSynchronization: 'registered',
      runtimeLocationId: remote.id,
    };
  }

  private async synchronizeRemoteBinding(
    input: ProjectRuntimeLocationRegistrationInput,
    identity: DesktopRuntimeLocationBindingIdentity,
  ): Promise<BirdCoderProjectRuntimeLocationRecord> {
    if (!identity.runtimeLocationId) {
      return await this.createRuntimeLocation(input, identity);
    }

    if (!identity.runtimeLocationVersion) {
      return await this.recreateMissingRuntimeLocation(input, identity);
    }

    if (identity.requiresRebind) {
      return await this.rebindRuntimeLocation(input, identity);
    }

    return await this.validateCachedRuntimeLocation(input, identity);
  }

  private async validateCachedRuntimeLocation(
    input: ProjectRuntimeLocationRegistrationInput,
    identity: DesktopRuntimeLocationBindingIdentity,
  ): Promise<BirdCoderProjectRuntimeLocationRecord> {
    const validationKey = createValidationKey(identity);
    const lastValidatedAt = this.lastValidatedAt.get(validationKey);
    if (
      lastValidatedAt !== undefined &&
      this.now() - lastValidatedAt < REMOTE_BINDING_VALIDATION_INTERVAL_MS
    ) {
      return toCachedRemoteBinding(identity);
    }

    let remote: BirdCoderProjectRuntimeLocationRecord;
    try {
      remote = await this.sdkPort.getProjectRuntimeLocation(
        input.projectId,
        identity.runtimeLocationId!,
      );
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      return await this.recreateMissingRuntimeLocation(input, identity);
    }

    if (
      remote.runtimeTargetId !== identity.runtimeTargetId ||
      remote.rootLocator !== identity.rootLocator
    ) {
      return await this.recreateMissingRuntimeLocation(input, identity);
    }

    this.lastValidatedAt.set(validationKey, this.now());
    return remote;
  }

  private async recreateMissingRuntimeLocation(
    input: ProjectRuntimeLocationRegistrationInput,
    identity: DesktopRuntimeLocationBindingIdentity,
  ): Promise<BirdCoderProjectRuntimeLocationRecord> {
    await this.identityPort.clearRemoteRuntimeLocationBinding({
      absolutePath: input.absolutePath,
      projectId: input.projectId,
      rootLocator: identity.rootLocator,
    });
    this.lastValidatedAt.delete(createValidationKey(identity));

    const refreshedIdentity = await this.identityPort.resolveDesktopRuntimeLocationBinding(input);
    if (!refreshedIdentity || refreshedIdentity.runtimeLocationId) {
      throw new Error('The stale desktop runtime location binding could not be reset safely.');
    }

    return await this.createRuntimeLocation(input, refreshedIdentity);
  }

  private async createRuntimeLocation(
    input: ProjectRuntimeLocationRegistrationInput,
    identity: DesktopRuntimeLocationBindingIdentity,
  ): Promise<BirdCoderProjectRuntimeLocationRecord> {
    return await this.sdkPort.createProjectRuntimeLocation(input.projectId, {
      absolutePath: input.absolutePath,
      displayName: identity.displayName,
      idempotencyKey: createIdempotencyKey([
        'project-runtime-location-create',
        identity.runtimeTargetId,
        identity.rootLocator,
        String(identity.runtimeLocationCreateGeneration),
      ]),
      locationKind: identity.locationKind,
      pathFlavor: identity.pathFlavor,
      rootLocator: identity.rootLocator,
      runtimeTargetId: identity.runtimeTargetId,
      runtimeTargetKind: identity.runtimeTargetKind,
    });
  }

  private async rebindRuntimeLocation(
    input: ProjectRuntimeLocationRegistrationInput,
    identity: DesktopRuntimeLocationBindingIdentity,
  ): Promise<BirdCoderProjectRuntimeLocationRecord> {
    const runtimeLocationId = identity.runtimeLocationId;
    const runtimeLocationVersion = identity.runtimeLocationVersion;
    if (!runtimeLocationId || !runtimeLocationVersion) {
      throw new Error('A desktop runtime location rebind requires a complete cached remote binding.');
    }

    return await this.sdkPort.rebindProjectRuntimeLocation(input.projectId, runtimeLocationId, {
      absolutePath: input.absolutePath,
      displayName: identity.displayName,
      idempotencyKey: createIdempotencyKey([
        'project-runtime-location-rebind',
        identity.runtimeTargetId,
        identity.rootLocator,
        runtimeLocationId,
        runtimeLocationVersion,
      ]),
      pathFlavor: identity.pathFlavor,
      rootLocator: identity.rootLocator,
    });
  }
}
