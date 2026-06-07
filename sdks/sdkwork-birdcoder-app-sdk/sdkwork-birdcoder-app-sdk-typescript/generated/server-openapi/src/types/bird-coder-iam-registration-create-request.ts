export interface BirdCoderIamRegistrationCreateRequest {
  channel?: 'EMAIL' | 'PHONE';
  confirmPassword?: string;
  email?: string;
  name?: string;
  password?: string;
  phone?: string;
  username?: string;
  verificationCode?: string;
}
