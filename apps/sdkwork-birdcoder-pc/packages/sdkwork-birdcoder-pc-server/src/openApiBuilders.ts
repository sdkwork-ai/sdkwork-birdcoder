import type {
  BirdCoderOpenApiParameterObject,
  BirdCoderOpenApiRequestBodyObject,
  BirdCoderOpenApiResponseObject,
  BirdCoderOpenApiSchema,
} from './openApiDocumentTypes.ts';
import { BIRDCODER_DATA_SCOPES } from '@sdkwork/birdcoder-pc-contracts-commons';

export function createOpenApiSchemaReference(schemaName: string): BirdCoderOpenApiSchema {
  return {
    $ref: `#/components/schemas/${schemaName}`,
  };
}

export function createOpenApiJsonContent(schema: BirdCoderOpenApiSchema) {
  return {
    'application/json': {
      schema,
    },
  } as const;
}

export function createOpenApiProblemJsonContent(schema: BirdCoderOpenApiSchema) {
  return {
    'application/problem+json': {
      schema,
    },
  } as const;
}

export function createOpenApiResponse(
  description: string,
  schema?: BirdCoderOpenApiSchema,
): BirdCoderOpenApiResponseObject {
  return schema
    ? {
        description,
        content: createOpenApiJsonContent(schema),
      }
    : {
        description,
      };
}

export function createOpenApiRequestBody(
  schema: BirdCoderOpenApiSchema,
  required = true,
): BirdCoderOpenApiRequestBodyObject {
  return {
    required,
    content: createOpenApiJsonContent(schema),
  };
}

export function createOpenApiObjectSchema(
  properties: Record<string, BirdCoderOpenApiSchema>,
  options: {
    additionalProperties?: BirdCoderOpenApiSchema | boolean;
    description?: string;
    required?: readonly string[];
  } = {},
): BirdCoderOpenApiSchema {
  return {
    type: 'object',
    properties,
    ...(options.required && options.required.length > 0
      ? { required: [...options.required] }
      : {}),
    ...(options.description ? { description: options.description } : {}),
    ...(options.additionalProperties === undefined
      ? { additionalProperties: false }
      : { additionalProperties: options.additionalProperties }),
  };
}

export function createOpenApiStringSchema(description?: string): BirdCoderOpenApiSchema {
  return {
    type: 'string',
    ...(description ? { description } : {}),
  };
}

export function createOpenApiLongIntegerStringSchema(description?: string): BirdCoderOpenApiSchema {
  return createOpenApiStringSchema(
    description ?? 'Java Long/BIGINT value serialized as an exact decimal string.',
  );
}

export function createOpenApiDateTimeSchema(description?: string): BirdCoderOpenApiSchema {
  return {
    type: 'string',
    format: 'date-time',
    ...(description ? { description } : {}),
  };
}

export function createOpenApiNullableSchema(
  schema: BirdCoderOpenApiSchema,
  description?: string,
): BirdCoderOpenApiSchema {
  return {
    anyOf: [schema, { type: 'null' }],
    ...(description ? { description } : {}),
  };
}

export function createOpenApiNullableStringSchema(description?: string): BirdCoderOpenApiSchema {
  return createOpenApiNullableSchema({ type: 'string' }, description);
}

export function createOpenApiIntegerSchema(
  minimum?: number,
  maximum?: number,
): BirdCoderOpenApiSchema {
  return {
    type: 'integer',
    ...(typeof minimum === 'number' ? { minimum } : {}),
    ...(typeof maximum === 'number' ? { maximum } : {}),
  };
}

export function createOpenApiNumberSchema(description?: string): BirdCoderOpenApiSchema {
  return {
    type: 'number',
    ...(description ? { description } : {}),
  };
}

export function createOpenApiBooleanSchema(description?: string): BirdCoderOpenApiSchema {
  return {
    type: 'boolean',
    ...(description ? { description } : {}),
  };
}

export function createOpenApiStringEnumSchema(
  values: readonly string[],
  description?: string,
): BirdCoderOpenApiSchema {
  const enumValues = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return enumValues.length > 0
    ? {
        type: 'string',
        enum: enumValues,
        ...(description ? { description } : {}),
      }
    : createOpenApiStringSchema(description);
}

