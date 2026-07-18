import type {
  BirdCoderApiRouteCatalogEntry,
  BirdCoderCodingServerDescriptor,
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionCheckpoint,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
  BirdCoderCoreHealthSummary,
  BirdCoderGetNativeSessionRequest,
  BirdCoderListCodingSessionsRequest,
  BirdCoderListNativeSessionsRequest,
  BirdCoderNativeSessionDetail,
  BirdCoderNativeSessionProviderSummary,
  BirdCoderNativeSessionSummary,
  BirdCoderCoreRuntimeSummary,
  BirdCoderCodeEngineModelConfig,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderModelCatalogEntry,
  BirdCoderOperationDescriptor,
} from '@sdkwork/birdcoder-pc-contracts-commons';

export interface BirdCoderRuntimeSessionPage<TItem> {
  items: TItem[];
  pageInfo: {
    hasMore: boolean;
    mode: 'offset';
    page: number;
    pageSize: number;
    totalItems: string;
    totalPages: number;
  };
}

export interface IAppRuntimeReadService {
  getCodingSession(codingSessionId: string): Promise<BirdCoderCodingSessionSummary>;
  getDescriptor(): Promise<BirdCoderCodingServerDescriptor>;
  getEngineCapabilities(engineKey: string): Promise<BirdCoderEngineCapabilityMatrix>;
  getHealth(): Promise<BirdCoderCoreHealthSummary>;
  getModelConfig(): Promise<BirdCoderCodeEngineModelConfig>;
  getNativeSession(
    codingSessionId: string,
    request: BirdCoderGetNativeSessionRequest,
  ): Promise<BirdCoderNativeSessionDetail>;
  getOperation(operationId: string): Promise<BirdCoderOperationDescriptor>;
  getRuntime(): Promise<BirdCoderCoreRuntimeSummary>;
  listCodingSessionArtifacts(codingSessionId: string): Promise<BirdCoderCodingSessionArtifact[]>;
  listCodingSessionCheckpoints(codingSessionId: string): Promise<BirdCoderCodingSessionCheckpoint[]>;
  listCodingSessionEvents(codingSessionId: string): Promise<BirdCoderCodingSessionEvent[]>;
  listCodingSessions(
    request?: BirdCoderListCodingSessionsRequest,
  ): Promise<BirdCoderCodingSessionSummary[]>;
  listCodingSessionPage(
    request?: BirdCoderListCodingSessionsRequest,
  ): Promise<BirdCoderRuntimeSessionPage<BirdCoderCodingSessionSummary>>;
  listEngines(): Promise<BirdCoderEngineDescriptor[]>;
  listModels(): Promise<BirdCoderModelCatalogEntry[]>;
  listNativeSessionProviders(): Promise<BirdCoderNativeSessionProviderSummary[]>;
  listNativeSessions(
    request: BirdCoderListNativeSessionsRequest,
  ): Promise<BirdCoderNativeSessionSummary[]>;
  listNativeSessionPage(
    request: BirdCoderListNativeSessionsRequest,
  ): Promise<BirdCoderRuntimeSessionPage<BirdCoderNativeSessionSummary>>;
  listRoutes(): Promise<BirdCoderApiRouteCatalogEntry[]>;
}
