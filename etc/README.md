# Source Configuration

`sdkwork.deployment.config.json` is the Birdcoder deployment index. It selects the
`standalone|cloud` and `development|test|staging|production` topology profile. Gateway TOML files
live beside the index. Environment variables and CLI flags are runtime overrides only.

Committed config contains no passwords, tokens, API keys, private keys, or local absolute paths.
Use ignored `*.local.*` files and platform secret injection for private values.

## Code-engine sandbox policy

`code-engine-sandbox.json` defines the safe, tracked default for code-agent process access. The
default `all-drives` mode maps to Codex `danger-full-access`: it can use every filesystem path the
current operating-system process account can access, but it does not bypass operating-system ACLs.
Set `BIRDCODER_CODE_ENGINE_SANDBOX_CONFIG` only when an operator needs to load the same schema from
another runtime-managed path.

Supported `accessMode` values are `all-drives`, `directories`, and `read-only`. A `directories`
policy requires a non-empty `allowedDirectories` list; each path is canonicalized before the
selected project working directory is authorized. Each turn binds one selected project directory;
the list controls which project roots may be selected, not simultaneous cross-root writes in one
turn. Do not commit machine-specific absolute paths in this tracked default file.

Authenticated administrator overrides are stored through the existing IAM policy backend API and
its database/audit flow. The effective order is user policy, tenant policy, this `etc` default, then
the built-in `all-drives` fallback. Use these policy codes:

- Tenant: `birdcoder.code-engine-sandbox.tenant`
- User: `birdcoder.code-engine-sandbox.user.<userId>`

The `policyJson` value uses this shape:

```json
{
  "policyCategory": "code-engine-sandbox",
  "scopeType": "tenant",
  "scopeId": "authenticated-tenant-id",
  "accessMode": "directories",
  "allowedDirectories": ["D:\\approved-workspaces"]
}
```

For a user policy, set `scopeType` to `user` and `scopeId` to the authenticated user ID. Invalid or
scope-mismatched active policies fail closed and prevent code-engine execution until corrected.
