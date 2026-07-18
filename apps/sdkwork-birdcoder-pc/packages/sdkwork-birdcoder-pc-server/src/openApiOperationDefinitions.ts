// Cohesion note (per TYPESCRIPT_CODE_SPEC.md §2):
// This file defines all OpenAPI operations for BirdCoder API routes.
// Operations are interdependent (reference shared schemas, types) and reviewed together.
// Splitting would fragment route knowledge and harm API surface visibility.
// All parts change together when the API contract evolves.

import type { BirdCoderOpenApiOperationDefinition } from './openApiDocumentTypes.ts';
import {
  buildOpenApiResponses,
  createOpenApiIdempotencyKeyParameter,
  createOpenApiIfMatchParameter,
  createOpenApiIntegerSchema,
  createOpenApiPathParameter,
  createOpenApiQueryParameter,
  createOpenApiRequestBody,
  createOpenApiResponse,
  createOpenApiSchemaReference,
  createOpenApiStringEnumSchema,
  createOpenApiStringSchema,
  createProblemResponse,
} from './openApiBuilders.ts';
import { listBirdCoderCodingServerEngines } from './domainQueries.ts';

export function buildBirdCoderOpenApiOperationDefinitions(): Record<
  string,
  BirdCoderOpenApiOperationDefinition
