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
  /SdkWorkProblemDetail|pub trace_id: String/,
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
const workspaceRequestMapperSource = readFileSync(
  new URL('../crates/sdkwork-routes-workspace-app-api/src/mapper/request.rs', import.meta.url),
  'utf8',
);
const projectPaginationSource = readFileSync(
  new URL('../crates/sdkwork-birdcoder-project-service/src/pagination.rs', import.meta.url),
  'utf8',
);
const SHARED_PROBLEM_PAYLOAD_PATTERN =
  /sdkwork_birdcoder_errors::|traced_platform_problem|traced_problem_json|traced_legacy_problem|SdkWorkProblemDetail|ProblemDetailsPayload/;

assert.match(
  workspaceErrorSource,
  SHARED_PROBLEM_PAYLOAD_PATTERN,
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

const strictOffsetRouteContracts = [
  ['workspace-app-api', workspaceHandlersSource, workspaceRequestMapperSource, 9],
  [
    'deployment-backend-api',
    readFileSync(
      new URL('../crates/sdkwork-routes-deployment-backend-api/src/handlers.rs', import.meta.url),
      'utf8',
    ),
    readFileSync(
      new URL(
        '../crates/sdkwork-routes-deployment-backend-api/src/mapper/request.rs',
        import.meta.url,
      ),
      'utf8',
    ),
    5,
  ],
  [
    'commerce-app-api',
    readFileSync(
      new URL('../crates/sdkwork-routes-commerce-app-api/src/handlers.rs', import.meta.url),
      'utf8',
    ),
    readFileSync(
      new URL('../crates/sdkwork-routes-commerce-app-api/src/mapper/request.rs', import.meta.url),
      'utf8',
    ),
    3,
  ],
  [
    'chat-app-api',
    readFileSync(
      new URL('../crates/sdkwork-routes-chat-app-api/src/handlers.rs', import.meta.url),
      'utf8',
    ),
    readFileSync(
      new URL('../crates/sdkwork-routes-chat-app-api/src/mapper/request.rs', import.meta.url),
      'utf8',
    ),
    2,
  ],
  [
    'skill-packages-app-api',
    readFileSync(
      new URL('../crates/sdkwork-routes-skill-packages-app-api/src/handlers.rs', import.meta.url),
      'utf8',
    ),
    readFileSync(
      new URL(
        '../crates/sdkwork-routes-skill-packages-app-api/src/mapper/request.rs',
        import.meta.url,
      ),
      'utf8',
    ),
    2,
  ],
  [
    'document-app-api',
    readFileSync(
      new URL('../crates/sdkwork-routes-document-app-api/src/handlers.rs', import.meta.url),
      'utf8',
    ),
    readFileSync(
      new URL('../crates/sdkwork-routes-document-app-api/src/mapper/request.rs', import.meta.url),
      'utf8',
    ),
    1,
  ],
  [
    'engine-catalog-app-api',
    readFileSync(
      new URL('../crates/sdkwork-routes-engine-catalog-app-api/src/handlers.rs', import.meta.url),
      'utf8',
    ),
    readFileSync(
      new URL(
        '../crates/sdkwork-routes-engine-catalog-app-api/src/mapper/request.rs',
        import.meta.url,
      ),
      'utf8',
    ),
    1,
  ],
] as const;

for (const [crate, routeHandlersSource, requestMapperSource, expectedListHandlers] of
  strictOffsetRouteContracts) {
  const strictExtractorCount =
    routeHandlersSource.match(
      /StrictOffsetListQuery\(pagination\): StrictOffsetListQuery/g,
    )?.length ?? 0;
  assert.equal(
    strictExtractorCount,
    expectedListHandlers,
    `${crate} must reject invalid pagination through StrictOffsetListQuery before repository access.`,
  );
  assert.doesNotMatch(
    routeHandlersSource,
    /\.normalized_pagination\(\)/,
    `${crate} handlers must not silently clamp HTTP pagination.`,
  );
  assert.doesNotMatch(
    requestMapperSource,
    /normalize_page_list_query|normalized_pagination/,
    `${crate} request mappers must receive validated pagination from the shared HTTP extractor.`,
  );
  assert.doesNotMatch(
    routeHandlersSource,
    /usize::try_from\(total\)\.unwrap_or\(0\)/,
    `${crate} list handlers must not turn an invalid repository total into a successful zero-total page.`,
  );
}

assert.doesNotMatch(
  projectPaginationSource,
  /pub fn normalize_page_list_query/,
  'Project service must not expose an HTTP page normalizer that silently clamps invalid input.',
);
assert.doesNotMatch(
  workspaceHandlersSource,
  /paginate_vec\(/,
  'Workspace list handlers must not use the removed in-memory paginate_vec helper (PAGINATION_SPEC.md §2 forbids in-memory skip/take).',
);
assert.match(
  sdkClientsSource,
  /DEFAULT_SDK_PAGE_SIZE = 20/,
  'SDK list clients must apply the server-aligned default page size.',
);
assert.match(
  sdkClientsSource,
  /withDefaultPageSize\(request\)/,
  'Paginated SDK list queries must apply the default page_size helper.',
);
assert.match(
  sdkClientsSource,
  /withDefaultPageSize\(options\)/,
  'Workspace and project SDK list queries must apply the default page_size helper.',
);

const openApiSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/openApiOperationDefinitions.ts',
    import.meta.url,
  ),
  'utf8',
);
assert.match(
  openApiSource,
  /'workspaces\.list':[\s\S]*pageParameter[\s\S]*pageSizeParameter/,
  'OpenAPI workspaces.list must document page and page_size query parameters.',
);
assert.match(
  sdkClientsSource,
  /toGeneratedPageQuery\(options\)/,
  'Deployment and collaborator SDK list queries must apply the default page_size helper.',
);
assert.match(
  openApiSource,
  /'deployments\.list':[\s\S]*pageParameter[\s\S]*pageSizeParameter/,
  'OpenAPI deployments.list must document page and page_size query parameters.',
);
assert.match(
  openApiSource,
  /'projects\.list':[\s\S]*pageParameter[\s\S]*pageSizeParameter/,
  'OpenAPI projects.list must document page and page_size query parameters.',
);
assert.match(
  openApiSource,
  /'documents\.list':[\s\S]*projectIdParameter[\s\S]*pageParameter[\s\S]*pageSizeParameter/,
  'OpenAPI documents.list must document projectId, page, and page_size query parameters.',
);
assert.doesNotMatch(
  openApiSource,
  /const limitParameter|const offsetParameter/,
  'OpenAPI source must not keep pre-launch limit/offset HTTP query parameter aliases.',
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
  new URL('../crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/auth.rs', import.meta.url),
  'utf8',
);

assert.match(
  nativeSessionHandlersSource,
  /workspaceId, projectId, and runtimeLocationId are required to list native sessions; the server must also resolve an authorized runtime location/u,
  'Native session list API must require the complete server-authorized execution scope.',
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
    SHARED_PROBLEM_PAYLOAD_PATTERN,
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
