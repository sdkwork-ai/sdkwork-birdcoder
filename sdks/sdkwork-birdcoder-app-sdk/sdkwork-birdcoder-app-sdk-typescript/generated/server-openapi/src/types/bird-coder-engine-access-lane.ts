export interface BirdCoderEngineAccessLane {
  laneId: string;
  label: string;
  strategyKind: 'rust-native' | 'grpc-bridge' | 'cli-spawn' | 'remote-control' | 'openapi-proxy';
  runtimeOwner: 'rust-server' | 'typescript-bridge' | 'external-service';
  bridgeProtocol: 'direct' | 'grpc' | 'stdio' | 'http';
  transportKind: 'cli-jsonl' | 'sdk-stream' | 'remote-control-http' | 'openapi-http';
  status: 'ready' | 'planned';
  enabledByDefault: boolean;
  hostModes: ('web' | 'desktop' | 'server')[];
  description: string;
}
