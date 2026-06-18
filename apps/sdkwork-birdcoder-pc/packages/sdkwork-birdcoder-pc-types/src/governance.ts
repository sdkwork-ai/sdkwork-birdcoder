export const BIRDCODER_PERFORMANCE_BUDGETS = {
  webInteractiveMs: 3_000,
  webEntryJsBytes: 500 * 1024,
  webAnyJsAssetBytes: 700 * 1024,
  webPlatformRuntimeJsBytes: 560 * 1024,
  webMarkdownJsBytes: 500 * 1024,
  webCodeHighlightJsBytes: 200 * 1024,
  desktopColdStartMs: 5_000,
  firstTokenMs: 2_000,
  previewRefreshMs: 1_500,
  largeRepoRequiresAsync: true,
} as const;

export const BIRDCODER_RISK_LEVELS = ['P0', 'P1', 'P2', 'P3'] as const;
export type BirdcoderRiskLevel = (typeof BIRDCODER_RISK_LEVELS)[number];

export const BIRDCODER_APPROVAL_POLICIES = [
  'AutoAllow',
  'OnRequest',
  'Restricted',
  'ReleaseOnly',
] as const;
export type BirdcoderApprovalPolicy = (typeof BIRDCODER_APPROVAL_POLICIES)[number];

export const BIRDCODER_APPROVAL_DECISIONS = [
  'auto_allowed',
  'approved',
  'denied',
  'blocked',
] as const;
export type BirdcoderApprovalDecision = (typeof BIRDCODER_APPROVAL_DECISIONS)[number];

export const BIRDCODER_AUDIT_EVENT_FIELDS = [
  'traceId',
  'engine',
  'tool',
  'riskLevel',
  'approvalDecision',
  'inputDigest',
  'outputDigest',
  'artifactRefs',
  'operator',
] as const;
export type BirdcoderAuditEventField = (typeof BIRDCODER_AUDIT_EVENT_FIELDS)[number];

export const BIRDCODER_AUDIT_EVENT_CATEGORIES = [
  'tool.call',
  'engine.switch',
  'approval.policy.change',
  'release.action',
  'dangerous.command',
  'secret.access',
] as const;
export type BirdcoderAuditEventCategory = (typeof BIRDCODER_AUDIT_EVENT_CATEGORIES)[number];

export interface BirdcoderAuditEvent {
  category: BirdcoderAuditEventCategory;
  traceId: string;
  engine: string;
  tool: string;
  riskLevel: BirdcoderRiskLevel;
  approvalDecision: BirdcoderApprovalDecision;
  inputDigest: string;
  outputDigest: string;
  artifactRefs: string[];
  operator: string;
}

export const BIRDCODER_GOVERNANCE_BASELINE = {
  performanceBudgets: BIRDCODER_PERFORMANCE_BUDGETS,
  riskLevels: BIRDCODER_RISK_LEVELS,
  approvalPolicies: BIRDCODER_APPROVAL_POLICIES,
  auditEventFields: BIRDCODER_AUDIT_EVENT_FIELDS,
  auditEventCategories: BIRDCODER_AUDIT_EVENT_CATEGORIES,
} as const;
