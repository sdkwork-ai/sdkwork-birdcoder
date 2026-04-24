/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BIRDCODER_API_BASE_URL?: string;
  readonly VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT?: string;
  readonly VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL?: string;
  readonly VITE_BIRDCODER_AUTH_DEV_DEFAULT_LOGIN_METHOD?: string;
  readonly VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD?: string;
  readonly VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE?: string;
  readonly VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED?: string;
  readonly VITE_BIRDCODER_IDENTITY_DEPLOYMENT_MODE?: string;
  readonly VITE_BIRDCODER_USER_CENTER_LOGIN_PROVIDER?: string;
}
