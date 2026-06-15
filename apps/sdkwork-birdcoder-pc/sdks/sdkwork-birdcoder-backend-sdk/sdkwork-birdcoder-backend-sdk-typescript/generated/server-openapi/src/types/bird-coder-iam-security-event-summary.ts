export interface BirdCoderIamSecurityEventSummary {
  id: string;
  tenantId: string;
  userId?: string;
  sessionId?: string;
  eventType: string;
  severity: string;
  detail: Record<string, unknown>;
  createdAt: string;
}
