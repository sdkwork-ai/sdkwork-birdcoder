# @sdkwork/birdcoder-pc-infrastructure

PC runtime composition and adapter package for SDKWork BirdCoder. Its
machine-readable integration contract is
[specs/component.spec.json](./specs/component.spec.json).

## Public API

The package exports runtime composition, generated SDK adapters, typed service
ports, Drive/document/prompt/skill integrations, and native host adapters through
the `exports` map in [package.json](./package.json). It intentionally exposes no
storage repository, SQL executor, projection, or handwritten transport surface.

## Required SDK Surface

The PC core declares the authenticated BirdCoder, Agents, Skills, Prompts,
Documents, Drive, IAM, Messaging, Membership, and Order SDK inventory. This
package consumes only PC core SDK exports or injected service ports. Its
dependency-client factory binds Documents and Prompts clients to the shared
application TokenManager without exposing generated transports. Project document
reads first resolve an enabled Agents `document` / `documents` composition slot;
the Documents client remains lazy when a project has no such slot.

## Configuration

Runtime topology is supplied through typed application bootstrap as two fields:
`applicationApiBaseUrl` for the BirdCoder-owned SDK and
`platformApiGatewayBaseUrl` for dependency SDKs. `sdkBaseUrls` validates gateway
roots and rejects credentials, query strings, fragments, generated API paths,
missing values, and cross-plane fallbacks. Feature code receives service ports
or generated SDK clients and does not read environment variables or assemble
authentication headers.

## Deployment Profile And Runtime Target Behavior

Browser development binds dependency SDKs to `/__sdkwork/platform`, whose Vite
proxy target is the server-only platform topology value. Tauri binds the
embedded application ingress returned by `desktop_runtime_config` and a
separately configured direct platform gateway. Cloud and standalone profiles
retain the same SDK contracts and fail before service bootstrap when either
required connection plane is unavailable.

## Security

Desktop IAM session payloads use the Tauri secure-session commands and the
operating-system credential store. Generic local KV, SQLite, localStorage, and
business repositories are outside the credential path. Persistence failures are
reported through `sdkwork:desktop-app-session-persistence-error` and never fall
back to plaintext storage.

## Extension Points

Add capabilities by implementing an existing typed port. A new remote SDK must
first be declared and exported by PC core, then consumed here through that
stable entrypoint. New business persistence and raw HTTP fallbacks are not
extension points of this package.

## Verification

- `pnpm --dir apps/sdkwork-birdcoder-pc typecheck`
- `node scripts/desktop-app-session-persistence-contract.test.mjs`
- `node scripts/pc-local-business-storage-boundary-contract.test.mjs`
- `node scripts/run-local-tsx.mjs scripts/pc-runtime-boundary-ports-contract.test.ts`
- `node scripts/vite-config-esm-contract.test.mjs`
