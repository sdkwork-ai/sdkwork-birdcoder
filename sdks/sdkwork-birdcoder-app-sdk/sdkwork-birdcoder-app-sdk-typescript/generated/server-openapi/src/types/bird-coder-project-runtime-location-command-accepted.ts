export interface BirdCoderProjectRuntimeLocationCommandAccepted {
  accepted: true;
  resourceId: string;
  status: 'pending' | 'healthy' | 'degraded' | 'unreachable' | 'revoked';
}
