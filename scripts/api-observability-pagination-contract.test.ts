import assert from 'node:assert/strict';
import fs from 'node:fs';

type Schema = {
  allOf?: Array<{ $ref?: string } & Schema>;
  items?: { $ref?: string };
  properties?: Record<string, Schema>;
  required?: string[];
  type?: string;
};

type Operation = {
  operationId?: string;
  parameters?: Array<{
    in?: string;
    name?: string;
    schema?: { maximum?: number; minimum?: number; type?: string };
  }>;
  responses?: Record<string, {
    content?: Record<string, { schema?: { $ref?: string } }>;
  }>;
  [key: string]: unknown;
};

const authorityUrl = new URL(
  '../sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json',
  import.meta.url,
);
const document = JSON.parse(fs.readFileSync(authorityUrl, 'utf8')) as {
  components?: { schemas?: Record<string, Schema> };
  info?: { title?: string };
  openapi?: string;
  paths?: Record<string, Record<string, Operation>>;
  'x-sdkwork-api-authority'?: string;
  'x-sdkwork-owner'?: string;
};

assert.equal(document.openapi, '3.1.0');
assert.equal(document.info?.title, 'SDKWork BirdCoder App API');
assert.equal(document['x-sdkwork-api-authority'], 'sdkwork-birdcoder-app-api');
assert.equal(document['x-sdkwork-owner'], 'sdkwork-birdcoder');

const httpMethods = new Set(['delete', 'get', 'head', 'options', 'patch', 'post', 'put']);
const operations = Object.entries(document.paths ?? {}).flatMap(([apiPath, pathItem]) =>
  Object.entries(pathItem)
    .filter(([method]) => httpMethods.has(method))
    .map(([method, operation]) => ({ apiPath, method, operation })),
);

assert.equal(operations.length, 4, 'BirdCoder App API must contain exactly four System operations.');

const routeKeys = new Set<string>();
const operationIds = new Set<string>();
for (const { apiPath, method, operation } of operations) {
  const routeKey = `${method.toUpperCase()} ${apiPath}`;
  const operationId = String(operation.operationId ?? '');
  assert.ok(apiPath.startsWith('/app/v3/api/system/'), `${routeKey} must use the System App API prefix.`);
  assert.equal(operation['x-sdkwork-owner'], 'sdkwork-birdcoder', `${routeKey} owner drifted.`);
  assert.equal(
    operation['x-sdkwork-api-authority'],
    'sdkwork-birdcoder-app-api',
    `${routeKey} authority drifted.`,
  );
  assert.equal(operation['x-sdkwork-api-surface'], 'app-api', `${routeKey} surface drifted.`);
  assert.ok(operationId, `${routeKey} must declare operationId.`);
  assert.equal(routeKeys.has(routeKey), false, `Duplicate route: ${routeKey}.`);
  assert.equal(operationIds.has(operationId), false, `Duplicate operationId: ${operationId}.`);
  routeKeys.add(routeKey);
  operationIds.add(operationId);
}

const schemas = document.components?.schemas ?? {};
const pageInfo = schemas.PageInfo;
assert.ok(pageInfo, 'App API authority must declare PageInfo.');
assert.deepEqual(pageInfo.properties?.mode?.type, 'string');
for (const field of ['page', 'pageSize', 'totalItems', 'totalPages', 'hasMore', 'nextCursor']) {
  assert.ok(pageInfo.properties?.[field], `PageInfo must declare ${field}.`);
}

const boundedListOperationIds = new Set(['routes.list']);
const listOperations = operations.filter(({ operation }) => operation.operationId?.endsWith('.list'));
assert.equal(listOperations.length, 1, 'App API must expose only the bounded System route catalog list.');

for (const { apiPath, method, operation } of listOperations) {
  const operationId = String(operation.operationId);
  const queryParameters = (operation.parameters ?? []).filter((parameter) => parameter.in === 'query');
  const queryParameterNames = queryParameters.map((parameter) => parameter.name);

  if (boundedListOperationIds.has(operationId)) {
    assert.deepEqual(
      queryParameterNames,
      [],
      `${operationId} is the bounded runtime route catalog and must not expose fake pagination inputs.`,
    );
  } else {
    assert.ok(queryParameterNames.includes('page'), `${operationId} must declare page.`);
    assert.ok(queryParameterNames.includes('page_size'), `${operationId} must declare page_size.`);
    assert.equal(
      queryParameters.find((parameter) => parameter.name === 'page_size')?.schema?.maximum,
      200,
      `${operationId} page_size must be capped at 200.`,
    );
    assert.equal(
      queryParameterNames.some((name) => ['limit', 'pageSize', 'page_no', 'pageNo', 'size'].includes(name ?? '')),
      false,
      `${operationId} must not expose a pagination alias.`,
    );
  }

  const successRef = operation.responses?.['200']?.content?.['application/json']?.schema?.$ref;
  const envelopeName = successRef?.split('/').at(-1) ?? '';
  assert.match(envelopeName, /ListEnvelope$/u, `${operationId} must return a typed ListEnvelope.`);

  const envelope = schemas[envelopeName];
  assert.ok(
    envelope?.allOf?.some((entry) => entry.$ref === '#/components/schemas/SdkWorkApiResponse'),
    `${operationId} ListEnvelope must compose SdkWorkApiResponse.`,
  );
  const dataSchema = envelope?.allOf?.find((entry) => entry.properties?.data)?.properties?.data;
  assert.equal(dataSchema?.properties?.items?.type, 'array', `${operationId} data.items must be an array.`);
  assert.equal(
    dataSchema?.properties?.pageInfo?.$ref,
    '#/components/schemas/PageInfo',
    `${operationId} data.pageInfo must use PageInfo.`,
  );
  assert.ok(dataSchema?.required?.includes('items'), `${operationId} must require data.items.`);
  assert.ok(dataSchema?.required?.includes('pageInfo'), `${operationId} must require data.pageInfo.`);
  assert.equal(method, 'get', `${operationId} list operation must use GET.`);
  assert.ok(apiPath.startsWith('/app/v3/api/'));
}

console.log('App API authority, observability and pagination contract passed.');
