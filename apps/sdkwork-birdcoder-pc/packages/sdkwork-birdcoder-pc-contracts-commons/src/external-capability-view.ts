/** Read-only SDK-composed views; never persistence or transport authorities. */
export interface ProjectDocumentSummary {
  projectId: string;
  compositionSlotId: string;
  compositionVersion: string;
  documentId: string;
  documentVersionRef?: string;
  title: string;
  status: string;
  body?: string;
  createdAt: string;
  updatedAt: string;
}
export interface BirdCoderIamAuditEventSummary {
  id: string; tenantId: string; organizationId?: string; actorUserId?: string;
  action: string; resourceType: string; resourceId: string; traceId?: string;
  appId?: string; environment?: string; shardingKey?: string;
  detail: Record<string, unknown>; createdAt?: string;
}
export interface BirdCoderIamPolicySummary {
  id: string; tenantId: string; code: string; name: string;
  policy: Record<string, unknown>; status: string; createdAt?: string; updatedAt?: string;
}
