# sdkwork-birdcoder-app-sdk

Generated SDKWork v3 dual-token transport SDK.

## Installation

```bash
npm install @sdkwork/birdcoder-app-sdk
# or
yarn add @sdkwork/birdcoder-app-sdk
# or
pnpm add @sdkwork/birdcoder-app-sdk
```

## Quick Start

```typescript
import { SdkworkAppClient } from '@sdkwork/birdcoder-app-sdk';

const client = new SdkworkAppClient({
  baseUrl: '/app/v3/api',
  timeout: 30000,
});

// Authentication
client.setAuthToken('your-auth-token');
client.setAccessToken('your-access-token');

// Use the SDK
const body = {
  account: 'account',
  appVersion: 'appVersion',
  code: 'code',
  deviceId: 'deviceId',
  deviceName: 'deviceName',
  deviceType: 'android',
  email: 'email',
  grantType: 'password',
  loginMethod: 'emailCode',
  password: 'password',
  phone: 'phone',
  username: 'username',
};
const result = await client.auth.sessions.create(body);
```

## Authentication

```text
Authorization: Bearer <authToken>
Access-Token: <accessToken>
```


## Configuration (Non-Auth)

```typescript
import { SdkworkAppClient } from '@sdkwork/birdcoder-app-sdk';

const client = new SdkworkAppClient({
  baseUrl: '/app/v3/api',
  timeout: 30000, // Request timeout in ms
  headers: {      // Custom headers
    'X-Custom-Header': 'value',
  },
});
```

## API Modules

- `client.intelligence` - intelligence API
- `client.system` - system API
- `client.runtime` - runtime API
- `client.oauth` - oauth API
- `client.auth` - auth API
- `client.iam` - iam API
- `client.templates` - templates API
- `client.platform` - platform API
- `client.content` - content API
- `client.skills` - skills API
- `client.collaboration` - collaboration API
- `client.commerce` - commerce API

## Usage Examples

### intelligence

```typescript
// List coding sessions
const params = {
  workspaceId: 'workspaceId',
  projectId: 'projectId',
  engineId: 'codex',
  page: 4,
  page_size: 5,
};
const result = await client.intelligence.codingSessions.list(params);
```

### system

```typescript
// Get coding-server descriptor
const result = await client.system.descriptor.retrieve();
```

### runtime

```typescript
// List available engines
const result = await client.runtime.engines.list();
```

### oauth

```typescript
// Resolve OAuth authorization URL for SDKWork IAM sign-in
const body = {
  provider: 'provider',
  redirectUri: 'redirectUri',
  scope: 'scope',
  state: 'state',
};
const result = await client.oauth.authorizationUrls.create(body);
```

### auth

```typescript
// Create SDKWork IAM session
const body = {
  account: 'account',
  appVersion: 'appVersion',
  code: 'code',
  deviceId: 'deviceId',
  deviceName: 'deviceName',
  deviceType: 'android',
  email: 'email',
  grantType: 'password',
  loginMethod: 'emailCode',
  password: 'password',
  phone: 'phone',
  username: 'username',
};
const result = await client.auth.sessions.create(body);
```

### iam

```typescript
// Get current SDKWork IAM user
const result = await client.iam.users.current.retrieve();
```

### templates

```typescript
// List app templates
const params = {
  page: 1,
  page_size: 2,
};
const result = await client.templates.appTemplates.list(params);
```

### platform

```typescript
// List deployments
const params = {
  page: 1,
  page_size: 2,
};
const result = await client.platform.deployments.list(params);
```

### content

```typescript
// List project documents
const params = {
  projectId: 'projectId',
  page: 2,
  page_size: 3,
};
const result = await client.content.documents.list(params);
```

### skills

```typescript
// List skill packages
const params = {
  userId: 'userId',
  workspaceId: 'workspaceId',
  page: 3,
  page_size: 4,
};
const result = await client.skills.skillPackages.list(params);
```

### collaboration

```typescript
// List workspace teams
const params = {
  userId: 'userId',
  workspaceId: 'workspaceId',
};
const result = await client.collaboration.workspaceTeams.list(params);
```

### commerce

```typescript
// Get current SDKWork commerce membership
const result = await client.commerce.memberships.current.retrieve();
```

## Error Handling

```typescript
import { SdkworkAppClient, NetworkError, TimeoutError, AuthenticationError } from '@sdkwork/birdcoder-app-sdk';

try {
  const body = {
    account: 'account',
    appVersion: 'appVersion',
    code: 'code',
    deviceId: 'deviceId',
    deviceName: 'deviceName',
    deviceType: 'android',
    email: 'email',
    grantType: 'password',
    loginMethod: 'emailCode',
    password: 'password',
    phone: 'phone',
    username: 'username',
  };
  const result = await client.auth.sessions.create(body);
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out:', error.message);
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
  } else {
    throw error;
  }
}
```

## Publishing

This SDK includes cross-platform publish scripts in `bin/`:
- `bin/publish-core.mjs`
- `bin/publish.sh`
- `bin/publish.ps1`

### Check

```bash
./bin/publish.sh --action check
```

### Publish

```bash
./bin/publish.sh --action publish --channel release
```

```powershell
.\bin\publish.ps1 --action publish --channel test --dry-run
```

> Configure npm registry credentials before release publish.

## License

MIT

## Regeneration Contract

- HTTP/OpenAPI generator-owned files are tracked in `.sdkwork/sdkwork-generator-manifest.json`.
- HTTP/OpenAPI generation also writes `.sdkwork/sdkwork-generator-changes.json` so automation can inspect created, updated, deleted, unchanged, scaffolded, and backed-up files plus the classified impact areas, verification plan, and execution decision for the latest generation.
- HTTP/OpenAPI apply mode also writes `.sdkwork/sdkwork-generator-report.json` with the full execution report, including `schemaVersion`, `generator`, stable artifact paths, and the execution handoff commands that match CLI `--json` output.
- CLI JSON output also includes an execution handoff with concrete next commands, including reviewed apply commands for dry-run flows.
- Put HTTP/OpenAPI hand-written wrappers, adapters, and orchestration in `custom/`.
- Files scaffolded under `custom/` are created once and preserved across HTTP/OpenAPI regenerations.
- If an HTTP/OpenAPI generated-owned file was modified locally, its previous content is copied to `.sdkwork/manual-backups/` before overwrite or removal.
- RPC SDK source workspaces use convention-first evidence by default: RPC SDK family naming, language workspace naming, `rpc/*.manifest.json`, proto source references, generated client source, and native package manifests.
- Use `sdkgen inspect --protocol rpc` to verify RPC convention evidence. Request persisted generator evidence only with `--emit-control-plane` for release, CI, audit, or migration workflows; evidence paths are derived by generator convention.