export function createOpenApiDataScopeSchema(): BirdCoderOpenApiSchema {
  return createOpenApiStringEnumSchema(
    BIRDCODER_DATA_SCOPES,
    'DATABASE_SPEC.md standard data scope.',
  );
}

export function createOpenApiArraySchema(
  items: BirdCoderOpenApiSchema,
  description?: string,
): BirdCoderOpenApiSchema {
  return {
    type: 'array',
    items,
    ...(description ? { description } : {}),
  };
}

export function createSdkWorkEnvelopeComponentSchemas(): Record<string, BirdCoderOpenApiSchema> {
  return {
    SdkWorkApiResponse: createOpenApiObjectSchema(
      {
        code: {
          type: 'integer',
          format: 'int32',
          enum: [0],
          default: 0,
          minimum: 0,
          maximum: 0,
        },
        data: {
          description: 'Operation-specific payload typed per response schema.',
        },
        traceId: createOpenApiStringSchema('Server-owned request correlation id.'),
      },
      {
        required: ['code', 'data', 'traceId'],
      },
    ),
    SdkWorkResourceData: createOpenApiObjectSchema(
      {
        item: {
          type: 'object',
          additionalProperties: true,
          description: 'Typed domain resource for the operation.',
        },
      },
      {
        required: ['item'],
      },
    ),
    SdkWorkPageData: createOpenApiObjectSchema(
      {
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true,
          },
        },
        pageInfo: createOpenApiSchemaReference('PageInfo'),
      },
      {
        required: ['items', 'pageInfo'],
      },
    ),
    SdkWorkCommandData: createOpenApiObjectSchema(
      {
        accepted: {
          type: 'boolean',
          const: true,
        },
        resourceId: createOpenApiStringSchema(),
        status: createOpenApiStringSchema(),
      },
      {
        required: ['accepted'],
      },
    ),
    PageInfo: createOpenApiObjectSchema(
      {
        mode: createOpenApiStringEnumSchema(['offset', 'cursor']),
        page: createOpenApiIntegerSchema(1),
        pageSize: createOpenApiIntegerSchema(1),
        totalItems: createOpenApiStringSchema(),
        totalPages: createOpenApiIntegerSchema(0),
        nextCursor: createOpenApiStringSchema(),
        hasMore: createOpenApiBooleanSchema(),
      },
      {
        required: ['mode'],
      },
    ),
    ProblemDetail: createOpenApiObjectSchema(
      {
        type: createOpenApiStringSchema(),
        title: createOpenApiStringSchema(),
        status: createOpenApiIntegerSchema(100),
        detail: createOpenApiStringSchema(),
        instance: createOpenApiStringSchema(),
        code: createOpenApiIntegerSchema(40001),
        traceId: createOpenApiStringSchema('Server-owned request correlation id.'),
      },
      {
        required: ['type', 'title', 'status', 'code', 'traceId'],
        additionalProperties: true,
      },
    ),
  };
}

export function createOpenApiResourceResponseSchema(
  itemSchema: BirdCoderOpenApiSchema,
): BirdCoderOpenApiSchema {
  return {
    allOf: [
      createOpenApiSchemaReference('SdkWorkApiResponse'),
      createOpenApiObjectSchema(
        {
          data: createOpenApiObjectSchema(
            {
              item: itemSchema,
            },
            {
              required: ['item'],
            },
          ),
        },
        {
          required: ['data'],
        },
      ),
    ],
  };
}

export function createOpenApiListResponseSchema(
  itemSchema: BirdCoderOpenApiSchema,
): BirdCoderOpenApiSchema {
  return {
    allOf: [
      createOpenApiSchemaReference('SdkWorkApiResponse'),
      createOpenApiObjectSchema(
        {
          data: createOpenApiObjectSchema(
            {
              items: createOpenApiArraySchema(itemSchema),
              pageInfo: createOpenApiSchemaReference('PageInfo'),
            },
            {
              required: ['items', 'pageInfo'],
            },
          ),
        },
        {
          required: ['data'],
        },
      ),
    ],
  };
}

