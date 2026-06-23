# sdkwork-birdcoder-app-sdk (Flutter)

Generated SDKWork v3 dual-token transport SDK.

## Installation

Add to `pubspec.yaml`:

```yaml
dependencies:
  sdkwork_birdcoder_app_sdk: ^0.1.0
```

## Quick Start

```dart
import 'package:sdkwork_birdcoder_app_sdk/sdkwork_birdcoder_app_sdk.dart';

final client = SdkworkAppClient.withBaseUrl(baseUrl: '/app/v3/api');
client.setAuthToken('your-auth-token');
client.setAccessToken('your-access-token');

// Use the SDK
final result = await client.auth.sessionsCurrentRetrieve();
print(result);
```

## Authentication

```text
Authorization: Bearer <authToken>
Access-Token: <accessToken>
```


## Configuration (Non-Auth)

```dart
final client = SdkworkAppClient.withBaseUrl(baseUrl: '/app/v3/api');

// Set custom headers
client.setHeader('X-Custom-Header', 'value');
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
```dart
// List coding sessions
final params = <String, dynamic>{
  'workspaceId': '1',
  'projectId': '1',
  'engineId': 'codex',
  'limit': 4,
  'offset': 5,
};
final result = await client.intelligence.codingSessionsList(params);
print(result);
```

### system
```dart
// Get coding-server descriptor
final result = await client.system.descriptorRetrieve();
print(result);
```

### runtime
```dart
// List available engines
final result = await client.runtime.enginesList();
print(result);
```

### oauth
```dart
// Resolve OAuth authorization URL for SDKWork IAM sign-in
final body = BirdCoderIamOAuthAuthorizationCreateRequest(
  provider: 'provider',
  redirectUri: 'redirecturi',
  scope: 'scope',
  state: 'state',
);
final result = await client.oauth.authorizationUrlsCreate(body);
print(result);
```

### auth
```dart
// Get current SDKWork IAM session
final result = await client.auth.sessionsCurrentRetrieve();
print(result);
```

### iam
```dart
// Get current SDKWork IAM user
final result = await client.iam.usersCurrentRetrieve();
print(result);
```

### templates
```dart
// List app templates
final result = await client.templates.appTemplatesList();
print(result);
```

### platform
```dart
// List deployments
final result = await client.platform.deploymentsList();
print(result);
```

### content
```dart
// List project documents
final result = await client.content.documentsList();
print(result);
```

### skills
```dart
// List skill packages
final params = <String, dynamic>{
  'userId': '1',
  'workspaceId': '1',
};
final result = await client.skills.skillPackagesList(params);
print(result);
```

### collaboration
```dart
// List workspace teams
final params = <String, dynamic>{
  'userId': '1',
  'workspaceId': '1',
};
final result = await client.collaboration.workspaceTeamsList(params);
print(result);
```

### commerce
```dart
// Get current SDKWork commerce membership
final result = await client.commerce.membershipsCurrentRetrieve();
print(result);
```

## Error Handling

```dart
try {
  final result = await client.auth.sessionsCurrentRetrieve();
  print(result);
} catch (e) {
  print('Error: $e');
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

> Ensure `dart pub publish --dry-run` passes before release publish.

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
