export interface BirdCoderProjectRuntimeLocationCommandAccepted {
  accepted: true;
  resourceId: string;
  status: 'pending_verification' | 'local_observed' | 'healthy' | 'degraded' | 'unavailable' | 'revoked';
}
