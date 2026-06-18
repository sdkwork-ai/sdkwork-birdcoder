export interface BirdCoderIamPasswordResetCreateRequest {
  account: string;
  code: string;
  confirmPassword?: string;
  newPassword: string;
}
