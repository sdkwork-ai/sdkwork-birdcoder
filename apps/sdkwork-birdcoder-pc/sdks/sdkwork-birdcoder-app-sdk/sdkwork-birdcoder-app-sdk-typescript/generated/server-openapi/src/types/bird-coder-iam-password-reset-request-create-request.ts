export interface BirdCoderIamPasswordResetRequestCreateRequest {
  account: string;
  channel: 'EMAIL' | 'SMS';
}
