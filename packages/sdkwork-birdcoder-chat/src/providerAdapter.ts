import { existsSync } from 'node:fs';
import path from 'node:path';

import type {
  BirdCoderCodeEngineKey,
  BirdCoderEngineTransportKind,
} from '../../sdkwork-birdcoder-types/src/index.ts';
import type {
  ChatEngineHealthReport,
  ChatEngineIntegrationClass,
  ChatEngineIntegrationDescriptor,
  ChatEngineOfficialEntry,
  ChatEngineRuntimeMode,
  ChatEngineSourceMirrorStatus,
} from './types.ts';

export interface StaticIntegrationDescriptorInput {
  engineId: BirdCoderCodeEngineKey;
  integrationClass?: ChatEngineIntegrationClass;
  runtimeMode?: ChatEngineRuntimeMode;
  officialEntry: ChatEngineOfficialEntry;
  transportKinds: readonly BirdCoderEngineTransportKind[];
  sourceMirrorPath?: string | null;
  notes?: string;
}

export interface StaticHealthReportInput {
  descriptor: ChatEngineIntegrationDescriptor;
  status?: ChatEngineHealthReport['status'];
  sdkAvailable?: boolean;
  cliAvailable?: boolean;
  authConfigured?: boolean;
  fallbackActive?: boolean;
  diagnostics?: readonly string[];
}

export function resolveMirrorPresence(
  relativePath: string | null | undefined,
): ChatEngineSourceMirrorStatus {
  if (!relativePath) {
    return 'sdk-only';
  }

  const absolutePath = path.resolve(process.cwd(), relativePath);
  return existsSync(absolutePath) ? 'mirrored' : 'missing';
}

export function resolveRuntimeModeFromTransport(
  transportKinds: readonly BirdCoderEngineTransportKind[],
): ChatEngineRuntimeMode {
  const primaryTransport = transportKinds[0];
  switch (primaryTransport) {
    case 'sdk-stream':
    case 'json-rpc-v2':
      return 'sdk';
    case 'remote-control-http':
      return 'remote-control';
    case 'cli-jsonl':
      return 'headless';
    case 'openapi-http':
    default:
      return 'protocol-fallback';
  }
}

export function createStaticIntegrationDescriptor(
  input: StaticIntegrationDescriptorInput,
): ChatEngineIntegrationDescriptor {
  const sourceMirrorPath = input.sourceMirrorPath ?? input.officialEntry.sourceMirrorPath ?? null;
  const sourceMirrorStatus = resolveMirrorPresence(sourceMirrorPath);

  return {
    engineId: input.engineId,
    integrationClass: input.integrationClass ?? 'official-sdk',
    runtimeMode: input.runtimeMode ?? resolveRuntimeModeFromTransport(input.transportKinds),
    officialEntry: {
      ...input.officialEntry,
      sourceMirrorPath,
    },
    transportKinds: [...input.transportKinds],
    sourceMirrorPath,
    sourceMirrorStatus,
    notes: input.notes,
  };
}

export function createStaticHealthReport(
  input: StaticHealthReportInput,
): ChatEngineHealthReport {
  const diagnostics = [...(input.diagnostics ?? [])];
  const sdkAvailable = input.sdkAvailable ?? input.descriptor.sourceMirrorStatus !== 'missing';

  if (!sdkAvailable) {
    diagnostics.push('Official SDK mirror is not available in the current workspace.');
  }

  return {
    status: input.status ?? (sdkAvailable ? 'ready' : 'missing'),
    runtimeMode: input.descriptor.runtimeMode,
    officialEntry: input.descriptor.officialEntry,
    sdkAvailable,
    cliAvailable: input.cliAvailable ?? true,
    authConfigured: input.authConfigured ?? true,
    fallbackActive: input.fallbackActive ?? false,
    sourceMirrorStatus: input.descriptor.sourceMirrorStatus,
    diagnostics,
    checkedAt: Date.now(),
  };
}
