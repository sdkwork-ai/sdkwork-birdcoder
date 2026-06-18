export interface BirdCoderIamOrganizationMemberSummary {
  id: string;
  tenantId: string;
  organizationId: string;
  userId: string;
  roleCode: string;
  status: string;
  joinedAt?: string;
  leftAt?: string;
  remark?: string;
}
