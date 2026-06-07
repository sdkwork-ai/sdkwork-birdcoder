# sdkwork-birdcoder-app-sdk

Professional TypeScript SDK for SDKWork API.

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

// Mode A: API Key (recommended for server-to-server calls)
client.setApiKey('your-api-key');

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

## Authentication Modes (Mutually Exclusive)

Choose exactly one mode for the same client instance.

### Mode A: API Key

```typescript
const client = new SdkworkAppClient({ baseUrl: '/app/v3/api' });
client.setApiKey('your-api-key');
// Sends: Access-Token: <apiKey>
```

### Mode B: Dual Token

```typescript
const client = new SdkworkAppClient({ baseUrl: '/app/v3/api' });
client.setAuthToken('your-auth-token');
client.setAccessToken('your-access-token');
// Sends:
// Authorization: Bearer <authToken>
// Access-Token: <accessToken>
```

> Do not call `setApiKey(...)` together with `setAuthToken(...)` + `setAccessToken(...)` on the same client.

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
- `client.auth` - auth API
- `client.iam` - iam API
- `client.openPlatform` - open_platform API
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
  limit: 4,
  offset: 5,
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

### open_platform

```typescript
// Create SDKWork IAM QR auth session
const body = {
  purpose: 'login',
  redirectUri: 'redirectUri',
};
const result = await client.openPlatform.qrAuth.sessions.create(body);
```

### templates

```typescript
// List app templates
const result = await client.templates.appTemplates.list();
```

### platform

```typescript
// List deployments
const result = await client.platform.deployments.list();
```

### content

```typescript
// List project documents
const result = await client.content.documents.list();
```

### skills

```typescript
// List skill packages
const params = {
  userId: 'userId',
  workspaceId: 'workspaceId',
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

> Set `NPM_TOKEN` (and optional `NPM_REGISTRY_URL`) before release publish.

## License

MIT

## Regeneration Contract

- Generator-owned files are tracked in `.sdkwork/sdkwork-generator-manifest.json`.
- Each run also writes `.sdkwork/sdkwork-generator-changes.json` so automation can inspect created, updated, deleted, unchanged, scaffolded, and backed-up files plus the classified impact areas, verification plan, and execution decision for the latest generation.
- Apply mode also writes `.sdkwork/sdkwork-generator-report.json` with the full execution report, including `schemaVersion`, `generator`, stable artifact paths, and the execution handoff commands that match CLI `--json` output.
- CLI JSON output also includes an execution handoff with concrete next commands, including reviewed apply commands for dry-run flows.
- Put hand-written wrappers, adapters, and orchestration in `custom/`.
- Files scaffolded under `custom/` are created once and preserved across regenerations.
- If a generated-owned file was modified locally, its previous content is copied to `.sdkwork/manual-backups/` before overwrite or removal.
