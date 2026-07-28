import { ApplicationPublishError } from './interfaces/IApplicationPublishService.ts';

export interface NativeApplicationPublishOutputSnapshot {
  archive?: string;
  fileName: string;
  outputType: 'directory' | 'file';
  path: string;
}

export interface NativeApplicationPublishTargetSnapshot {
  command?: string;
  cwd?: string;
  id: string;
  issues: string[];
  label: string;
  outputs: NativeApplicationPublishOutputSnapshot[];
  packageId?: string;
  platform?: string;
  ready: boolean;
  runtimeTarget?: string;
}

export interface NativeApplicationPublishApplicationSnapshot {
  appKey?: string;
  applicationId: string;
  framework?: string;
  issues: string[];
  kind: string;
  manifestStatus: string;
  name: string;
  publishStatus: string;
  relativePath: string;
  targets: NativeApplicationPublishTargetSnapshot[];
}

export interface NativeApplicationPublishDiscoverySnapshot {
  applications: NativeApplicationPublishApplicationSnapshot[];
  scanLimitReached: boolean;
  warnings: string[];
}

export interface NativeApplicationPublishPreflightSnapshot {
  appKey?: string;
  applicationId: string;
  applicationKind: string;
  applicationName: string;
  applicationRelativePath: string;
  expiresInSeconds: number;
  framework?: string;
  manifestDigest: string;
  planId: string;
  target: NativeApplicationPublishTargetSnapshot;
}

export interface NativeApplicationPublishArtifactSnapshot {
  artifactId: string;
  byteLength: number;
  contentType: string;
  fileName: string;
  outputType: 'directory' | 'file';
  packageId: string;
  sha256: string;
}

export interface NativeApplicationPublishDiagnostic {
  exitCode?: number;
  stderr: string;
  stdout: string;
  truncated: boolean;
}

export interface NativeApplicationPublishBuildSnapshot {
  artifacts: NativeApplicationPublishArtifactSnapshot[];
  diagnostic: NativeApplicationPublishDiagnostic;
  planId: string;
}

function invalidHostResponse(message: string): ApplicationPublishError {
  return new ApplicationPublishError('invalid_host_response', message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw invalidHostResponse(`${label} must be an object.`);
  }
  return value;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw invalidHostResponse(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function readOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return readString(value, label);
}

function readStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw invalidHostResponse(`${label} must be an array of strings.`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw invalidHostResponse(`${label} must be a boolean.`);
  }
  return value;
}

function readPositiveSafeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw invalidHostResponse(`${label} must be a positive safe integer.`);
  }
  return Number(value);
}

function readOutputSnapshot(
  value: unknown,
  label: string,
): NativeApplicationPublishOutputSnapshot {
  const record = readRecord(value, label);
  const outputType = readString(record.outputType, `${label}.outputType`);
  if (outputType !== 'directory' && outputType !== 'file') {
    throw invalidHostResponse(`${label}.outputType is unsupported.`);
  }
  const archive = readOptionalString(record.archive, `${label}.archive`);
  if (archive !== undefined && archive !== 'zip') {
    throw invalidHostResponse(`${label}.archive is unsupported.`);
  }
  return {
    archive,
    fileName: readString(record.fileName, `${label}.fileName`),
    outputType,
    path: readString(record.path, `${label}.path`),
  };
}

function readTargetSnapshot(
  value: unknown,
  label: string,
): NativeApplicationPublishTargetSnapshot {
  const record = readRecord(value, label);
  if (!Array.isArray(record.outputs)) {
    throw invalidHostResponse(`${label}.outputs must be an array.`);
  }
  return {
    command: readOptionalString(record.command, `${label}.command`),
    cwd: readOptionalString(record.cwd, `${label}.cwd`),
    id: readString(record.id, `${label}.id`),
    issues: readStringArray(record.issues, `${label}.issues`),
    label: readString(record.label, `${label}.label`),
    outputs: record.outputs.map((output, index) =>
      readOutputSnapshot(output, `${label}.outputs[${index}]`)),
    packageId: readOptionalString(record.packageId, `${label}.packageId`),
    platform: readOptionalString(record.platform, `${label}.platform`),
    ready: readBoolean(record.ready, `${label}.ready`),
    runtimeTarget: readOptionalString(record.runtimeTarget, `${label}.runtimeTarget`),
  };
}

function readApplicationSnapshot(
  value: unknown,
  label: string,
): NativeApplicationPublishApplicationSnapshot {
  const record = readRecord(value, label);
  if (!Array.isArray(record.targets)) {
    throw invalidHostResponse(`${label}.targets must be an array.`);
  }
  return {
    appKey: readOptionalString(record.appKey, `${label}.appKey`),
    applicationId: readString(record.applicationId, `${label}.applicationId`),
    framework: readOptionalString(record.framework, `${label}.framework`),
    issues: readStringArray(record.issues, `${label}.issues`),
    kind: readString(record.kind, `${label}.kind`),
    manifestStatus: readString(record.manifestStatus, `${label}.manifestStatus`),
    name: readString(record.name, `${label}.name`),
    publishStatus: readString(record.publishStatus, `${label}.publishStatus`),
    relativePath: readString(record.relativePath, `${label}.relativePath`),
    targets: record.targets.map((target, index) =>
      readTargetSnapshot(target, `${label}.targets[${index}]`)),
  };
}

