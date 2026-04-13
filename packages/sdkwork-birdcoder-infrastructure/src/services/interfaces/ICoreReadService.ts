import type {
  BirdCoderCodingServerDescriptor,
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionCheckpoint,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
  BirdCoderCoreHealthSummary,
  BirdCoderCoreRuntimeSummary,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderModelCatalogEntry,
  BirdCoderOperationDescriptor,
} from '@sdkwork/birdcoder-types';

export interface ICoreReadService {
  getCodingSession(codingSessionId: string): Promise<BirdCoderCodingSessionSummary>;
  getDescriptor(): Promise<BirdCoderCodingServerDescriptor>;
  getEngineCapabilities(engineKey: string): Promise<BirdCoderEngineCapabilityMatrix>;
  getHealth(): Promise<BirdCoderCoreHealthSummary>;
  getOperation(operationId: string): Promise<BirdCoderOperationDescriptor>;
  getRuntime(): Promise<BirdCoderCoreRuntimeSummary>;
  listCodingSessionArtifacts(codingSessionId: string): Promise<BirdCoderCodingSessionArtifact[]>;
  listCodingSessionCheckpoints(codingSessionId: string): Promise<BirdCoderCodingSessionCheckpoint[]>;
  listCodingSessionEvents(codingSessionId: string): Promise<BirdCoderCodingSessionEvent[]>;
  listEngines(): Promise<BirdCoderEngineDescriptor[]>;
  listModels(): Promise<BirdCoderModelCatalogEntry[]>;
}
