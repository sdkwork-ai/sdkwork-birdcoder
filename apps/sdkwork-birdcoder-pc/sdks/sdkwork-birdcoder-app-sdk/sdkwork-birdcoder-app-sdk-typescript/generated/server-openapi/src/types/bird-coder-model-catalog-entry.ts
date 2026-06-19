export interface BirdCoderModelCatalogEntry {
  id: string;
  uuid: string;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  engineKey: 'codex' | 'claude-code' | 'gemini' | 'opencode';
  modelId: string;
  displayName: string;
  providerId?: string;
  status: 'active' | 'preview' | 'deprecated' | 'disabled';
  defaultForEngine: boolean;
  transportKinds: ('sdk-stream' | 'cli-jsonl' | 'remote-control-http' | 'openapi-http')[];
  capabilityMatrix: Record<string, unknown>;
}