export function createOpenApiEnvelopeSchema(dataSchema: BirdCoderOpenApiSchema): BirdCoderOpenApiSchema {
  return createOpenApiResourceResponseSchema(dataSchema);
}

export function createOpenApiListEnvelopeSchema(itemSchema: BirdCoderOpenApiSchema): BirdCoderOpenApiSchema {
  return createOpenApiListResponseSchema(itemSchema);
}

export function createOpenApiCommandEnvelopeSchema(
  commandSchema: BirdCoderOpenApiSchema = createOpenApiSchemaReference('SdkWorkCommandData'),
): BirdCoderOpenApiSchema {
  return {
    allOf: [
      createOpenApiSchemaReference('SdkWorkApiResponse'),
      createOpenApiObjectSchema(
        {
          data: commandSchema,
        },
        {
          required: ['data'],
        },
      ),
    ],
  };
}

export function createOpenApiPathParameter(
  name: string,
  description: string,
): BirdCoderOpenApiParameterObject {
  return {
    name,
    in: 'path',
    required: true,
    description,
    schema: createOpenApiStringSchema(),
  };
}

export function createOpenApiQueryParameter(
  name: string,
  description: string,
  schema: BirdCoderOpenApiSchema,
  required = false,
): BirdCoderOpenApiParameterObject {
  return {
    name,
    in: 'query',
    description,
    ...(required ? { required: true } : {}),
    schema,
  };
}

export function createOpenApiHeaderParameter(
  name: string,
  description: string,
  schema: BirdCoderOpenApiSchema,
  required = false,
): BirdCoderOpenApiParameterObject {
  return {
    name,
    in: 'header',
    description,
    ...(required ? { required: true } : {}),
    schema,
  };
}

export function createOpenApiIdempotencyKeyParameter(
  required = true,
): BirdCoderOpenApiParameterObject {
  return createOpenApiHeaderParameter(
    'Idempotency-Key',
    'Client-generated idempotency key scoped to the authenticated principal and operation.',
    {
      ...createOpenApiStringSchema(),
      maxLength: 128,
      minLength: 8,
      pattern: '^[A-Za-z0-9._:@-]+$',
    },
    required,
  );
}

export function createOpenApiIfMatchParameter(
  required = true,
): BirdCoderOpenApiParameterObject {
  return createOpenApiHeaderParameter(
    'If-Match',
    'Current resource version required for optimistic concurrency.',
    {
      ...createOpenApiStringSchema(),
      maxLength: 32,
      minLength: 1,
      pattern: '[0-9]+',
    },
    required,
  );
}

export function createProblemResponse(description: string): BirdCoderOpenApiResponseObject {
  return {
    description,
    content: createOpenApiProblemJsonContent(
      createOpenApiSchemaReference('ProblemDetail'),
    ),
  };
}

export function buildOpenApiResponses(
  options?: Partial<{
    defaultDescription: string;
    extraResponses: Record<string, BirdCoderOpenApiResponseObject>;
    successDescription: string;
    successSchema: BirdCoderOpenApiSchema;
    successStatus: string;
  }>,
): Record<string, BirdCoderOpenApiResponseObject> {
  const responses: Record<string, BirdCoderOpenApiResponseObject> = {};
  const successStatus = options?.successStatus ?? '200';
  if (options?.successSchema) {
    responses[successStatus] = createOpenApiResponse(
      options.successDescription ?? 'Successful response',
      options.successSchema,
    );
  } else if (options?.successStatus) {
    responses[successStatus] = createOpenApiResponse(
      options.successDescription ?? 'Successful response',
    );
  } else {
    responses['200'] = createOpenApiResponse('Successful response');
  }

  if (options?.extraResponses) {
    Object.assign(responses, options.extraResponses);
  }

  if (!('default' in responses)) {
    responses.default = createProblemResponse(
      options?.defaultDescription ?? 'Problem response envelope.',
    );
  }

  return responses;
}
