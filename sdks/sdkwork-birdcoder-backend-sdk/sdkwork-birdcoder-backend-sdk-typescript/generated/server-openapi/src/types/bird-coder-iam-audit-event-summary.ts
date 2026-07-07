export interface BirdCoderIamAuditEventSummary {
  id: string;
  tenantId: string;
  organizationId?: string;
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  traceId?: string;
  appId?: string;
  environment?: string;
  shardingKey?: string;
  detail: Record<string, unknown>;
  createdAt: string;
}