> {
  const engineQuerySchema = createOpenApiStringEnumSchema(
    listBirdCoderCodingServerEngines().map((descriptor) => descriptor.engineKey),
  );
  const workspaceIdParameter = createOpenApiQueryParameter(
    'workspaceId',
    'Filter resources to a single workspace.',
    createOpenApiStringSchema(),
  );
  const projectIdParameter = createOpenApiQueryParameter(
    'projectId',
    'Filter resources to a single project.',
    createOpenApiStringSchema(),
  );
  const requiredWorkspaceIdParameter = createOpenApiQueryParameter(
    'workspaceId',
    'Authorized workspace scope for native sessions.',
    createOpenApiStringSchema(),
    true,
  );
  const requiredProjectIdParameter = createOpenApiQueryParameter(
    'projectId',
    'Authorized project scope for native sessions.',
    createOpenApiStringSchema(),
    true,
  );
  const runtimeLocationIdParameter = createOpenApiQueryParameter(
    'runtimeLocationId',
    'Verified project runtime-location identifier required for native-session discovery and retrieval.',
    createOpenApiStringSchema(),
    true,
  );
  const optionalRuntimeLocationIdParameter = createOpenApiQueryParameter(
    'runtimeLocationId',
    'Optional verified project runtime-location identifier. When absent, only persisted coding-session projections are returned; native-session discovery is not attempted.',
    createOpenApiStringSchema(),
  );
  const engineIdParameter = createOpenApiQueryParameter(
    'engineId',
    'Filter resources to a single code engine.',
    engineQuerySchema,
  );
  const pageParameter = createOpenApiQueryParameter(
    'page',
    'One-based page number used for offset-mode pagination.',
    createOpenApiIntegerSchema(1),
  );
  const pageSizeParameter = createOpenApiQueryParameter(
    'page_size',
    'Maximum number of items to return. Defaults to 20 and must not exceed 200.',
    createOpenApiIntegerSchema(1, 200),
  );
  const codingSessionIdPathParameter = createOpenApiPathParameter(
    'sessionId',
    'BirdCoder coding session identifier.',
  );
  const conversationIdPathParameter = createOpenApiPathParameter(
    'conversationId',
    'BirdCoder chat conversation identifier.',
  );
  const messageIdPathParameter = createOpenApiPathParameter(
    'messageId',
    'BirdCoder coding session message identifier.',
  );
  const checkpointIdPathParameter = createOpenApiPathParameter(
    'checkpointId',
    'Approval checkpoint identifier.',
  );
  const engineKeyPathParameter = createOpenApiPathParameter(
    'engineKey',
    'BirdCoder engine key.',
  );
  const operationIdPathParameter = createOpenApiPathParameter(
    'operationId',
    'Operation identifier.',
  );
  const userIdParameter = createOpenApiQueryParameter(
    'userId',
    'Filter resources to a single user principal.',
    createOpenApiStringSchema(),
  );
  const workspaceIdPathParameter = createOpenApiPathParameter(
    'workspaceId',
    'BirdCoder workspace identifier.',
  );
  const realtimeTransportQueryParameter = createOpenApiQueryParameter(
    'transport',
    'Realtime delivery transport. Omit to negotiate from the websocket upgrade shape or default to SSE.',
    createOpenApiStringEnumSchema(['sse', 'websocket']),
  );
  const projectIdPathParameter = createOpenApiPathParameter(
    'projectId',
    'BirdCoder project identifier.',
  );
  const runtimeLocationIdPathParameter = createOpenApiPathParameter(
    'runtimeLocationId',
    'Project runtime-location identifier.',
  );
  const runtimeLocationIdQueryParameter = createOpenApiQueryParameter(
    'runtime_location_id',
    'Verified project runtime-location identifier used for Git execution.',
    createOpenApiStringSchema(),
    true,
  );
  const runtimeLocationCapabilityPathParameter = createOpenApiPathParameter(
    'capability',
    'Project runtime-location capability preference identifier.',
  );
  const teamIdPathParameter = createOpenApiPathParameter('teamId', 'BirdCoder team identifier.');
  const packageIdPathParameter = createOpenApiPathParameter(
    'packageId',
    'Skill package identifier.',
  );
  const qrSessionKeyPathParameter = createOpenApiPathParameter(
    'sessionKey',
    'SDKWork IAM QR auth session key.',
  );
  const deviceAuthorizationIdPathParameter = createOpenApiPathParameter(
    'deviceAuthorizationId',
    'SDKWork IAM OAuth device authorization identifier.',
  );
  const apiKeyIdPathParameter = createOpenApiPathParameter(
    'apiKeyId',
    'SDKWork IAM API key identifier.',
  );
  const organizationIdPathParameter = createOpenApiPathParameter(
    'organizationId',
    'SDKWork IAM organization identifier.',
  );
  const membershipIdPathParameter = createOpenApiPathParameter(
    'membershipId',
    'SDKWork IAM organization membership identifier.',
  );
  const commerceOrderIdPathParameter = createOpenApiPathParameter(
    'orderId',
    'SDKWork commerce order identifier.',
  );
  const commerceInvoiceIdPathParameter = createOpenApiPathParameter(
    'invoiceId',
    'SDKWork commerce invoice identifier.',
  );
  const commercePaymentIdPathParameter = createOpenApiPathParameter(
    'paymentId',
    'SDKWork commerce payment identifier.',
  );
  const roleBindingIdPathParameter = createOpenApiPathParameter(
    'roleBindingId',
    'SDKWork IAM role binding identifier.',
  );
  const permissionIdPathParameter = createOpenApiPathParameter(
    'permissionId',
    'SDKWork IAM permission identifier.',
  );
  const policyIdPathParameter = createOpenApiPathParameter(
    'policyId',
    'SDKWork IAM policy identifier.',
  );
  const roleIdPathParameter = createOpenApiPathParameter(
    'roleId',
    'SDKWork IAM role identifier.',
  );
  const tenantIdPathParameter = createOpenApiPathParameter(
    'tenantId',
    'SDKWork IAM tenant identifier.',
  );
  const iamUserIdPathParameter = createOpenApiPathParameter(
    'userId',
    'SDKWork IAM user identifier.',
  );
  return {
    'descriptor.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding server descriptor returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingServerDescriptorEnvelope'),
      }),
    },
    'routes.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Unified route catalog returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderApiRouteCatalogEntryListEnvelope'),
      }),
    },
    'engines.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Engine catalog returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderEngineDescriptorListEnvelope'),
      }),
    },
    'codingSessions.list': {
      parameters: [
        workspaceIdParameter,
        projectIdParameter,
        optionalRuntimeLocationIdParameter,
        engineIdParameter,
        pageParameter,
        pageSizeParameter,
      ],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Unified coding session inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingSessionSummaryListEnvelope'),
        extraResponses: {
          '503': createProblemResponse(
            'The selected coding-session runtime location is unavailable for native-session discovery.',
          ),
          '500': createProblemResponse('Unified coding session inventory could not be read.'),
        },
      }),
    },
    'codingSessions.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateCodingSessionRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Coding session created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingSessionSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Coding session creation request is invalid.'),
          '503': createProblemResponse('The selected coding-session runtime location is unavailable.'),
          '500': createProblemResponse('Coding session could not be created.'),
        },
      }),
    },
    'codingSessions.retrieve': {
      parameters: [codingSessionIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding session summary returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingSessionSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Coding session was not found.'),
          '500': createProblemResponse('Coding session summary could not be read.'),
        },
      }),
    },
    'codingSessions.update': {
      parameters: [codingSessionIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateCodingSessionRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding session updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingSessionSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Coding session update request is invalid.'),
          '404': createProblemResponse('Coding session was not found.'),
          '500': createProblemResponse('Coding session could not be updated.'),
        },
      }),
    },
    'codingSessions.delete': {
      parameters: [codingSessionIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '204',
        successDescription: 'Coding session deleted successfully.',
        extraResponses: {
          '404': createProblemResponse('Coding session was not found.'),
          '500': createProblemResponse('Coding session could not be deleted.'),
        },
      }),
    },
    'codingSessions.forks.create': {
      parameters: [codingSessionIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderForkCodingSessionRequest'),
        false,
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Coding session forked successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingSessionSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Coding session fork request is invalid.'),
          '404': createProblemResponse('Coding session was not found.'),
          '500': createProblemResponse('Coding session could not be forked.'),
        },
      }),
    },
    'codingSessions.turns.create': {
      parameters: [codingSessionIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateCodingSessionTurnRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Coding session turn created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingSessionTurnEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Coding session turn request is invalid.'),
          '404': createProblemResponse('Coding session was not found.'),
          '500': createProblemResponse('Coding session turn could not be created.'),
        },
      }),
    },
    'codingSessions.messages.update': {
      parameters: [codingSessionIdPathParameter, messageIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderEditCodingSessionMessageRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding session message edited successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderEditCodingSessionMessageResultEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Coding session message edit request is invalid.'),
          '404': createProblemResponse('Coding session message was not found.'),
          '500': createProblemResponse('Coding session message could not be edited.'),
        },
      }),
    },
    'codingSessions.messages.delete': {
      parameters: [codingSessionIdPathParameter, messageIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '204',
        successDescription: 'Coding session message deleted successfully.',
        extraResponses: {
          '404': createProblemResponse('Coding session message was not found.'),
          '500': createProblemResponse('Coding session message could not be deleted.'),
        },
      }),
    },
    'codingSessions.events.list': {
      parameters: [codingSessionIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding session event stream returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingSessionEventListEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Coding session was not found.'),
          '500': createProblemResponse('Coding session events could not be read.'),
        },
      }),
    },
    'nativeSessions.list': {
      parameters: [
        requiredWorkspaceIdParameter,
        requiredProjectIdParameter,
        runtimeLocationIdParameter,
        engineIdParameter,
        pageParameter,
        pageSizeParameter,
      ],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Native engine session inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderNativeSessionSummaryListEnvelope'),
        extraResponses: {
          '503': createProblemResponse('The selected runtime location is unavailable.'),
          '500': createProblemResponse('Native engine session inventory could not be read.'),
        },
      }),
    },
    'nativeSessionProviders.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Native engine session provider catalog returned successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderNativeSessionProviderSummaryListEnvelope',
        ),
        extraResponses: {
          '500': createProblemResponse(
            'Native engine session provider catalog could not be read.',
          ),
        },
      }),
    },
    'nativeSessions.retrieve': {
      parameters: [
        codingSessionIdPathParameter,
        requiredWorkspaceIdParameter,
        requiredProjectIdParameter,
        runtimeLocationIdParameter,
        engineIdParameter,
      ],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Native engine session detail returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderNativeSessionDetailEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Native engine session was not found.'),
          '503': createProblemResponse('The selected runtime location is unavailable.'),
          '500': createProblemResponse('Native engine session detail could not be read.'),
        },
      }),
    },
    'engines.capabilities.retrieve': {
      parameters: [engineKeyPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Engine capability matrix returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderEngineCapabilityMatrixEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Engine capability matrix was not found.'),
        },
      }),
    },
    'models.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Model catalog returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderModelCatalogEntryListEnvelope'),
      }),
    },
    'modelConfig.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Code engine model configuration returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodeEngineModelConfigEnvelope'),
      }),
    },
    'modelConfig.update': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderSyncCodeEngineModelConfigRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Code engine model configuration updated successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderCodeEngineModelConfigSyncResultEnvelope',
        ),
      }),
    },
    'runtime.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Runtime metadata returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCoreRuntimeSummaryEnvelope'),
      }),
    },
    'health.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Runtime health returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCoreHealthSummaryEnvelope'),
      }),
    },
    'operations.retrieve': {
      parameters: [operationIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Operation descriptor returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderOperationDescriptorEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Operation was not found.'),
        },
      }),
    },
    'codingSessions.checkpoints.approval.create': {
      parameters: [codingSessionIdPathParameter, checkpointIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderSubmitApprovalDecisionRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Approval decision applied successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderApprovalDecisionResultEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Approval decision request is invalid.'),
          '404': createProblemResponse('Approval checkpoint was not found.'),
        },
      }),
    },
    'codingSessions.questions.answers.create': {
      parameters: [
        codingSessionIdPathParameter,
        createOpenApiPathParameter(
          'questionId',
          'User-question request identifier.',
        ),
      ],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderSubmitUserQuestionAnswerRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'User-question answer applied successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderUserQuestionAnswerResultEnvelope'),
        extraResponses: {
          '400': createProblemResponse('User-question answer request is invalid.'),
          '404': createProblemResponse('User-question checkpoint was not found.'),
        },
      }),
    },
    'codingSessions.artifacts.list': {
      parameters: [codingSessionIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding session artifacts returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingSessionArtifactListEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Coding session was not found.'),
        },
      }),
    },
    'codingSessions.checkpoints.list': {
      parameters: [codingSessionIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Coding session checkpoints returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCodingSessionCheckpointListEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Coding session was not found.'),
        },
      }),
    },
    'iam.runtime.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM runtime settings returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamRuntimeSettingsEnvelope'),
      }),
    },
    'iam.verificationPolicy.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM verification policy returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamVerificationPolicyEnvelope'),
      }),
    },
    'sessions.current.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Current SDKWork IAM session returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamSessionEnvelope'),
      }),
    },
    'sessions.current.update': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamUpdateCurrentSessionRequest'),
        false,
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Current SDKWork IAM session updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamSessionEnvelope'),
      }),
    },
    'oauth.authorizationUrls.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamOAuthAuthorizationCreateRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'OAuth authorization URL resolved successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamOAuthAuthorizationEnvelope'),
        extraResponses: {
          '400': createProblemResponse('OAuth authorization request is invalid.'),
        },
      }),
    },
    'oauth.sessions.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamOAuthSessionCreateRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'SDKWork IAM session created successfully with OAuth authorization.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamSessionEnvelope'),
        extraResponses: {
          '400': createProblemResponse('OAuth login request is invalid.'),
          '401': createProblemResponse('OAuth authorization code was rejected.'),
        },
      }),
    },
    'oauth.deviceAuthorizations.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamDeviceAuthorizationCreateRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'SDKWork IAM OAuth device authorization created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamDeviceAuthorizationEnvelope'),
        extraResponses: {
          '400': createProblemResponse('OAuth device authorization request is invalid.'),
        },
      }),
    },
    'oauth.deviceAuthorizations.retrieve': {
      parameters: [deviceAuthorizationIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM OAuth device authorization returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamDeviceAuthorizationEnvelope'),
        extraResponses: {
          '404': createProblemResponse('OAuth device authorization was not found.'),
        },
      }),
    },
    'oauth.deviceAuthorizations.scans.create': {
      parameters: [deviceAuthorizationIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamDeviceAuthorizationScanRequest'),
        false,
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'SDKWork IAM OAuth device authorization scan accepted successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderBooleanSuccessEnvelope'),
        extraResponses: {
          '404': createProblemResponse('OAuth device authorization was not found.'),
        },
      }),
    },
    'oauth.deviceAuthorizations.passwordCompletions.create': {
      parameters: [deviceAuthorizationIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamDeviceAuthorizationPasswordCompletionRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription:
          'SDKWork IAM OAuth device authorization completed with password successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamSessionEnvelope'),
        extraResponses: {
          '400': createProblemResponse('OAuth device authorization password completion is invalid.'),
          '404': createProblemResponse('OAuth device authorization was not found.'),
        },
      }),
    },
    'oauth.deviceAuthorizations.sessionExchanges.create': {
      parameters: [deviceAuthorizationIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamDeviceAuthorizationSessionExchangeRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription:
          'SDKWork IAM OAuth device authorization session exchanged successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamSessionEnvelope'),
        extraResponses: {
          '400': createProblemResponse('OAuth device authorization session exchange is invalid.'),
          '401': createProblemResponse('OAuth device authorization poll secret was rejected.'),
          '404': createProblemResponse('OAuth device authorization was not found.'),
          '409': createProblemResponse('OAuth device authorization session is not ready for exchange.'),
        },
      }),
    },
    'sessions.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamCreateSessionRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'SDKWork IAM session created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamSessionEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM login request is invalid.'),
          '401': createProblemResponse('SDKWork IAM credentials were rejected.'),
        },
      }),
    },
    'registrations.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamRegistrationCreateRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'SDKWork IAM user registered successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamSessionEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM registration request is invalid.'),
        },
      }),
    },
    'passwordResetRequests.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamPasswordResetRequestCreateRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Password reset challenge accepted successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderBooleanSuccessEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Password reset challenge request is invalid.'),
        },
      }),
    },
    'passwordResets.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamPasswordResetCreateRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Password reset completed successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderBooleanSuccessEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Password reset request is invalid.'),
          '401': createProblemResponse('Password reset verification failed.'),
        },
      }),
    },
    'sessions.current.delete': {
      responses: buildOpenApiResponses({
        successStatus: '204',
        successDescription: 'SDKWork IAM session revoked successfully.',
      }),
    },
    'sessions.refresh': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderIamRefreshSessionRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM session refreshed successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamSessionEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM session refresh request is invalid.'),
          '401': createProblemResponse('SDKWork IAM refresh token was rejected.'),
        },
      }),
    },
    'users.current.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Current user profile returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamUserProfileEnvelope'),
      }),
    },
    'users.current.update': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateCurrentUserProfileRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Current user profile updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamUserProfileEnvelope'),
      }),
    },
    'commerce.orders.list': {
      parameters: [pageParameter, pageSizeParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork commerce orders returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCommerceOrderSummaryListEnvelope'),
      }),
    },
    'commerce.orders.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateCommerceOrderRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'SDKWork commerce order created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCommerceOrderSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork commerce order request is invalid.'),
        },
      }),
    },
    'commerce.orders.retrieve': {
      parameters: [commerceOrderIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork commerce order returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCommerceOrderSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork commerce order was not found.'),
        },
      }),
    },
    'commerce.invoices.list': {
      parameters: [pageParameter, pageSizeParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork commerce invoices returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCommerceInvoiceSummaryListEnvelope'),
      }),
    },
    'commerce.invoices.retrieve': {
      parameters: [commerceInvoiceIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork commerce invoice returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCommerceInvoiceSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork commerce invoice was not found.'),
        },
      }),
    },
    'commerce.payments.list': {
      parameters: [pageParameter, pageSizeParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork commerce payments returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCommercePaymentSummaryListEnvelope'),
      }),
    },
    'commerce.payments.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateCommercePaymentRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'SDKWork commerce payment created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCommercePaymentSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork commerce payment request is invalid.'),
          '404': createProblemResponse('SDKWork commerce order was not found.'),
        },
      }),
    },
    'commerce.payments.retrieve': {
      parameters: [commercePaymentIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork commerce payment returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCommercePaymentSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork commerce payment was not found.'),
        },
      }),
    },
    'commerce.payments.confirm': {
      parameters: [commercePaymentIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderConfirmCommercePaymentRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork commerce payment confirmed successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderCommercePaymentSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork commerce payment confirmation is invalid.'),
          '404': createProblemResponse('SDKWork commerce payment was not found.'),
          '409': createProblemResponse('SDKWork commerce payment cannot be confirmed.'),
        },
      }),
    },
    'workspaces.list': {
      parameters: [userIdParameter, pageParameter, pageSizeParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Workspace inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderWorkspaceSummaryListEnvelope'),
      }),
    },
    'workspaces.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateWorkspaceRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Workspace created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderWorkspaceSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Workspace creation request is invalid.'),
        },
      }),
    },
    'workspaces.retrieve': {
      parameters: [workspaceIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Workspace returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderWorkspaceSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Workspace was not found.'),
        },
      }),
    },
    'workspaces.update': {
      parameters: [workspaceIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateWorkspaceRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Workspace updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderWorkspaceSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Workspace update request is invalid.'),
          '404': createProblemResponse('Workspace was not found.'),
        },
      }),
    },
    'workspaces.delete': {
      parameters: [workspaceIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '204',
        successDescription: 'Workspace removed successfully.',
        extraResponses: {
          '404': createProblemResponse('Workspace was not found.'),
        },
      }),
    },
    'workspaces.realtime.subscribe': {
      parameters: [
        workspaceIdPathParameter,
        realtimeTransportQueryParameter,
      ],
      streamKind: 'websocket',
      responses: {
        '200': {
          description: 'SSE workspace realtime stream opened successfully.',
          content: {
            'text/event-stream': {
              schema: createOpenApiStringSchema(
                'Server-Sent Events carrying ready and event records as JSON data payloads.',
              ),
            },
          },
        },
        '101': createOpenApiResponse(
          'WebSocket upgrade accepted for workspace realtime delivery.',
        ),
        '400': createProblemResponse('Workspace realtime subscription request is invalid.'),
        '401': createProblemResponse('A valid SDKWork IAM session is required.'),
        '404': createProblemResponse('Workspace was not found.'),
        default: createProblemResponse('Problem response envelope.'),
      },
    },
    'projects.list': {
      parameters: [
        userIdParameter,
        workspaceIdParameter,
        pageParameter,
        pageSizeParameter,
      ],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectSummaryListEnvelope'),
      }),
    },
    'projects.retrieve': {
      parameters: [projectIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'projects.workspaceBinding.retrieve': {
      parameters: [projectIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project workspace binding returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectWorkspaceBindingEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Project workspace binding was not found.'),
        },
      }),
    },
    'projects.workspaceBinding.update': {
      auditEvent: 'project.workspace_binding.upsert',
      idempotent: true,
      parameters: [
        projectIdPathParameter,
        createOpenApiIfMatchParameter(false),
        createOpenApiIdempotencyKeyParameter(),
      ],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpsertProjectWorkspaceBindingRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project workspace binding updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectWorkspaceBindingEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project workspace binding input is invalid.'),
          '404': createProblemResponse('Project was not found.'),
          '409': createProblemResponse('Project workspace binding idempotency conflicts with another request.'),
          '412': createProblemResponse('Project workspace-binding version precondition failed.'),
          '428': createProblemResponse('An existing project workspace binding requires If-Match.'),
        },
      }),
    },
    'projects.workspaceBinding.delete': {
      auditEvent: 'project.workspace_binding.delete',
      parameters: [projectIdPathParameter, createOpenApiIfMatchParameter()],
      responses: buildOpenApiResponses({
        successStatus: '204',
        successDescription: 'Project workspace binding removed successfully.',
        extraResponses: {
          '404': createProblemResponse('Project workspace binding was not found.'),
          '412': createProblemResponse('Project workspace-binding version precondition failed.'),
          '428': createProblemResponse('Project workspace-binding deletion requires If-Match.'),
        },
      }),
    },
    'projects.runtimeLocations.list': {
      parameters: [projectIdPathParameter, pageParameter, pageSizeParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project runtime locations returned successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderProjectRuntimeLocationListEnvelope',
        ),
        extraResponses: {
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'projects.runtimeLocations.create': {
      idempotent: true,
      parameters: [projectIdPathParameter, createOpenApiIdempotencyKeyParameter()],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateProjectRuntimeLocationRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Project runtime location registered successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectRuntimeLocationEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project runtime-location registration is invalid.'),
          '404': createProblemResponse('Project was not found.'),
          '409': createProblemResponse('Project runtime-location registration conflicts with existing state.'),
          '428': createProblemResponse('Project runtime-location registration requires Idempotency-Key.'),
        },
      }),
    },
    'projects.runtimeLocations.retrieve': {
      parameters: [projectIdPathParameter, runtimeLocationIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project runtime location returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectRuntimeLocationEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Project runtime location was not found.'),
        },
      }),
    },
    'projects.runtimeLocations.update': {
      idempotent: true,
      parameters: [
        projectIdPathParameter,
        runtimeLocationIdPathParameter,
        createOpenApiIfMatchParameter(),
        createOpenApiIdempotencyKeyParameter(),
      ],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateProjectRuntimeLocationRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project runtime location updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectRuntimeLocationEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project runtime-location update is invalid.'),
          '404': createProblemResponse('Project runtime location was not found.'),
          '412': createProblemResponse('Project runtime-location version precondition failed.'),
          '428': createProblemResponse('Project runtime-location update requires If-Match and Idempotency-Key.'),
        },
      }),
    },
    'projects.runtimeLocations.delete': {
      parameters: [
        projectIdPathParameter,
        runtimeLocationIdPathParameter,
        createOpenApiIfMatchParameter(),
      ],
      responses: buildOpenApiResponses({
        successStatus: '204',
        successDescription: 'Project runtime location removed successfully.',
        extraResponses: {
          '404': createProblemResponse('Project runtime location was not found.'),
          '412': createProblemResponse('Project runtime-location version precondition failed.'),
          '428': createProblemResponse('Project runtime-location deletion requires If-Match.'),
        },
      }),
    },
    'projects.runtimeLocations.rebind': {
      idempotent: true,
      parameters: [
        projectIdPathParameter,
        runtimeLocationIdPathParameter,
        createOpenApiIfMatchParameter(),
        createOpenApiIdempotencyKeyParameter(),
      ],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderRebindProjectRuntimeLocationRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription:
          'Project runtime location rebound and returned to pending verification successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderProjectRuntimeLocationCommandEnvelope',
        ),
        extraResponses: {
          '400': createProblemResponse('Project runtime-location rebind is invalid.'),
          '404': createProblemResponse('Project runtime location was not found.'),
          '409': createProblemResponse('Project runtime-location rebind conflicts with existing state.'),
          '412': createProblemResponse('Project runtime-location version precondition failed.'),
          '428': createProblemResponse('Project runtime-location rebind requires If-Match and Idempotency-Key.'),
        },
      }),
    },
    'projects.runtimeLocations.requestVerification': {
      idempotent: true,
      parameters: [
        projectIdPathParameter,
        runtimeLocationIdPathParameter,
        createOpenApiIfMatchParameter(),
        createOpenApiIdempotencyKeyParameter(),
      ],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project runtime-location verification was requested successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderProjectRuntimeLocationCommandEnvelope',
        ),
        extraResponses: {
          '404': createProblemResponse('Project runtime location was not found.'),
          '409': createProblemResponse('Project runtime-location verification conflicts with existing state.'),
          '412': createProblemResponse('Project runtime-location version precondition failed.'),
          '428': createProblemResponse('Project runtime-location verification requires If-Match and Idempotency-Key.'),
          '503': createProblemResponse('Project runtime-location verification target is unavailable.'),
        },
      }),
    },
    'projects.runtimeLocations.preferences.list': {
      parameters: [projectIdPathParameter, pageParameter, pageSizeParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project runtime-location preferences returned successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderProjectRuntimeLocationPreferenceListEnvelope',
        ),
        extraResponses: {
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'projects.runtimeLocations.preferences.update': {
      idempotent: true,
      parameters: [
        projectIdPathParameter,
        runtimeLocationCapabilityPathParameter,
        createOpenApiIfMatchParameter(false),
        createOpenApiIdempotencyKeyParameter(),
      ],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderSetProjectRuntimeLocationPreferenceRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project runtime-location preference updated successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderProjectRuntimeLocationPreferenceEnvelope',
        ),
        extraResponses: {
          '400': createProblemResponse('Project runtime-location preference is invalid.'),
          '404': createProblemResponse('Project or runtime location was not found.'),
          '409': createProblemResponse('Project runtime-location preference conflicts with existing state.'),
          '412': createProblemResponse('Project runtime-location preference version precondition failed.'),
          '428': createProblemResponse('Project runtime-location preference update requires Idempotency-Key.'),
        },
      }),
    },
    'projects.git.overview.retrieve': {
      parameters: [projectIdPathParameter, runtimeLocationIdQueryParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project Git overview returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectGitOverviewEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Project was not found.'),
          '503': createProblemResponse('Project Git runtime location is unavailable.'),
        },
      }),
    },
    'projects.git.diff.retrieve': {
      parameters: [projectIdPathParameter, runtimeLocationIdQueryParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project Git diff returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectGitDiffEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Project was not found.'),
          '503': createProblemResponse('Project Git runtime location is unavailable.'),
        },
      }),
    },
    'projects.git.branches.create': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateProjectGitBranchRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Project Git branch created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectGitOverviewEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project Git branch creation request is invalid.'),
          '404': createProblemResponse('Project was not found.'),
          '503': createProblemResponse('Project Git runtime location is unavailable.'),
        },
      }),
    },
    'projects.git.branchSwitch.create': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderSwitchProjectGitBranchRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Project Git branch switched successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectGitOverviewEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project Git branch switch request is invalid.'),
          '404': createProblemResponse('Project was not found.'),
          '503': createProblemResponse('Project Git runtime location is unavailable.'),
        },
      }),
    },
    'projects.git.commits.create': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCommitProjectGitChangesRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Project Git changes committed successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectGitOverviewEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project Git commit request is invalid.'),
          '404': createProblemResponse('Project was not found.'),
          '503': createProblemResponse('Project Git runtime location is unavailable.'),
        },
      }),
    },
    'projects.git.pushes.create': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderPushProjectGitBranchRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Project Git branch pushed successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectGitOverviewEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project Git push request is invalid.'),
          '404': createProblemResponse('Project was not found.'),
          '503': createProblemResponse('Project Git runtime location is unavailable.'),
        },
      }),
    },
    'projects.git.worktrees.create': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateProjectGitWorktreeRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Project Git worktree created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectGitOverviewEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project Git worktree creation request is invalid.'),
          '404': createProblemResponse('Project was not found.'),
          '503': createProblemResponse('Project Git runtime location is unavailable.'),
        },
      }),
    },
    'projects.git.worktreeRemovals.create': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderRemoveProjectGitWorktreeRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Project Git worktree removed successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectGitOverviewEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project Git worktree removal request is invalid.'),
          '404': createProblemResponse('Project was not found.'),
          '503': createProblemResponse('Project Git runtime location is unavailable.'),
        },
      }),
    },
    'projects.git.worktreePrune.create': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderPruneProjectGitWorktreesRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Project Git worktrees pruned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectGitOverviewEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project Git worktree prune request is invalid.'),
          '404': createProblemResponse('Project was not found.'),
          '503': createProblemResponse('Project Git runtime location is unavailable.'),
        },
      }),
    },
    'projects.collaborators.list': {
      parameters: [projectIdPathParameter, pageParameter, pageSizeParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project collaborators returned successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderProjectCollaboratorSummaryListEnvelope',
        ),
        extraResponses: {
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'projects.collaborators.create': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpsertProjectCollaboratorRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Project collaborator created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectCollaboratorSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project collaborator request is invalid.'),
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'projects.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateProjectRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Project created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project creation request is invalid.'),
          '404': createProblemResponse('Workspace was not found.'),
        },
      }),
    },
    'projects.update': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateProjectRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Project update request is invalid.'),
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'projects.delete': {
      parameters: [projectIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '204',
        successDescription: 'Project removed successfully.',
        extraResponses: {
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'skillPackages.list': {
      parameters: [userIdParameter, workspaceIdParameter, pageParameter, pageSizeParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Skill package catalog returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderSkillPackageSummaryListEnvelope'),
      }),
    },
    'skillPackages.installations.create': {
      parameters: [packageIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderInstallSkillPackageRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Skill package installed successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderSkillInstallationSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Skill package installation request is invalid.'),
          '404': createProblemResponse('Skill package was not found.'),
        },
      }),
    },
    'appTemplates.list': {
      parameters: [pageParameter, pageSizeParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'App template catalog returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderAppTemplateSummaryListEnvelope'),
      }),
    },
    'documents.list': {
      parameters: [projectIdParameter, pageParameter, pageSizeParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project documents returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectDocumentSummaryListEnvelope'),
      }),
    },
    'chat.conversations.list': {
      parameters: [pageParameter, pageSizeParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Chat conversations returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderChatConversationSummaryListEnvelope'),
      }),
    },
    'chat.conversations.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateChatConversationRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Chat conversation created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderChatConversationSummaryEnvelope'),
      }),
    },
    'chat.conversations.retrieve': {
      parameters: [conversationIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Chat conversation returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderChatConversationSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Chat conversation was not found.'),
        },
      }),
    },
    'chat.conversations.delete': {
      parameters: [conversationIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '204',
        successDescription: 'Chat conversation deleted successfully.',
        extraResponses: {
          '404': createProblemResponse('Chat conversation was not found.'),
        },
      }),
    },
    'chat.conversations.messages.list': {
      parameters: [conversationIdPathParameter, pageParameter, pageSizeParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Chat messages returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderChatMessageSummaryListEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Chat conversation was not found.'),
        },
      }),
    },
    'chat.conversations.messages.create': {
      parameters: [conversationIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateChatMessageRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Chat message created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderChatMessageSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Chat conversation was not found.'),
        },
      }),
    },
    'workspaceTeams.list': {
      parameters: [userIdParameter, workspaceIdParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Workspace team inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderTeamSummaryListEnvelope'),
      }),
    },
    'workspaces.members.list': {
      parameters: [workspaceIdPathParameter, pageParameter, pageSizeParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Workspace members returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderWorkspaceMemberSummaryListEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Workspace was not found.'),
        },
      }),
    },
    'workspaces.members.create': {
      parameters: [workspaceIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpsertWorkspaceMemberRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'Workspace member created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderWorkspaceMemberSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('Workspace member request is invalid.'),
          '404': createProblemResponse('Workspace was not found.'),
        },
      }),
    },
    'projects.publish.publish': {
      parameters: [projectIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderPublishProjectRequest'),
        false,
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Project release flow started successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderProjectPublishResultEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'deployments.list': {
      parameters: [pageParameter, pageSizeParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Deployment inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeploymentRecordSummaryListEnvelope'),
      }),
    },
    'apiKeys.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM API keys returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamApiKeySummaryListEnvelope'),
      }),
    },
    'apiKeys.revoke': {
      parameters: [apiKeyIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM API key revoked successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderBooleanSuccessEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM API key was not found.'),
        },
      }),
    },
    'auditEvents.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM audit events returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamAuditEventSummaryListEnvelope'),
      }),
    },
    'organizations.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM organizations returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamOrganizationSummaryListEnvelope'),
      }),
    },
    'organizations.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamOrganizationRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'SDKWork IAM organization created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamOrganizationSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM organization request is invalid.'),
        },
      }),
    },
    'organizations.retrieve': {
      parameters: [organizationIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM organization returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamOrganizationSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM organization was not found.'),
        },
      }),
    },
    'organizations.update': {
      parameters: [organizationIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateIamOrganizationRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM organization updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamOrganizationSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM organization update request is invalid.'),
          '404': createProblemResponse('SDKWork IAM organization was not found.'),
        },
      }),
    },
    'organizations.delete': {
      parameters: [organizationIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '204',
        successDescription: 'SDKWork IAM organization deleted successfully.',
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM organization was not found.'),
        },
      }),
    },
    'organizations.tree.retrieve': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM organization tree returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamOrganizationSummaryListEnvelope'),
      }),
    },
    'organizationMemberships.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM organization memberships returned successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderIamOrganizationMemberSummaryListEnvelope',
        ),
      }),
    },
    'organizationMemberships.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamOrganizationMemberRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'SDKWork IAM organization membership created successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderIamOrganizationMemberSummaryEnvelope',
        ),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM organization membership request is invalid.'),
        },
      }),
    },
    'organizationMemberships.update': {
      parameters: [membershipIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateIamOrganizationMemberRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM organization membership updated successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderIamOrganizationMemberSummaryEnvelope',
        ),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM organization membership update request is invalid.'),
          '404': createProblemResponse('SDKWork IAM organization membership was not found.'),
        },
      }),
    },
    'permissions.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM permissions returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamPermissionSummaryListEnvelope'),
      }),
    },
    'permissions.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamPermissionRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'SDKWork IAM permission created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamPermissionSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM permission request is invalid.'),
        },
      }),
    },
    'permissions.retrieve': {
      parameters: [permissionIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM permission returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamPermissionSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM permission was not found.'),
        },
      }),
    },
    'permissions.update': {
      parameters: [permissionIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateIamPermissionRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM permission updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamPermissionSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM permission update request is invalid.'),
          '404': createProblemResponse('SDKWork IAM permission was not found.'),
        },
      }),
    },
    'permissions.delete': {
      parameters: [permissionIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '204',
        successDescription: 'SDKWork IAM permission deleted successfully.',
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM permission was not found.'),
        },
      }),
    },
    'policies.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM policies returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamPolicySummaryListEnvelope'),
      }),
    },
    'policies.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamPolicyRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'SDKWork IAM policy created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamPolicySummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM policy request is invalid.'),
        },
      }),
    },
    'policies.retrieve': {
      parameters: [policyIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM policy returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamPolicySummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM policy was not found.'),
        },
      }),
    },
    'policies.update': {
      parameters: [policyIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateIamPolicyRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM policy updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamPolicySummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM policy update request is invalid.'),
          '404': createProblemResponse('SDKWork IAM policy was not found.'),
        },
      }),
    },
    'policies.delete': {
      parameters: [policyIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '204',
        successDescription: 'SDKWork IAM policy deleted successfully.',
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM policy was not found.'),
        },
      }),
    },
    'roles.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM roles returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamRoleSummaryListEnvelope'),
      }),
    },
    'roles.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamRoleRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'SDKWork IAM role created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamRoleSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM role request is invalid.'),
        },
      }),
    },
    'roles.retrieve': {
      parameters: [roleIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM role returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamRoleSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM role was not found.'),
        },
      }),
    },
    'roles.update': {
      parameters: [roleIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateIamRoleRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM role updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamRoleSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM role update request is invalid.'),
          '404': createProblemResponse('SDKWork IAM role was not found.'),
        },
      }),
    },
    'roles.delete': {
      parameters: [roleIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '204',
        successDescription: 'SDKWork IAM role deleted successfully.',
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM role was not found.'),
        },
      }),
    },
    'roles.permissions.list': {
      parameters: [roleIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM role permissions returned successfully.',
        successSchema: createOpenApiSchemaReference(
          'BirdCoderIamRolePermissionSummaryListEnvelope',
        ),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM role was not found.'),
        },
      }),
    },
    'roles.permissions.create': {
      parameters: [roleIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamRolePermissionRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'SDKWork IAM role permission created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamRolePermissionSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM role permission request is invalid.'),
          '404': createProblemResponse('SDKWork IAM role was not found.'),
        },
      }),
    },
    'roles.permissions.delete': {
      parameters: [roleIdPathParameter, permissionIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '204',
        successDescription: 'SDKWork IAM role permission deleted successfully.',
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM role permission was not found.'),
        },
      }),
    },
    'securityEvents.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM security events returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamSecurityEventSummaryListEnvelope'),
      }),
    },
    'tenants.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM tenants returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamTenantSummaryListEnvelope'),
      }),
    },
    'tenants.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamTenantRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'SDKWork IAM tenant created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamTenantSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM tenant request is invalid.'),
        },
      }),
    },
    'tenants.retrieve': {
      parameters: [tenantIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM tenant returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamTenantSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM tenant was not found.'),
        },
      }),
    },
    'tenants.update': {
      parameters: [tenantIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateIamTenantRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM tenant updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamTenantSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM tenant update request is invalid.'),
          '404': createProblemResponse('SDKWork IAM tenant was not found.'),
        },
      }),
    },
    'tenants.delete': {
      parameters: [tenantIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '204',
        successDescription: 'SDKWork IAM tenant deleted successfully.',
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM tenant was not found.'),
        },
      }),
    },
    'tenants.members.list': {
      parameters: [tenantIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM tenant members returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamTenantMemberSummaryListEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM tenant was not found.'),
        },
      }),
    },
    'tenants.members.create': {
      parameters: [tenantIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamTenantMemberRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'SDKWork IAM tenant member created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamTenantMemberSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM tenant member request is invalid.'),
          '404': createProblemResponse('SDKWork IAM tenant was not found.'),
        },
      }),
    },
    'tenants.members.update': {
      parameters: [tenantIdPathParameter, iamUserIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateIamTenantMemberRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM tenant member updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamTenantMemberSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM tenant member update request is invalid.'),
          '404': createProblemResponse('SDKWork IAM tenant member was not found.'),
        },
      }),
    },
    'tenants.members.delete': {
      parameters: [tenantIdPathParameter, iamUserIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '204',
        successDescription: 'SDKWork IAM tenant member deleted successfully.',
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM tenant member was not found.'),
        },
      }),
    },
    'users.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM users returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamUserSummaryListEnvelope'),
      }),
    },
    'users.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamUserRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'SDKWork IAM user created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamUserSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM user request is invalid.'),
        },
      }),
    },
    'users.retrieve': {
      parameters: [iamUserIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM user returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamUserSummaryEnvelope'),
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM user was not found.'),
        },
      }),
    },
    'users.update': {
      parameters: [iamUserIdPathParameter],
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderUpdateIamUserRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM user updated successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamUserSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM user update request is invalid.'),
          '404': createProblemResponse('SDKWork IAM user was not found.'),
        },
      }),
    },
    'users.delete': {
      parameters: [iamUserIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '204',
        successDescription: 'SDKWork IAM user deleted successfully.',
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM user was not found.'),
        },
      }),
    },
    'roleBindings.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'SDKWork IAM user role bindings returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamUserRoleSummaryListEnvelope'),
      }),
    },
    'roleBindings.create': {
      requestBody: createOpenApiRequestBody(
        createOpenApiSchemaReference('BirdCoderCreateIamUserRoleRequest'),
      ),
      responses: buildOpenApiResponses({
        successStatus: '201',
        successDescription: 'SDKWork IAM user role binding created successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderIamUserRoleSummaryEnvelope'),
        extraResponses: {
          '400': createProblemResponse('SDKWork IAM user role binding request is invalid.'),
        },
      }),
    },
    'roleBindings.delete': {
      parameters: [roleBindingIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '204',
        successDescription: 'SDKWork IAM user role binding deleted successfully.',
        extraResponses: {
          '404': createProblemResponse('SDKWork IAM user role binding was not found.'),
        },
      }),
    },
    'teams.list': {
      parameters: [userIdParameter, workspaceIdParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Admin team inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderTeamSummaryListEnvelope'),
      }),
    },
    'teams.members.list': {
      parameters: [teamIdPathParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Team members returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderTeamMemberSummaryListEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Team was not found.'),
        },
      }),
    },
    'projects.deploymentTargets.list': {
      parameters: [projectIdPathParameter, pageParameter, pageSizeParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Deployment targets returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeploymentTargetSummaryListEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'deploymentGovernance.targets.list': {
      parameters: [projectIdPathParameter, pageParameter, pageSizeParameter],
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Admin deployment targets returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeploymentTargetSummaryListEnvelope'),
        extraResponses: {
          '404': createProblemResponse('Project was not found.'),
        },
      }),
    },
    'releases.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Release inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderReleaseSummaryListEnvelope'),
      }),
    },
    'deploymentGovernance.list': {
      responses: buildOpenApiResponses({
        successStatus: '200',
        successDescription: 'Admin deployment inventory returned successfully.',
        successSchema: createOpenApiSchemaReference('BirdCoderDeploymentRecordSummaryListEnvelope'),
      }),
    },
  };
}
