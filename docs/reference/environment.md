# Environment

BirdCoder keeps identity and release configuration explicit and machine-readable. The canonical deployment-profile, command-matrix, and seed-contract rules come from `sdkwork-appbase`; this page is the BirdCoder operator-facing reference for the env names that those contracts resolve to.

## Deployment selectors

- `BIRDCODER_IDENTITY_DEPLOYMENT_MODE`
- `BIRDCODER_USER_CENTER_LOGIN_PROVIDER`
- `BIRDCODER_USER_CENTER_PROVIDER_KEY`
- `BIRDCODER_API_BASE_URL`
- `VITE_BIRDCODER_API_BASE_URL`
- `BIRDCODER_CODING_SERVER_SQLITE_FILE`

These selectors choose one canonical deployment profile before runtime bootstrap:

- `desktop-local`: embedded builtin-local authority, SQLite storage, local bootstrap seed enabled
- `server-private`: dedicated BirdCoder server with the same facade routes, provider kind can be `builtin-local` or `external-user-center`
- `cloud-saas`: BirdCoder server delegates identity to `sdkwork-cloud-app-api` and must not fall back to builtin-local authority seed

## Builtin-local bootstrap and fast-login variables

- `BIRDCODER_LOCAL_BOOTSTRAP_EMAIL`
- `BIRDCODER_LOCAL_BOOTSTRAP_PHONE`
- `BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD`
- `BIRDCODER_LOCAL_VERIFY_CODE_FIXED`
- `BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT`
- `VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED`
- `VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT`
- `VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL`
- `VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE`
- `VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD`
- `VITE_BIRDCODER_AUTH_DEV_DEFAULT_LOGIN_METHOD`
- `VITE_BIRDCODER_AUTH_LEFT_RAIL_MODE`

`desktop-local` and `server-private` with `builtin-local` default the local bootstrap user, fixed verification code, and development-prefill values so the shared auth UI can exercise password, email-code, and phone-code login without manual typing. When the authority has no active projects, BirdCoder also creates one starter project beside the sqlite authority file under `bootstrap-projects/<sqlite-file-stem>/100000000000000201` unless `BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT` overrides the directory.

## Local OAuth sample variables

- `BIRDCODER_LOCAL_OAUTH_PROVIDERS`
- `BIRDCODER_LOCAL_OAUTH_WECHAT_NAME`
- `BIRDCODER_LOCAL_OAUTH_WECHAT_EMAIL`
- `BIRDCODER_LOCAL_OAUTH_DOUYIN_NAME`
- `BIRDCODER_LOCAL_OAUTH_DOUYIN_EMAIL`
- `BIRDCODER_LOCAL_OAUTH_GITHUB_NAME`
- `BIRDCODER_LOCAL_OAUTH_GITHUB_EMAIL`

These variables only affect the builtin-local provider lane. The same BirdCoder facade routes stay stable at `/api/app/v1/auth/oauth/url` and `/api/app/v1/auth/oauth/login`.

## Cloud app-api bridge variables

- `BIRDCODER_USER_CENTER_APP_API_BASE_URL`
- `BIRDCODER_USER_CENTER_APP_API_TIMEOUT_MS`
- `BIRDCODER_USER_CENTER_APP_API_APP_ID`
- `BIRDCODER_USER_CENTER_APP_API_SECRET_ID`
- `BIRDCODER_USER_CENTER_APP_API_SHARED_SECRET`
- `BIRDCODER_USER_CENTER_APP_API_OAUTH_PROVIDERS`

Cloud mode is fail-closed. If these upstream bridge variables are incomplete, `identity:doctor:*:cloud` and cloud server startup must report the configuration gap instead of synthesizing builtin-local fallback identity data.

## External user-center bridge variables

- `BIRDCODER_USER_CENTER_EXTERNAL_ID_HEADER`
- `BIRDCODER_USER_CENTER_EXTERNAL_EMAIL_HEADER`
- `BIRDCODER_USER_CENTER_EXTERNAL_NAME_HEADER`
- `BIRDCODER_USER_CENTER_EXTERNAL_AVATAR_HEADER`

The external-provider lane still runs under the `server-private` identity mode, but the provider kind becomes `external-user-center`. Frontend code continues to call the same BirdCoder facade routes and does not branch on provider kind.

## Seed and prefill policy

- builtin-local modes seed the bootstrap user, fixed verification code, and starter workspace when canonical seed contracts allow it
- remote-provider modes do not invent builtin-local fallback users, verification codes, or starter projects
- development prefill is automatic for builtin-local development and test flows
- cloud and external-provider flows only receive development prefill when explicit values are configured

Use the canonical inspectors when you need to see or validate the resolved policy:

```bash
pnpm identity:show:desktop:local
pnpm identity:show:web:private
pnpm identity:show:server:cloud
pnpm identity:doctor:desktop:local
pnpm identity:doctor:web:private
pnpm identity:doctor:server:cloud
```

## Common release variables

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

## Guidance

Use workspace defaults for normal development. Override variables only when you need to validate a specific deployment slice, point at a real upstream authority, or package a release artifact. For canonical contract ownership and generated deployment-profile semantics, refer back to `sdkwork-appbase/packages/pc-react/identity`.
