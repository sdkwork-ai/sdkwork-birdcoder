export interface BirdCoderEngineAccessLane {
  laneId: string;
  label: string;
  strategyKind: 'rust-native' | 'cli-spawn' | 'grpc-bridge' | 'remote-control' | 'openapi-proxy';
  runtimeOwner: 'rust-server' | 'typescript-bridge';
  bridgeProtocol: 'direct' | 'stdio' | 'grpc' | 'http';
  transportKind: 'sdk-stream' | 'cli-jsonl' | 'remote-control-http' | 'openapi-http';
  status: 'ready';
  enabledByDefault: boolean;
  hostModes: ('web' | 'desktop' | 'server')[];
  description: string;
}
