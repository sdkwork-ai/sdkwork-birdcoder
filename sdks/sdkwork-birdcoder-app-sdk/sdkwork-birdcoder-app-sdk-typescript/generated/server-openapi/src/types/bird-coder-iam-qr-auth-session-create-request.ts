export interface BirdCoderIamQrAuthSessionCreateRequest {
  purpose: 'login' | 'register';
  redirectUri?: string;
}
