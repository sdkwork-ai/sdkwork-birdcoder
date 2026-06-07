# sdkwork-birdcoder-backend-sdk (Rust)

Professional Rust SDK for SDKWork API.

## Installation

```bash
cargo add sdkwork-birdcoder-backend-sdk
```

## Quick Start

```rust
use sdkwork_birdcoder_backend_sdk::{SdkworkBackendClient, SdkworkConfig};


#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = SdkworkBackendClient::new(SdkworkConfig::new("/backend/v3/api"))?;
    client.set_api_key("your-api-key");

    let result = client.iam().api_keys_list().await?;
    println!("{result:?}");
    Ok(())
}
```

## Authentication Modes (Mutually Exclusive)

Choose exactly one mode for the same client instance.

### Mode A: API Key

```rust
let client = SdkworkBackendClient::new(SdkworkConfig::new("/backend/v3/api"))?;
client.set_api_key("your-api-key");
// Sends: Access-Token: <apiKey>
```

### Mode B: Dual Token

```rust
let client = SdkworkBackendClient::new(SdkworkConfig::new("/backend/v3/api"))?;
client.set_auth_token("your-auth-token");
client.set_access_token("your-access-token");
// Sends:
// Authorization: Bearer <authToken>
// Access-Token: <accessToken>
```

> Do not call `set_api_key(...)` together with `set_auth_token(...)` + `set_access_token(...)` on the same client.

## Configuration (Non-Auth)

```rust
let client = SdkworkBackendClient::new(SdkworkConfig::new("/backend/v3/api"))?;
client.set_header("X-Custom-Header", "value");
```

## API Modules

- `client.iam()` - iam API
- `client.platform()` - platform API

## Usage Examples

### iam

```rust
// List SDKWork IAM API keys
let result = client.iam().api_keys_list().await?;
println!("{result:?}");
```

### platform

```rust
// List governed deployments
let result = client.platform().deployment_governance_list().await?;
println!("{result:?}");
```

## Error Handling

```rust
use sdkwork_birdcoder_backend_sdk::{SdkworkBackendClient, SdkworkConfig};


let client = SdkworkBackendClient::new(SdkworkConfig::new("/backend/v3/api"))?;

let outcome: Result<(), _> = async {
    client.iam().api_keys_list().await?;
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
