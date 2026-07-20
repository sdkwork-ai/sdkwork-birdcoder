import {
  SDKWORK_IAM_HEADERS,
} from '@sdkwork/iam-contracts';
import type { BirdCoderApiRouteDefinition } from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  BirdCoderCodingServerOpenApiDocument,
  BirdCoderOpenApiOperationDefinition,
  BirdCoderOpenApiResponseObject,
} from './openApiDocumentTypes.ts';
import type { BirdServerDistributionId } from './serverConstants.ts';
import {
  BIRDCODER_CODING_SERVER_API_VERSION,
  BIRDCODER_CODING_SERVER_DOCS_PATH,
  BIRDCODER_CODING_SERVER_LIVE_OPENAPI_PATH,
  BIRDCODER_CODING_SERVER_OPENAPI_PATH,
  BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH,
} from './serverConstants.ts';
import { createProblemResponse } from './openApiBuilders.ts';
import { buildBirdCoderCodingServerOpenApiSchemas } from './openApiSchemas.ts';
import { buildBirdCoderOpenApiOperationDefinitions } from './openApiOperationDefinitions.ts';
import {
  buildOpenApiOperationAuthMode,
  buildOpenApiOperationDescription,
  buildOpenApiOperationSecurity,
  buildOpenApiGovernanceMetadata,
  getOpenApiTagDescription,
  getOpenApiTagForOperationId,
  getOperationIdForRoute,
  isCredentialEntryOpenApiOperation,
  toOpenApiPathTemplate,
} from './serverRuntime.ts';
import {
  buildBirdCoderApiGatewaySummary,
  listBirdCoderCodingServerRoutes,
} from './routeCatalog.ts';

export function buildOpenApiDefaultResponses(): Record<string, BirdCoderOpenApiResponseObject> {
  return {
    '200': {
      description: 'Successful response',
    },
    default: {
      ...createProblemResponse('Problem response envelope.'),
    },
  };
}

export function buildBirdCoderCodingServerOpenApiDocument(
  distributionId: BirdServerDistributionId = 'global',
): BirdCoderCodingServerOpenApiDocument {
  void distributionId;
  const routes = listBirdCoderCodingServerRoutes();
  const gateway = buildBirdCoderApiGatewaySummary();
  const operationDefinitions = buildBirdCoderOpenApiOperationDefinitions();
  const schemas = buildBirdCoderCodingServerOpenApiSchemas();

  const paths: BirdCoderCodingServerOpenApiDocument['paths'] = {};
  for (const route of routes) {
    const method = route.method.toLowerCase() as Lowercase<BirdCoderApiRouteDefinition['method']>;
    const openApiPath = toOpenApiPathTemplate(route.path);
    const operationId = getOperationIdForRoute(route);
    const security = buildOpenApiOperationSecurity(route, operationId);
    const governanceMetadata = buildOpenApiGovernanceMetadata(route, operationId);
    const operationDefinition = operationDefinitions[operationId];
    if (operationDefinition?.streamKind) {
      continue;
    }
    paths[openApiPath] = {
      ...(paths[openApiPath] ?? {}),
      [method]: {
        operationId,
        summary: route.summary,
        description: buildOpenApiOperationDescription(route, operationId),
        tags: [getOpenApiTagForOperationId(operationId)],
        ...(operationDefinition?.parameters ? { parameters: operationDefinition.parameters } : {}),
        ...(operationDefinition?.requestBody
          ? { requestBody: operationDefinition.requestBody }
          : {}),
        responses: operationDefinition?.responses ?? buildOpenApiDefaultResponses(),
        security,
        'x-sdkwork-auth-mode': buildOpenApiOperationAuthMode(route, operationId),
        ...(operationDefinition?.auditEvent
          ? { 'x-sdkwork-audit-event': operationDefinition.auditEvent }
          : {}),
        'x-sdkwork-data-scope': governanceMetadata.dataScope,
        'x-sdkwork-deployment': governanceMetadata.deployment,
        'x-sdkwork-domain': governanceMetadata.domain,
        ...(isCredentialEntryOpenApiOperation(operationId)
          ? { 'x-sdkwork-forbid-credential-headers': true }
          : {}),
        ...(operationDefinition?.idempotent ? { 'x-sdkwork-idempotent': true } : {}),
        ...(governanceMetadata.permission
          ? { 'x-sdkwork-permission': governanceMetadata.permission }
          : {}),
        'x-sdkwork-public': governanceMetadata.isPublic,
        'x-sdkwork-resource': governanceMetadata.resource,
        'x-sdkwork-surface': route.surface,
        ...(operationDefinition?.streamKind
          ? { 'x-sdkwork-stream-kind': operationDefinition.streamKind }
          : {}),
        'x-sdkwork-tenant-scope': governanceMetadata.tenantScope,
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'SDKWork BirdCoder Coding Server API',
      version: BIRDCODER_CODING_SERVER_API_VERSION,
      description:
        'OpenAPI 3.1 schema generated from the live BirdCoder unified same-port API gateway.',
    },
    servers: [
      {
        url: '/',
        description: 'Unified same-port BirdCoder API gateway.',
      },
    ],
    tags: Array.from(
      new Set(
        Object.values(paths).flatMap((methodMap) =>
          Object.values(methodMap ?? {}).flatMap((operation) => operation?.tags ?? []),
        ),
      ),
    )
      .sort((left, right) => left.localeCompare(right))
      .map((tag) => ({ name: tag, description: getOpenApiTagDescription(tag) })),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Bearer token',
        },
        sdkworkAccessToken: {
          type: 'apiKey',
          in: 'header',
          name: SDKWORK_IAM_HEADERS.accessToken,
        },
      },
      schemas,
    },
    paths,
    'x-sdkwork-api-assembly': {
      versionedOpenApiPaths: [BIRDCODER_CODING_SERVER_OPENAPI_PATH],
      docsPath: BIRDCODER_CODING_SERVER_DOCS_PATH,
      liveOpenApiPath: BIRDCODER_CODING_SERVER_LIVE_OPENAPI_PATH,
      routeCatalogPath: BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH,
      routeCount: gateway.routeCount,
      routesBySurface: gateway.routesBySurface,
      surfaces: [...gateway.surfaces],
    },
  };
}
