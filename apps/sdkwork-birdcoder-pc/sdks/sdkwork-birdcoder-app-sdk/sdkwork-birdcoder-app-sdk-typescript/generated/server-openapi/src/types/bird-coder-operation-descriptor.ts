export interface BirdCoderOperationDescriptor {
  operationId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'rolled_back';
  artifactRefs: string[];
  streamUrl?: string;
  streamKind?: 'sse' | 'websocket';
}
