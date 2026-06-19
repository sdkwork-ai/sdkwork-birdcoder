export interface BirdCoderNativeSessionProviderSummary {
  engineId: 'codex' | 'claude-code' | 'gemini' | 'opencode';
  displayName: string;
  nativeSessionIdPrefix: string;
  transportKinds: ('sdk-stream' | 'cli-jsonl' | 'remote-control-http' | 'openapi-http')[];
  /** Discovery mode for native engine session inventory. */
  discoveryMode: 'explicit-only' | 'passive-global';
}
