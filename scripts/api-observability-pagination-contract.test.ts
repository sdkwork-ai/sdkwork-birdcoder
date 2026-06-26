import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const errorsSource = readFileSync(
  new URL('../crates/sdkwork-birdcoder-errors/src/lib.rs', import.meta.url),
  'utf8',
);
const codingSessionsErrorSource = readFileSync(
  new URL('../crates/sdkwork-routes-coding-sessions-app-api/src/error.rs', import.meta.url),
  'utf8',
);
const handlersSource = readFileSync(
  new URL('../crates/sdkwork-routes-coding-sessions-app-api/src/handlers.rs', import.meta.url),
  'utf8',
);
const sdkClientsSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts',
    import.meta.url,
  ),
  'utf8',
);

assert.match(
  errorsSource,
  /pub trace_id: Option<String>/,
  'BirdCoder shared API errors must expose traceId on problem payloads.',
);
assert.match(
  codingSessionsErrorSource,
  /pub fn trace_service_error/,
  'Coding session API errors must provide trace-aware service error mapping.',
);
assert.match(
  errorsSource,
  /trace_id_from_request_id/,
  'BirdCoder shared API errors must expose request-id trace helpers.',
);
const workspaceErrorSource = readFileSync(
  new URL('../crates/sdkwork-routes-workspace-app-api/src/error.rs', import.meta.url),
  'utf8',
);
const workspaceHandlersSource = readFileSync(
  new URL('../crates/sdkwork-routes-workspace-app-api/src/handlers.rs', import.meta.url),
  'utf8',
);
assert.match(
  workspaceErrorSource,
  /sdkwork_birdcoder_errors::(\{[\s\S]*ProblemDetailsPayload|ProblemDetailsPayload)/,
  'Workspace API errors must use shared problem payloads with traceId support.',
);
assert.match(
  workspaceHandlersSource,
  /request_trace_id\(&web\)/,
  'Workspace handlers must attach request trace IDs to error responses.',
);
assert.match(
  errorsSource,
  /pub mod envelope;/,
  'BirdCoder shared API errors must expose canonical list/data envelope builders.',
);
assert.match(
  workspaceHandlersSource,
  /build_offset_list_envelope\(/,
  'Workspace list handlers must return canonical BirdCoder list envelopes.',
);
assert.match(
  handlersSource,
  /build_offset_list_envelope\(/,
  'Coding session list handlers must return canonical BirdCoder list envelopes.',
);
assert.match(
  handlersSource,
  /build_data_envelope\(/,
  'Coding session mutation handlers must return canonical BirdCoder data envelopes.',
);
assert.doesNotMatch(
  handlersSource,
  /ApiListResponse/,
  'Coding session handlers must not return legacy { data, total } list payloads.',
);
assert.match(
  handlersSource,
  /trace_service_error\(/,
  'Coding session handlers must attach request trace IDs to AppError responses.',
);
assert.match(
  workspaceHandlersSource,
  /paginate_vec\(/,
  'Workspace list handlers must apply server-side pagination defaults.',
);
assert.match(
  sdkClientsSource,
  /DEFAULT_SDK_LIST_LIMIT = 20/,
  'SDK list clients must apply the server-aligned default page size.',
);
assert.match(
  sdkClientsSource,
  /withDefaultListLimit\(request\)/,
  'Paginated SDK list queries must apply the default limit helper.',
);
assert.match(
  sdkClientsSource,
  /withDefaultListLimit\(options\)/,
  'Workspace and project SDK list queries must apply the default limit helper.',
);

const openApiSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/index.ts',
    import.meta.url,
  ),
  'utf8',
);
assert.match(
  openApiSource,
  /'workspaces\.list':[\s\S]*limitParameter[\s\S]*offsetParameter/,
  'OpenAPI workspaces.list must document limit and offset query parameters.',
);
assert.match(
  openApiSource,
  /'projects\.list':[\s\S]*limitParameter[\s\S]*offsetParameter/,
  'OpenAPI projects.list must document limit and offset query parameters.',
);

const nativeSessionHandlersSource = readFileSync(
  new URL('../crates/sdkwork-routes-engine-catalog-app-api/src/handlers.rs', import.meta.url),
  'utf8',
);
const membershipHandlersSource = readFileSync(
  new URL('../crates/sdkwork-routes-membership-app-api/src/handlers.rs', import.meta.url),
  'utf8',
);
const authBootstrapSource = readFileSync(
  new URL('../crates/sdkwork-birdcoder-api-server/src/bootstrap/auth.rs', import.meta.url),
  'utf8',
);

assert.match(
  nativeSessionHandlersSource,
  /workspaceId and projectId are required to list native sessions/u,
  'Native session list API must require scoped workspace/project query parameters.',
);
assert.match(
  membershipHandlersSource,
  /Membership lookup is limited to the authenticated user/u,
  'Membership lookup must reject cross-user owner_user_id overrides.',
);
assert.match(
  authBootstrapSource,
  /validate_public_path_prefixes\(&birdcoder_public_path_prefixes\(\)\)/u,
  'BirdCoder API bootstrap must validate route manifest public prefixes before serving traffic.',
);
assert.doesNotMatch(
  authBootstrapSource,
  /validate_public_path_prefixes\(&birdcoder_public_path_prefixes\(\)\)\s*\.expect\(/u,
  'BirdCoder API bootstrap must not panic on route manifest public prefix validation failures.',
);

const alignedRouterCrates = [
  'document-app-api',
  'system-app-api',
  'engine-catalog-app-api',
  'membership-app-api',
  'skill-packages-app-api',
  'deployment-backend-api',
] as const;

for (const crate of alignedRouterCrates) {
  const errorSource = readFileSync(
    new URL(`../crates/sdkwork-routes-${crate}/src/error.rs`, import.meta.url),
    'utf8',
  );
  const handlersSource = readFileSync(
    new URL(`../crates/sdkwork-routes-${crate}/src/handlers.rs`, import.meta.url),
    'utf8',
  );

  assert.match(
    errorSource,
    /sdkwork_birdcoder_errors::(\{[\s\S]*ProblemDetailsPayload|ProblemDetailsPayload)/,
    `${crate} errors must use shared problem payloads with traceId support.`,
  );
  assert.match(
    handlersSource,
    /request_trace_id\(&web\)/,
    `${crate} handlers must attach request trace IDs to error responses.`,
  );
  assert.match(
    handlersSource,
    /build_(data|list|offset_list)_envelope\(/,
    `${crate} handlers must return canonical BirdCoder API envelopes.`,
  );
  assert.doesNotMatch(
    handlersSource,
    /json!\(\{\s*"items":/,
    `${crate} handlers must not return legacy bare { items } list payloads.`,
  );
  assert.doesNotMatch(
    errorSource,
    /#\[derive\(Serialize\)\][\s\S]*pub struct ProblemDetailsPayload/,
    `${crate} must not define a local ProblemDetailsPayload struct.`,
  );
}

const systemHandlersSource = readFileSync(
  new URL('../crates/sdkwork-routes-system-app-api/src/handlers.rs', import.meta.url),
  'utf8',
);
const systemManifestSource = readFileSync(
  new URL('../crates/sdkwork-routes-system-app-api/src/manifest.rs', import.meta.url),
  'utf8',
);
assert.match(
  systemHandlersSource,
  /RequiredIamContext/,
  'System handlers must require authenticated IAM context.',
);
assert.match(
  systemManifestSource,
  /HttpRoute::dual_token/,
  'System route manifest must declare dual_token auth instead of legacy public routes.',
);
assert.doesNotMatch(
  systemManifestSource,
  /HttpRoute::public\(/,
  'System route manifest must not expose legacy public HttpRoute entries.',
);

console.log('api observability and pagination contract passed.');
