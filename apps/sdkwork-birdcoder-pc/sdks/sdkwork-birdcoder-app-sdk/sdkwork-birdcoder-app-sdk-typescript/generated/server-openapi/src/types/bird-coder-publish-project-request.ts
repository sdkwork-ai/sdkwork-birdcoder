export interface BirdCoderPublishProjectRequest {
  endpointUrl?: string;
  environmentKey?: string;
  releaseKind?: string;
  releaseVersion?: string;
  rolloutStage?: string;
  runtime?: string;
  targetId?: string;
  targetName?: string;
}
