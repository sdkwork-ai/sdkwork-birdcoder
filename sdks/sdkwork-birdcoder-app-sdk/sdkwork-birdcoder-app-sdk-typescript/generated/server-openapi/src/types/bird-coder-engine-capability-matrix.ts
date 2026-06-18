export interface BirdCoderEngineCapabilityMatrix {
  chat: boolean;
  streaming: boolean;
  structuredOutput: boolean;
  toolCalls: boolean;
  planning: boolean;
  patchArtifacts: boolean;
  commandArtifacts: boolean;
  todoArtifacts: boolean;
  ptyArtifacts: boolean;
  previewArtifacts: boolean;
  testArtifacts: boolean;
  approvalCheckpoints: boolean;
  sessionResume: boolean;
  remoteBridge: boolean;
  mcp: boolean;
}
