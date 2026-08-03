# Source Configuration

`sdkwork.deployment.config.json` is the Birdcoder deployment index. It selects the
`standalone|cloud` and `development|test|staging|production` topology profile. Gateway TOML files
live beside the index. Environment variables and CLI flags are runtime overrides only.

Committed config contains no passwords, tokens, API keys, private keys, or local absolute paths.
Use ignored `*.local.*` files and platform secret injection for private values.

## SDKWork Deploy module environment

The standalone gateway composes the SDKWork Deploy App API (`sdkwork-deployments` api-assembly):
the Deploy routes (`/app/v3/api/domain_zones|sites|certificates|upload_sessions|artifacts`),
its PostgreSQL module (`deploy_*` tables, migrated at gateway startup), and the Drive port all run
inside the BirdCoder gateway process — no separate Deploy Server instance is required.

Each `topology/<profile>.env` file declares the `SDKWORK_DEPLOY_*` keys for that profile:

- `SDKWORK_DEPLOY_ENVIRONMENT` — canonical `development|test|staging|production`; values
  `test|staging|production` are production-like and enforce the production runtime gates
  (Drive facade required, static Snowflake node forbidden).
- `SDKWORK_DEPLOY_USE_MEMORY_DRIVE=1` / `SDKWORK_DEPLOY_USE_MEMORY_CONTENT_PROVIDER=true` —
  development profiles only; they bypass the Drive/content-provider HTTP facades so the full
  publish pipeline writes the local PostgreSQL database without extra hosts.
- `SDKWORK_DEPLOY_SNOWFLAKE_NODE_ID` — static Snowflake node id, development profiles only
  (production-like profiles allocate nodes through the database lease).
- `SDKWORK_DRIVE_FACADE_URL` — production-like profiles route Drive uploads through the gateway's
  own Drive API (`application.public-ingress` origin); remaining production runtime values
  (ingress tokens, web runtime URLs) are injected by the deployment platform.

`SDKWORK_DATABASE_URL` and friends are shared with every other module (see `.env.postgres`);
the Deploy module registers `deploy_*` tables in the same database.

## Client materialization

Run `pnpm workflow:materialize-client-env` after changing a topology profile. It deterministically derives the
PC and H5 `.env.<standalone|cloud>.<environment>` files plus Flutter
`env/sdkwork.<standalone|cloud>.<environment>.json` dart-define files. These client files contain
only safe public/runtime selectors and a blank bootstrap token field. Run `pnpm check:client-env` in CI
or before a build to reject missing or stale derived profiles.

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