export function readApplicationPublishDiscoverySnapshot(
  value: unknown,
): NativeApplicationPublishDiscoverySnapshot {
  const record = readRecord(value, 'Application publish discovery response');
  if (!Array.isArray(record.applications)) {
    throw invalidHostResponse('Application publish discovery applications must be an array.');
  }
  return {
    applications: record.applications.map((application, index) =>
      readApplicationSnapshot(application, `applications[${index}]`)),
    scanLimitReached: readBoolean(record.scanLimitReached, 'scanLimitReached'),
    warnings: readStringArray(record.warnings, 'warnings'),
  };
}

export function readApplicationPublishPreflightSnapshot(
  value: unknown,
): NativeApplicationPublishPreflightSnapshot {
  const record = readRecord(value, 'Application publish preflight response');
  return {
    appKey: readOptionalString(record.appKey, 'appKey'),
    applicationId: readString(record.applicationId, 'applicationId'),
    applicationKind: readString(record.applicationKind, 'applicationKind'),
    applicationName: readString(record.applicationName, 'applicationName'),
    applicationRelativePath: readString(
      record.applicationRelativePath,
      'applicationRelativePath',
    ),
    expiresInSeconds: readPositiveSafeInteger(
      record.expiresInSeconds,
      'expiresInSeconds',
    ),
    framework: readOptionalString(record.framework, 'framework'),
    manifestDigest: readString(record.manifestDigest, 'manifestDigest'),
    planId: readString(record.planId, 'planId'),
    target: readTargetSnapshot(record.target, 'target'),
  };
}

function readDiagnostic(value: unknown): NativeApplicationPublishDiagnostic {
  const record = readRecord(value, 'diagnostic');
  const exitCode = record.exitCode;
  if (
    exitCode !== undefined
    && exitCode !== null
    && (!Number.isSafeInteger(exitCode) || Number(exitCode) < 0)
  ) {
    throw invalidHostResponse('diagnostic.exitCode must be a non-negative integer.');
  }
  return {
    exitCode: exitCode === undefined || exitCode === null
      ? undefined
      : Number(exitCode),
    stderr: typeof record.stderr === 'string' ? record.stderr : '',
    stdout: typeof record.stdout === 'string' ? record.stdout : '',
    truncated: readBoolean(record.truncated, 'diagnostic.truncated'),
  };
}

function readArtifactSnapshot(
  value: unknown,
  label: string,
): NativeApplicationPublishArtifactSnapshot {
  const record = readRecord(value, label);
  const outputType = readString(record.outputType, `${label}.outputType`);
  if (outputType !== 'directory' && outputType !== 'file') {
    throw invalidHostResponse(`${label}.outputType is unsupported.`);
  }
  return {
    artifactId: readString(record.artifactId, `${label}.artifactId`),
    byteLength: readPositiveSafeInteger(record.byteLength, `${label}.byteLength`),
    contentType: readString(record.contentType, `${label}.contentType`),
    fileName: readString(record.fileName, `${label}.fileName`),
    outputType,
    packageId: readString(record.packageId, `${label}.packageId`),
    sha256: readString(record.sha256, `${label}.sha256`),
  };
}

export function readApplicationPublishBuildSnapshot(
  value: unknown,
): NativeApplicationPublishBuildSnapshot {
  const record = readRecord(value, 'Application publish build response');
  if (!Array.isArray(record.artifacts)) {
    throw invalidHostResponse('Application publish build artifacts must be an array.');
  }
  return {
    artifacts: record.artifacts.map((artifact, index) =>
      readArtifactSnapshot(artifact, `artifacts[${index}]`)),
    diagnostic: readDiagnostic(record.diagnostic),
    planId: readString(record.planId, 'planId'),
  };
}

export function copyApplicationPublishBinaryResponse(
  value: unknown,
  expectedLength: number,
): ArrayBuffer {
  let bytes: Uint8Array;
  if (value instanceof ArrayBuffer) {
    bytes = new Uint8Array(value);
  } else if (ArrayBuffer.isView(value)) {
    bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  } else if (
    Array.isArray(value)
    && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)
  ) {
    bytes = Uint8Array.from(value);
  } else {
    throw invalidHostResponse('The native artifact range response is not binary data.');
  }
  if (bytes.byteLength !== expectedLength) {
    throw invalidHostResponse('The native artifact range response length is invalid.');
  }
  const result = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(result).set(bytes);
  return result;
}
