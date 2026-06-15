export interface BirdCoderIamTenantMemberSummary {
  id: string;
  tenantId: string;
  userId: string;
  roleCode: string;
  status: string;
  joinedAt?: string;
  leftAt?: string;
  remark?: string;
}
