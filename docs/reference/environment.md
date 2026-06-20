# Environment

BirdCoder uses the SDKWork IAM environment model directly. The app does not define a second identity provider, user bridge, or compatibility mode.

## Deployment Selectors

- `BIRDCODER_IAM_DEPLOYMENT_MODE`
- `SDKWORK_IAM_MODE`
- `BIRDCODER_API_BASE_URL`
- `VITE_BIRDCODER_API_BASE_URL`
- `VITE_BIRDCODER_IAM_DEPLOYMENT_MODE`
- `VITE_SDKWORK_DEPLOYMENT_MODE`
- `BIRDCODER_CODING_SERVER_SQLITE_FILE`

Supported deployment modes:

- `desktop-local`: embedded BirdCoder server, local SDKWork IAM authority, local SQLite storage
- `server-private`: browser or desktop client targets a private BirdCoder server with SDKWork IAM private authority
- `cloud-saas`: BirdCoder server delegates IAM to SDKWork cloud app API

Public frontend mode uses `VITE_SDKWORK_DEPLOYMENT_MODE=local`, `private`, or `saas`. Server-side SDKWork IAM mode uses `SDKWORK_IAM_MODE=local`, `private`, or `cloud`.

## Local Developer Prefill

- `SDKWORK_IAM_DEV_FIXED_VERIFY_CODE`
- `SDKWORK_IAM_OAUTH_PROVIDERS`
- `BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT`
- `VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED`
- `VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT`
- `VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL`
- `VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE`
- `VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD`
- `VITE_BIRDCODER_AUTH_DEV_DEFAULT_LOGIN_METHOD`
- `VITE_BIRDCODER_AUTH_LEFT_RAIL_MODE`

`desktop-local` and `server-private` may set `SDKWORK_IAM_DEV_FIXED_VERIFY_CODE` for deterministic verification-code flows during development. Optional auth-form prefill uses explicit `VITE_BIRDCODER_AUTH_DEV_*` values only; IAM identity still comes from register/login APIs and JWT dual tokens.

## Cloud IAM App API

- `SDKWORK_IAM_APP_API_BASE_URL`
- `SDKWORK_IAM_APP_API_TIMEOUT_MS`
- `SDKWORK_IAM_APP_ID`
- `SDKWORK_IAM_SECRET_ID`
- `SDKWORK_IAM_SHARED_SECRET`
- `SDKWORK_IAM_APP_API_OAUTH_PROVIDERS`

Cloud mode is fail-closed. If the SDKWork IAM app API base URL or credentials are incomplete, cloud doctor/startup checks must report the configuration gap instead of creating local fallback identity data.

## Common Release Variables

- `SDKWORK_RELEASE_TAG`
- `SDKWORK_RELEASE_OUTPUT_DIR`
- `SDKWORK_RELEASE_ASSETS_DIR`
- `SDKWORK_RELEASE_PLATFORM`
- `SDKWORK_RELEASE_ARCH`
- `SDKWORK_RELEASE_TARGET`
- `SDKWORK_RELEASE_ACCELERATOR`
- `SDKWORK_RELEASE_IMAGE_REPOSITORY`
- `SDKWORK_RELEASE_IMAGE_TAG`
- `SDKWORK_RELEASE_IMAGE_DIGEST`

## Inspection Commands

```bash
pnpm iam:show:desktop:local
pnpm iam:show:web:private
pnpm iam:show:server:cloud
pnpm iam:doctor:desktop:local
pnpm iam:doctor:web:private
pnpm iam:doctor:server:cloud
```

Use workspace defaults for normal development. Override variables only when validating a specific deployment lane, pointing at a real SDKWork IAM cloud authority, or packaging a release artifact.
