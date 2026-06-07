# sdkwork-birdcoder-app-sdk (Rust)

Professional Rust SDK for SDKWork API.

## Installation

```bash
cargo add sdkwork-birdcoder-app-sdk
```

## Quick Start

```rust
use sdkwork_birdcoder_app_sdk::{SdkworkAppClient, SdkworkConfig};


#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = SdkworkAppClient::new(SdkworkConfig::new("/app/v3/api"))?;
    client.set_api_key("your-api-key");

    let result = client.auth().sessions_current_retrieve().await?;
    println!("{result:?}");
    Ok(())
}
```

## Authentication Modes (Mutually Exclusive)

Choose exactly one mode for the same client instance.

### Mode A: API Key

```rust
let client = SdkworkAppClient::new(SdkworkConfig::new("/app/v3/api"))?;
client.set_api_key("your-api-key");
// Sends: Access-Token: <apiKey>
```

### Mode B: Dual Token

```rust
let client = SdkworkAppClient::new(SdkworkConfig::new("/app/v3/api"))?;
client.set_auth_token("your-auth-token");
client.set_access_token("your-access-token");
// Sends:
// Authorization: Bearer <authToken>
// Access-Token: <accessToken>
```

> Do not call `set_api_key(...)` together with `set_auth_token(...)` + `set_access_token(...)` on the same client.

## Configuration (Non-Auth)

```rust
let client = SdkworkAppClient::new(SdkworkConfig::new("/app/v3/api"))?;
client.set_header("X-Custom-Header", "value");
```

## API Modules

- `client.intelligence()` - intelligence API
- `client.system()` - system API
- `client.runtime()` - runtime API
- `client.auth()` - auth API
- `client.iam()` - iam API
- `client.open_platform()` - open_platform API
- `client.templates()` - templates API
- `client.platform()` - platform API
- `client.content()` - content API
- `client.skills()` - skills API
- `client.collaboration()` - collaboration API
- `client.commerce()` - commerce API

## Usage Examples

### intelligence

```rust
use std::collections::HashMap;
// List coding sessions
let mut query = HashMap::new();
query.insert("workspaceId".to_string(), serde_json::json!("1"));
query.insert("projectId".to_string(), serde_json::json!("1"));
query.insert("engineId".to_string(), serde_json::json!("codex"));
query.insert("limit".to_string(), serde_json::json!(4));
query.insert("offset".to_string(), serde_json::json!(5));
let result = client.intelligence().coding_sessions_list(Some(&query)).await?;
println!("{result:?}");
```

### system

```rust
// Get coding-server descriptor
let result = client.system().descriptor_retrieve().await?;
println!("{result:?}");
```

### runtime

```rust
// List available engines
let result = client.runtime().engines_list().await?;
println!("{result:?}");
```

### auth

```rust
// Get current SDKWork IAM session
let result = client.auth().sessions_current_retrieve().await?;
println!("{result:?}");
```

### iam

```rust
// Get current SDKWork IAM user
let result = client.iam().users_current_retrieve().await?;
println!("{result:?}");
```

### open_platform

```rust
use sdkwork_birdcoder_app_sdk::*;
// Create SDKWork IAM QR auth session
let body = BirdCoderIamQrAuthSessionCreateRequest {
    purpose: "login".to_string(),
    redirect_uri: Some("redirecturi".to_string()),
    ..Default::default()
};
let result = client.open_platform().qr_auth_sessions_create(&body).await?;
println!("{result:?}");
```

### templates

```rust
// List app templates
let result = client.templates().app_templates_list().await?;
println!("{result:?}");
```

### platform

```rust
// List deployments
let result = client.platform().deployments_list().await?;
println!("{result:?}");
```

### content

```rust
// List project documents
let result = client.content().documents_list().await?;
println!("{result:?}");
```

### skills

```rust
use std::collections::HashMap;
// List skill packages
let mut query = HashMap::new();
query.insert("userId".to_string(), serde_json::json!("1"));
query.insert("workspaceId".to_string(), serde_json::json!("1"));
let result = client.skills().skill_packages_list(Some(&query)).await?;
println!("{result:?}");
```

### collaboration

```rust
use std::collections::HashMap;
// List workspace teams
let mut query = HashMap::new();
query.insert("userId".to_string(), serde_json::json!("1"));
query.insert("workspaceId".to_string(), serde_json::json!("1"));
let result = client.collaboration().workspace_teams_list(Some(&query)).await?;
println!("{result:?}");
```

### commerce

```rust
// Get current SDKWork commerce membership
let result = client.commerce().memberships_current_retrieve().await?;
println!("{result:?}");
```

## Error Handling

```rust
use sdkwork_birdcoder_app_sdk::{SdkworkAppClient, SdkworkConfig};


let client = SdkworkAppClient::new(SdkworkConfig::new("/app/v3/api"))?;

let outcome: Result<(), _> = async {
    client.auth().sessions_current_retrieve().await?;
    Ok(())
}.await;

match outcome {
    Ok(()) => println!("request completed"),
    Err(error) => eprintln!("request failed: {error}"),
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

> Set cargo registry credentials before `cargo publish` and use `--dry-run` first.

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
