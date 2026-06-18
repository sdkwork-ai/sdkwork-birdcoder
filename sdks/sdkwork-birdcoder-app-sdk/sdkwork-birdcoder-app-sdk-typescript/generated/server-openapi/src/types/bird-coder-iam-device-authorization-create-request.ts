export interface BirdCoderIamDeviceAuthorizationCreateRequest {
  purpose: 'login' | 'register';
  redirectUri?: string;
}
