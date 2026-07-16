#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const STANDARD_PROFILE = 'sdkwork-v3';
const GENERATED_BY = 'scripts/generate-birdcoder-sdk-family.mjs';
const HTTP_METHODS = new Set(['delete', 'get', 'patch', 'post', 'put']);
const HTTP_METHOD_ORDER = {
  delete: 4,
  get: 0,
  patch: 3,
  post: 1,
  put: 2,
};
const SDKWORK_DEPLOYMENTS = new Set(['all', 'local', 'private', 'saas']);

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();
  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

export function parseArgs(argv) {
  const options = {
    apiPrefix: '',
    check: false,
    crateName: '',
    input: '',
    packageName: '',
    rustOutput: '',
    standardProfile: STANDARD_PROFILE,
    surface: '',
    typescriptOutput: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--check') {
      options.check = true;
      continue;
    }
    if (token === '--surface') {
      options.surface = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === '--standard-profile') {
      options.standardProfile = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === '--input') {
      options.input = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === '--typescript-output') {
      options.typescriptOutput = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === '--rust-output') {
      options.rustOutput = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === '--package-name') {
      options.packageName = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === '--crate-name') {
      options.crateName = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === '--api-prefix') {
      options.apiPrefix = readOptionValue(argv, index, token);
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${token}`);
  }

  return options;
}

function normalizeRelativePath(value) {
  return String(value ?? '').replace(/\\/gu, '/');
}

function toAbsolutePath(rootDir, relativePath) {
  return path.resolve(rootDir, normalizeRelativePath(relativePath));
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeTextFile(filePath, content, { check = false, mismatches = [] } = {}) {
  const normalizedContent = content.endsWith('\n') ? content : `${content}\n`;
  if (check) {
    if (!fs.existsSync(filePath)) {
      mismatches.push(`Missing generated file: ${path.relative(process.cwd(), filePath)}`);
      return;
    }

    const current = fs.readFileSync(filePath, 'utf8');
    if (current !== normalizedContent) {
      mismatches.push(`Generated file is out of date: ${path.relative(process.cwd(), filePath)}`);
    }
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, normalizedContent, 'utf8');
}

const GENERATED_OUTPUT_SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'generated',
  'specs',
  'target',
]);

function collectExistingGeneratedFiles(outputDir, currentDir = outputDir) {
  if (!fs.existsSync(currentDir)) {
    return [];
  }

  const files = [];
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (GENERATED_OUTPUT_SKIP_DIRS.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectExistingGeneratedFiles(outputDir, absolutePath));
      continue;
    }

    if (entry.isFile()) {
      files.push(normalizeRelativePath(path.relative(outputDir, absolutePath)));
    }
  }

  return files;
}

function removeStaleGeneratedFiles(outputDir, expectedRelativePaths, { check = false, mismatches = [] } = {}) {
  const expected = new Set([...expectedRelativePaths].map(normalizeRelativePath));
  for (const relativePath of collectExistingGeneratedFiles(outputDir)) {
    if (expected.has(relativePath)) {
      continue;
    }

    const absolutePath = path.join(outputDir, ...relativePath.split('/'));
    const displayPath = normalizeRelativePath(path.relative(process.cwd(), absolutePath));
    if (check) {
      mismatches.push(`Unexpected stale generated file: ${displayPath}`);
      continue;
    }

    fs.rmSync(absolutePath, { force: true });
  }
}

function discoverFamilyManifests(rootDir) {
  const sdksRoot = path.join(rootDir, 'sdks');
  return fs.readdirSync(sdksRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(sdksRoot, entry.name, 'sdk-manifest.json'))
    .filter((manifestPath) => fs.existsSync(manifestPath))
    .map(readJsonFile)
    .filter((manifest) => manifest.sdkOwner === 'sdkwork-birdcoder');
}

function resolveSurfacePlansFromManifests(rootDir, requestedSurface = '') {
  return discoverFamilyManifests(rootDir)
    .map((manifest) => {
      const surface = manifest.discoverySurface?.sdkTarget;
      const languages = new Map((manifest.languages ?? []).map((entry) => [entry.language, entry]));
      const typescript = languages.get('typescript');
      const rust = languages.get('rust');
      const input = manifest.metadata?.generation?.sourceSpec;
      if (!surface || !typescript || !rust || !input) {
        throw new Error(`${manifest.sdkFamily} must declare its surface, source spec, TypeScript, and Rust workspaces.`);
      }
      if (manifest.standardProfile !== STANDARD_PROFILE) {
        throw new Error(`${manifest.sdkFamily} must use ${STANDARD_PROFILE}.`);
      }
      return {
        apiPrefix: manifest.discoverySurface.apiPrefix,
        crateName: String(rust.name ?? manifest.sdkFamily).replace(/-/gu, '_'),
        input,
        packageName: manifest.packageName,
        rustOutput: `sdks/${manifest.sdkFamily}/${rust.workspace}`,
        standardProfile: manifest.standardProfile,
        surface,
        typescriptOutput: `sdks/${manifest.sdkFamily}/${typescript.workspace}`,
      };
    })
    .filter((plan) => !requestedSurface || plan.surface === requestedSurface);
}

function resolvePlans(rootDir, options) {
  if (!options.input && !options.typescriptOutput && !options.rustOutput) {
    return resolveSurfacePlansFromManifests(rootDir, options.surface);
  }

  const required = [
    'apiPrefix',
    'crateName',
    'input',
    'packageName',
    'rustOutput',
    'surface',
    'typescriptOutput',
  ];
  for (const key of required) {
    if (!String(options[key] ?? '').trim()) {
      throw new Error(`Missing --${key.replace(/[A-Z]/gu, (match) => `-${match.toLowerCase()}`)}.`);
    }
  }

  return [
    {
      apiPrefix: options.apiPrefix,
      crateName: options.crateName,
      input: options.input,
      packageName: options.packageName,
      rustOutput: options.rustOutput,
      standardProfile: options.standardProfile,
      surface: options.surface,
      typescriptOutput: options.typescriptOutput,
    },
  ];
}

const CANONICAL_FLAT_OPERATION_IDS = new Set([
  'submitApprovalDecision',
  'submitUserQuestionAnswer',
]);

function assertOperationId(operationId, context) {
  const normalized = String(operationId ?? '');
  if (CANONICAL_FLAT_OPERATION_IDS.has(normalized)) {
    return;
  }
  if (!/^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/u.test(normalized)) {
    throw new Error(`${context} operationId must use lowerCamel dotted resource.action syntax.`);
  }
  if (/(?:__|_|-|\/|\{|\}|\s|:)/u.test(normalized)) {
    throw new Error(`${context} operationId contains non-standard separators.`);
  }
}

function buildOperationKey(tag, operationId) {
  const normalizedTag = String(tag);
  const normalizedOperationId = String(operationId);
  return normalizedOperationId.startsWith(`${normalizedTag}.`)
    ? normalizedOperationId
    : `${normalizedTag}.${normalizedOperationId}`;
}

function readRequiredSdkworkString(operation, key, context) {
  const value = String(operation?.[key] ?? '').trim();
  if (!value) {
    throw new Error(`${context} must declare ${key}.`);
  }
  return value;
}

function collectSdkworkOperationMetadata(operation, context) {
  const deployment = readRequiredSdkworkString(operation, 'x-sdkwork-deployment', context);
  if (!SDKWORK_DEPLOYMENTS.has(deployment)) {
    throw new Error(`${context} x-sdkwork-deployment must be one of ${[...SDKWORK_DEPLOYMENTS].join(', ')}.`);
  }

  const isPublic = operation?.['x-sdkwork-public'];
  if (typeof isPublic !== 'boolean') {
    throw new Error(`${context} must declare boolean x-sdkwork-public.`);
  }

  const metadata = {
    dataScope: readRequiredSdkworkString(operation, 'x-sdkwork-data-scope', context),
    deployment,
    domain: readRequiredSdkworkString(operation, 'x-sdkwork-domain', context),
    permission: null,
    public: isPublic,
    resource: readRequiredSdkworkString(operation, 'x-sdkwork-resource', context),
    tenantScope: readRequiredSdkworkString(operation, 'x-sdkwork-tenant-scope', context),
  };

  const permission = String(operation?.['x-sdkwork-permission'] ?? '').trim();
  if (isPublic) {
    if (permission) {
      throw new Error(`${context} must not declare x-sdkwork-permission when x-sdkwork-public is true.`);
    }
    return metadata;
  }
  if (!permission) {
    throw new Error(`${context} must declare x-sdkwork-permission when x-sdkwork-public is false.`);
  }
  metadata.permission = permission;
  return metadata;
}

function resolveLocalComponentRef(document, ref, expectedComponent) {
  const match = new RegExp(`^#/components/${expectedComponent}/(?<name>[A-Za-z0-9_.-]+)$`, 'u')
    .exec(String(ref ?? ''));
  if (!match?.groups?.name) {
    throw new Error(`Unsupported OpenAPI reference ${ref}.`);
  }

  const value = document.components?.[expectedComponent]?.[match.groups.name];
  if (!value || typeof value !== 'object') {
    throw new Error(`Missing OpenAPI component ${expectedComponent}.${match.groups.name}.`);
  }
  return value;
}

function resolveOperationParameters(document, operation, context) {
  return (operation.parameters ?? []).map((parameter) => {
    if (parameter?.$ref) {
      return resolveLocalComponentRef(document, parameter.$ref, 'parameters');
    }
    if (!parameter || typeof parameter !== 'object') {
      throw new Error(`${context} contains an invalid OpenAPI parameter.`);
    }
    return parameter;
  });
}

function collectOperations(document, plan) {
  if (plan.standardProfile !== STANDARD_PROFILE) {
    throw new Error(`Surface ${plan.surface} must use ${STANDARD_PROFILE}.`);
  }
  if (document.openapi !== '3.1.0') {
    throw new Error(`${plan.input} must use OpenAPI 3.1.0.`);
  }
  if (document.servers?.[0]?.url !== plan.apiPrefix) {
    throw new Error(`${plan.input} must publish server URL ${plan.apiPrefix}.`);
  }

  const operations = [];
  const seenKeys = new Set();

  for (const [pathKey, methodMap] of Object.entries(document.paths ?? {})) {
    if (!pathKey.startsWith(plan.apiPrefix)) {
      throw new Error(`${plan.input} path ${pathKey} must stay under ${plan.apiPrefix}.`);
    }
    const staticPathSegments = pathKey
      .replace(plan.apiPrefix, '')
      .replace(/\{[A-Za-z][A-Za-z0-9]*\}/gu, '');
    if (/[A-Z]|__/u.test(staticPathSegments)) {
      throw new Error(`${plan.input} path ${pathKey} must use lower_snake_case static segments.`);
    }

    for (const [rawMethod, operation] of Object.entries(methodMap ?? {})) {
      const method = String(rawMethod).toLowerCase();
      if (!HTTP_METHODS.has(method)) {
        continue;
      }

      const tags = Array.isArray(operation.tags) ? operation.tags.filter(Boolean) : [];
      if (tags.length !== 1) {
        throw new Error(`${method.toUpperCase()} ${pathKey} must have exactly one tag.`);
      }
      const tag = String(tags[0]);
      if (!/^[a-z][a-zA-Z0-9]*$/u.test(tag)) {
        throw new Error(`${method.toUpperCase()} ${pathKey} tag must be lowerCamel.`);
      }
      assertOperationId(operation.operationId, `${method.toUpperCase()} ${pathKey}`);

      const normalizedOperation = {
        ...operation,
        parameters: resolveOperationParameters(document, operation, `${method.toUpperCase()} ${pathKey}`),
      };
      const key = buildOperationKey(tag, operation.operationId);
      if (new RegExp(`^${tag}\\.${tag}\\.`, 'u').test(key)) {
        throw new Error(`${method.toUpperCase()} ${pathKey} generated SDK operation key must not repeat tag ${tag}.`);
      }
      if (seenKeys.has(key)) {
        throw new Error(`Duplicate SDK operation key: ${key}.`);
      }
      seenKeys.add(key);

      operations.push({
        ...collectSdkworkOperationMetadata(operation, `${method.toUpperCase()} ${pathKey}`),
        description: String(operation.description ?? '').trim(),
        key,
        method: method.toUpperCase(),
        operation: normalizedOperation,
        operationId: String(operation.operationId),
        path: pathKey,
        pathParamNames: [...pathKey.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/gu)].map((match) => match[1]),
        summary: String(operation.summary ?? '').trim(),
        tag,
      });
    }
  }

  operations.sort((left, right) => {
    if (left.tag !== right.tag) {
      return left.tag.localeCompare(right.tag);
    }
    if (left.operationId !== right.operationId) {
      return left.operationId.localeCompare(right.operationId);
    }
    return (HTTP_METHOD_ORDER[left.method.toLowerCase()] ?? 99)
      - (HTTP_METHOD_ORDER[right.method.toLowerCase()] ?? 99);
  });

  if (operations.length === 0) {
    throw new Error(`${plan.input} does not define SDK operations.`);
  }

  return operations;
}

function pascalCase(value) {
  return String(value)
    .split(/[^A-Za-z0-9]+/u)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('');
}

function camelToSnake(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .replace(/[^A-Za-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .toLowerCase();
}

function upperSnake(value) {
  return camelToSnake(value).toUpperCase();
}

function quoteTsString(value) {
  return JSON.stringify(String(value));
}

function quoteRustString(value) {
  return JSON.stringify(String(value));
}

function schemaRefName(ref) {
  const match = /^#\/components\/schemas\/(?<name>[A-Za-z0-9_.-]+)$/u.exec(String(ref ?? ''));
  return match?.groups?.name ?? 'unknown';
}

function tsPropertyName(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(name) ? name : JSON.stringify(name);
}

function resolveComponentSchema(schema, schemas) {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }
  if (schema.$ref) {
    return schemas?.[schemaRefName(schema.$ref)] ?? schema;
  }
  return schema;
}

function mergeAllOfObjectSchema(schema, schemas) {
  if (!Array.isArray(schema?.allOf) || schema.allOf.length === 0) {
    return schema;
  }

  const merged = {
    type: 'object',
    properties: {},
    required: [],
  };
  const required = new Set();

  for (const part of schema.allOf) {
    const resolved = resolveComponentSchema(part, schemas);
    if (resolved?.properties && typeof resolved.properties === 'object') {
      Object.assign(merged.properties, resolved.properties);
    }
    if (Array.isArray(resolved?.required)) {
      for (const name of resolved.required) {
        required.add(name);
      }
    }
  }

  merged.required = [...required];
  return merged;
}

function tsTypeFromSchema(schema, fallback = 'unknown', options = {}) {
  if (!schema || typeof schema !== 'object') {
    return fallback;
  }
  if (schema.$ref) {
    const refName = schemaRefName(schema.$ref);
    return options.namespaceRefs ? `${options.namespaceRefs}.${refName}` : refName;
  }
  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    const merged = mergeAllOfObjectSchema(schema, options.schemas);
    if (merged?.properties && Object.keys(merged.properties).length > 0) {
      return tsTypeFromSchema(merged, fallback, options);
    }
  }
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  }
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return schema.oneOf.map((entry) => tsTypeFromSchema(entry, fallback, options)).join(' | ');
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return schema.anyOf.map((entry) => tsTypeFromSchema(entry, fallback, options)).join(' | ');
  }

  const type = Array.isArray(schema.type) ? schema.type.find((entry) => entry !== 'null') : schema.type;
  if (type === 'string') {
    return 'string';
  }
  if (type === 'integer' || type === 'number') {
    return 'number';
  }
  if (type === 'boolean') {
    return 'boolean';
  }
  if (type === 'array') {
    return `Array<${tsTypeFromSchema(schema.items, 'unknown', options)}>`;
  }
  if (type === 'object') {
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      return `Record<string, ${tsTypeFromSchema(schema.additionalProperties, 'unknown', options)}>`;
    }
    return 'Record<string, unknown>';
  }
  return fallback;
}

function collectJsonContentSchema(container) {
  return container?.content?.['application/json']?.schema ?? null;
}

function operationRequestBodyType(operation, options = {}) {
  return tsTypeFromSchema(collectJsonContentSchema(operation.requestBody), 'never', options);
}

function operationResponseType(operation, options = {}) {
  const responses = operation.responses ?? {};
  for (const status of ['200', '201', '202']) {
    const schema = collectJsonContentSchema(responses[status]);
    if (schema) {
      return tsTypeFromSchema(schema, 'unknown', options);
    }
  }
  return 'void';
}

function collectQueryParameters(operation, options = {}) {
  return (operation.parameters ?? [])
    .filter((parameter) => parameter?.in === 'query')
    .map((parameter) => ({
      name: String(parameter.name),
      required: parameter.required === true,
      type: tsTypeFromSchema(parameter.schema, 'BirdcoderSdkQueryValue', options),
    }));
}

function renderTsSchemas(schemas) {
  const chunks = [];
  for (const [schemaName, schema] of Object.entries(schemas ?? {}).sort(([left], [right]) => left.localeCompare(right))) {
    const normalized = mergeAllOfObjectSchema(schema, schemas);
    const required = new Set(Array.isArray(normalized.required) ? normalized.required : []);
    if (Array.isArray(normalized.enum) && normalized.enum.length > 0) {
      chunks.push(`export type ${schemaName} = ${normalized.enum.map((value) => JSON.stringify(value)).join(' | ')};`);
      continue;
    }

    if (normalized.type === 'object' || normalized.properties) {
      const properties = Object.entries(normalized.properties ?? {});
      if (properties.length === 0) {
        chunks.push(`export interface ${schemaName} extends Record<string, unknown> {}`);
        continue;
      }

      const lines = [`export interface ${schemaName} {`];
      for (const [propertyName, propertySchema] of properties) {
        const optional = required.has(propertyName) ? '' : '?';
        lines.push(`  ${tsPropertyName(propertyName)}${optional}: ${tsTypeFromSchema(propertySchema, 'unknown', { schemas })};`);
      }
      lines.push('}');
      chunks.push(lines.join('\n'));
      continue;
    }

    chunks.push(`export type ${schemaName} = ${tsTypeFromSchema(normalized, 'unknown', { schemas })};`);
  }
  return chunks.join('\n\n');
}

function buildOperationTypeNames(operation) {
  const baseName = pascalCase(operation.key);
  return {
    pathParams: `${baseName}PathParams`,
    query: `${baseName}Query`,
  };
}

function renderTsOperationTypes(operations) {
  const chunks = [];
  for (const operation of operations) {
    const names = buildOperationTypeNames(operation);
    if (operation.pathParamNames.length > 0) {
      const lines = [`export interface ${names.pathParams} {`];
      for (const name of operation.pathParamNames) {
        lines.push(`  ${name}: string;`);
      }
      lines.push('}');
      chunks.push(lines.join('\n'));
    }

    const queryParameters = collectQueryParameters(operation.operation);
    if (queryParameters.length > 0) {
      const lines = [`export interface ${names.query} extends Record<string, BirdcoderSdkQueryValue> {`];
      for (const parameter of queryParameters) {
        lines.push(`  ${tsPropertyName(parameter.name)}${parameter.required ? '' : '?'}: ${parameter.type};`);
      }
      lines.push('}');
      chunks.push(lines.join('\n'));
    }
  }
  return chunks.join('\n\n');
}

function createTreeNode() {
  return {
    children: new Map(),
    method: null,
  };
}

function buildOperationTree(operations, { includeTag = true } = {}) {
  const root = createTreeNode();
  for (const operation of operations) {
    const operationSegments = operation.operationId.split('.');
    const segments = includeTag && operationSegments[0] !== operation.tag
      ? [operation.tag, ...operationSegments]
      : operationSegments;
    let cursor = root;
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (!cursor.children.has(segment)) {
        cursor.children.set(segment, createTreeNode());
      }
      cursor = cursor.children.get(segment);
      if (index === segments.length - 1) {
        cursor.method = operation;
      }
    }
  }
  return root;
}

function buildTsMethodParameters(operation, { defaults = false, namespaceTypes = '', schemas = {} } = {}) {
  const names = buildOperationTypeNames(operation);
  const hasPathParams = operation.pathParamNames.length > 0;
  const queryParameters = collectQueryParameters(operation.operation, { schemas });
  const hasQuery = queryParameters.length > 0;
  const hasRequiredQuery = queryParameters.some((parameter) => parameter.required);
  const hasBody = Boolean(operation.operation.requestBody);
  const schemaOptions = { namespaceRefs: namespaceTypes, schemas };
  const bodyType = operationRequestBodyType(operation.operation, schemaOptions);
  const responseType = operationResponseType(operation.operation, schemaOptions);

  const parameters = [];
  const argumentFields = [];
  if (hasPathParams) {
    parameters.push(`pathParams: ${names.pathParams}`);
    argumentFields.push('pathParams');
  }
  if (hasBody) {
    parameters.push(`body: ${bodyType}`);
    argumentFields.push('body');
  }
  if (hasQuery) {
    parameters.push(
      defaults
        ? `query: ${names.query}${hasRequiredQuery ? '' : ' = {}'}`
        : `query${hasRequiredQuery ? '' : '?'}: ${names.query}`,
    );
    argumentFields.push('query');
  }
  parameters.push(
    defaults
      ? 'options: BirdcoderSdkRequestOptions = {}'
      : 'options?: BirdcoderSdkRequestOptions',
  );

  const argumentSource = argumentFields.length > 0
    ? `{ ${argumentFields.join(', ')} }`
    : '{}';

  return {
    argumentSource,
    parameters,
    responseType,
  };
}

function renderTsApiMethodImplementation(operation, indent, schemas) {
  const pad = ' '.repeat(indent);
  const { argumentSource, parameters, responseType } = buildTsMethodParameters(operation, {
    defaults: true,
    namespaceTypes: 'Types',
    schemas,
  });

  return [
    `${pad}${operation.operationId.split('.').at(-1)}(${parameters.join(', ')}) {`,
    `${pad}  return requestOperation<${responseType}>(${quoteTsString(operation.key)}, ${argumentSource}, options);`,
    `${pad}}`,
  ].join('\n');
}

function renderTsApiImplementationTree(node, indent = 4, schemas = {}) {
  const pad = ' '.repeat(indent);
  const entries = [];
  for (const [name, child] of [...node.children.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (child.method) {
      entries.push(renderTsApiMethodImplementation(child.method, indent, schemas));
      continue;
    }
    entries.push(`${pad}${tsPropertyName(name)}: {\n${renderTsApiImplementationTree(child, indent + 2, schemas)}\n${pad}}`);
  }
  return entries.join(',\n');
}

function renderTsApiMethodSignature(operation, indent, schemas) {
  const pad = ' '.repeat(indent);
  const { parameters, responseType } = buildTsMethodParameters(operation, {
    namespaceTypes: 'Types',
    schemas,
  });
  return `${pad}${operation.operationId.split('.').at(-1)}(${parameters.join(', ')}): Promise<${responseType}>;`;
}

function renderTsApiInterfaceTree(node, indent = 2, schemas = {}) {
  const pad = ' '.repeat(indent);
  const entries = [];
  for (const [name, child] of [...node.children.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (child.method) {
      entries.push(renderTsApiMethodSignature(child.method, indent, schemas));
      continue;
    }
    entries.push(`${pad}${tsPropertyName(name)}: {\n${renderTsApiInterfaceTree(child, indent + 2, schemas)}\n${pad}};`);
  }
  return entries.join('\n');
}

function sdkNamePart(surface) {
  return `${surface.charAt(0).toUpperCase()}${surface.slice(1)}`;
}

function tagApiName(tag) {
  return `${pascalCase(tag)}Api`;
}

function tagApiFactoryName(tag) {
  return `create${pascalCase(tag)}Api`;
}

function tagApiFileName(tag) {
  return camelToSnake(tag).replace(/_/gu, '-');
}

function groupOperationsByTag(operations) {
  const groups = new Map();
  for (const operation of operations) {
    if (!groups.has(operation.tag)) {
      groups.set(operation.tag, []);
    }
    groups.get(operation.tag).push(operation);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function renderTypescriptTypesSource(plan, document, operations) {
  const operationConstantName = `BIRDCODER_${upperSnake(plan.surface)}_SDK_OPERATIONS`;
  const operationIndexName = `BIRDCODER_${upperSnake(plan.surface)}_SDK_OPERATION_INDEX`;
  const operationRecords = operations.map((operation) => ({
    key: operation.key,
    method: operation.method,
    operationId: operation.operationId,
    path: operation.path,
    pathParamNames: operation.pathParamNames,
    dataScope: operation.dataScope,
    deployment: operation.deployment,
    domain: operation.domain,
    ...(operation.permission ? { permission: operation.permission } : {}),
    public: operation.public,
    resource: operation.resource,
    summary: operation.summary,
    tag: operation.tag,
    tenantScope: operation.tenantScope,
  }));
  const schemaSource = renderTsSchemas(document.components?.schemas ?? {});
  const operationTypeSource = renderTsOperationTypes(operations);

  return `// Generated by ${GENERATED_BY} from ${normalizeRelativePath(plan.input)}. Do not edit by hand.

export const BIRDCODER_${upperSnake(plan.surface)}_SDK_STANDARD_PROFILE = ${quoteTsString(STANDARD_PROFILE)} as const;
export const BIRDCODER_${upperSnake(plan.surface)}_SDK_API_PREFIX = ${quoteTsString(plan.apiPrefix)} as const;
export const BIRDCODER_${upperSnake(plan.surface)}_SDK_PACKAGE_NAME = ${quoteTsString(plan.packageName)} as const;

export type BirdcoderSdkQueryValue = boolean | number | string | null | undefined;

export interface BirdcoderSdkOperationDescriptor {
  dataScope: string;
  deployment: 'all' | 'local' | 'private' | 'saas';
  domain: string;
  key: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  operationId: string;
  path: string;
  pathParamNames: readonly string[];
  permission?: string;
  public: boolean;
  resource: string;
  summary: string;
  tag: string;
  tenantScope: string;
}

${schemaSource}

${operationTypeSource}

export const ${operationConstantName} = ${JSON.stringify(operationRecords, null, 2)} as const;

export const ${operationIndexName}: Record<string, BirdcoderSdkOperationDescriptor> = Object.fromEntries(
  ${operationConstantName}.map((operation) => [operation.key, operation]),
);
`;
}

function renderTypescriptHttpSource(plan) {
  return `// Generated by ${GENERATED_BY} from ${normalizeRelativePath(plan.input)}. Do not edit by hand.

import type {
  BirdcoderSdkOperationDescriptor,
  BirdcoderSdkQueryValue,
} from '../types/index.ts';

export const AUTHORIZATION_HEADER = 'Authorization';
export const SDKWORK_ACCESS_TOKEN_HEADER = 'Access-Token';

export interface BirdcoderSdkTransportRequest {
  body?: unknown;
  headers?: Record<string, string | undefined>;
  method: BirdcoderSdkOperationDescriptor['method'];
  path: string;
  query?: Record<string, BirdcoderSdkQueryValue>;
}

export interface BirdcoderSdkTransport {
  request<TResponse>(request: BirdcoderSdkTransportRequest): Promise<TResponse>;
}

export interface BirdcoderSdkAuthTokens {
  accessToken?: string;
  authToken?: string;
}

export interface BirdcoderSdkRequestOptions {
  headers?: Record<string, string | undefined>;
}

export type BirdcoderSdkRequestOperation = <TResponse>(
  operationKey: string,
  args?: {
    body?: unknown;
    pathParams?: object;
    query?: Record<string, BirdcoderSdkQueryValue>;
  },
  requestOptions?: BirdcoderSdkRequestOptions,
) => Promise<TResponse>;

export interface CreateBirdcoderSdkOperationRequesterOptions {
  accessToken?: string;
  authToken?: string;
  operationIndex: Record<string, BirdcoderSdkOperationDescriptor>;
  surface: string;
  transport: BirdcoderSdkTransport;
}

export interface BirdcoderSdkOperationRequester {
  clearSdkworkAuthTokens(): void;
  requestOperation: BirdcoderSdkRequestOperation;
  setSdkworkAuthTokens(tokens: BirdcoderSdkAuthTokens): void;
}

export function createBirdcoderSdkOperationRequester({
  accessToken,
  authToken,
  operationIndex,
  surface,
  transport,
}: CreateBirdcoderSdkOperationRequesterOptions): BirdcoderSdkOperationRequester {
  let authTokens: BirdcoderSdkAuthTokens = {
    accessToken,
    authToken,
  };

  function buildSdkworkAuthHeaders(): Record<string, string | undefined> {
    return {
      [AUTHORIZATION_HEADER]: authTokens.authToken ? \`Bearer \${authTokens.authToken}\` : undefined,
      [SDKWORK_ACCESS_TOKEN_HEADER]: authTokens.accessToken,
    };
  }

  function resolveOperationPath(
    operation: BirdcoderSdkOperationDescriptor,
    pathParams: object = {},
  ): string {
    return operation.pathParamNames.reduce((currentPath, name) => {
      const value = (pathParams as Record<string, string>)[name];
      if (!value) {
        throw new Error(\`Missing required path parameter "\${name}" for \${operation.key}.\`);
      }
      return currentPath.replace(\`{\${name}}\`, encodeURIComponent(value));
    }, operation.path);
  }

  function requestOperation<TResponse>(
    operationKey: string,
    args: {
      body?: unknown;
      pathParams?: object;
      query?: Record<string, BirdcoderSdkQueryValue>;
    } = {},
    requestOptions: BirdcoderSdkRequestOptions = {},
  ): Promise<TResponse> {
    const operation = operationIndex[operationKey];
    if (!operation) {
      throw new Error(\`Unknown BirdCoder \${surface} SDK operation: \${operationKey}.\`);
    }

    const request: BirdcoderSdkTransportRequest = {
      headers: {
        ...buildSdkworkAuthHeaders(),
        ...requestOptions.headers,
      },
      method: operation.method,
      path: resolveOperationPath(operation, args.pathParams),
    };
    if (args.body !== undefined) {
      request.body = args.body;
    }
    if (args.query !== undefined) {
      request.query = args.query;
    }
    return transport.request<TResponse>(request);
  }

  return {
    clearSdkworkAuthTokens() {
      authTokens = {};
    },
    requestOperation,
    setSdkworkAuthTokens(tokens: BirdcoderSdkAuthTokens) {
      authTokens = { ...tokens };
    },
  };
}
`;
}

function renderTypescriptApiSource(plan, tag, operations, schemas) {
  const apiName = tagApiName(tag);
  const factoryName = tagApiFactoryName(tag);
  const tree = buildOperationTree(operations, { includeTag: false });
  const implementationTree = renderTsApiImplementationTree(tree, 4, schemas);
  const interfaceTree = renderTsApiInterfaceTree(tree, 2, schemas);

  return `// Generated by ${GENERATED_BY} from ${normalizeRelativePath(plan.input)}. Do not edit by hand.

import type {
  BirdcoderSdkRequestOperation,
  BirdcoderSdkRequestOptions,
} from '../http/index.ts';
import type * as Types from '../types/index.ts';

type BirdcoderSdkQueryValue = Types.BirdcoderSdkQueryValue;
${operations
  .flatMap((operation) => {
    const names = buildOperationTypeNames(operation);
    return [
      operation.pathParamNames.length > 0 ? `type ${names.pathParams} = Types.${names.pathParams};` : '',
      collectQueryParameters(operation.operation).length > 0 ? `type ${names.query} = Types.${names.query};` : '',
    ].filter(Boolean);
  })
  .join('\n')}

export interface ${apiName} {
${interfaceTree}
}

export function ${factoryName}(requestOperation: BirdcoderSdkRequestOperation): ${apiName} {
  return {
${implementationTree}
  };
}
`;
}

function renderTypescriptApiIndexSource(plan, tagGroups) {
  return `// Generated by ${GENERATED_BY} from ${normalizeRelativePath(plan.input)}. Do not edit by hand.

${tagGroups.map(([tag]) => `export * from './${tagApiFileName(tag)}.ts';`).join('\n')}
`;
}

function renderTypescriptSdkSource(plan, tagGroups) {
  const namePart = sdkNamePart(plan.surface);
  const operationIndexName = `BIRDCODER_${upperSnake(plan.surface)}_SDK_OPERATION_INDEX`;
  const apiImports = tagGroups
    .map(([tag]) => `import { ${tagApiFactoryName(tag)}, type ${tagApiName(tag)} } from './api/${tagApiFileName(tag)}.ts';`)
    .join('\n');
  const apiProperties = tagGroups
    .map(([tag]) => `  ${tag}: ${tagApiName(tag)};`)
    .join('\n');
  const apiAssignments = tagGroups
    .map(([tag]) => `    ${tag}: ${tagApiFactoryName(tag)}(requester.requestOperation),`)
    .join('\n');

  return `// Generated by ${GENERATED_BY} from ${normalizeRelativePath(plan.input)}. Do not edit by hand.

import {
  createBirdcoderSdkOperationRequester,
  type BirdcoderSdkAuthTokens,
  type BirdcoderSdkTransport,
} from './http/index.ts';
import { ${operationIndexName} } from './types/index.ts';
${apiImports}

export interface CreateBirdcoder${namePart}SdkClientOptions {
  accessToken?: string;
  authToken?: string;
  transport: BirdcoderSdkTransport;
}

export interface Birdcoder${namePart}SdkClient {
  clearSdkworkAuthTokens(): void;
  setSdkworkAuthTokens(tokens: BirdcoderSdkAuthTokens): void;
${apiProperties}
}

export function createBirdcoder${namePart}SdkClient(
  options: CreateBirdcoder${namePart}SdkClientOptions,
): Birdcoder${namePart}SdkClient {
  const requester = createBirdcoderSdkOperationRequester({
    accessToken: options.accessToken,
    authToken: options.authToken,
    operationIndex: ${operationIndexName},
    surface: ${quoteTsString(plan.surface)},
    transport: options.transport,
  });

  return {
    clearSdkworkAuthTokens: requester.clearSdkworkAuthTokens,
    setSdkworkAuthTokens: requester.setSdkworkAuthTokens,
${apiAssignments}
  };
}
`;
}

function renderTypescriptIndexSource(plan) {
  const namePart = sdkNamePart(plan.surface);
  return `// Generated by ${GENERATED_BY} from ${normalizeRelativePath(plan.input)}. Do not edit by hand.

export { createBirdcoder${namePart}SdkClient } from './sdk.ts';
export type {
  Birdcoder${namePart}SdkClient,
  CreateBirdcoder${namePart}SdkClientOptions,
} from './sdk.ts';
export * from './sdk.ts';
export * from './api/index.ts';
export * from './types/index.ts';
export * from './http/index.ts';
`;
}

function renderTypescriptReadmeExamples(surface) {
  if (surface === 'app') {
    return [
      'client.auth.sessions.create(body);',
      'client.auth.sessions.current.retrieve();',
      'client.platform.workspaces.list(params);',
      'client.collaboration.workspaceTeams.list(params);',
    ].join('\n');
  }

  if (surface === 'backend') {
    return [
      'client.iam.auditEvents.list();',
      'client.iam.policies.list();',
      'client.iam.users.list();',
      'client.iam.roleBindings.create(body);',
      'client.iam.teams.list(params);',
      'client.iam.teams.members.list({ teamId });',
      'client.platform.releases.list(params);',
    ].join('\n');
  }

  throw new Error(`Unsupported SDK surface for README examples: ${surface}.`);
}

function renderRustReadmeExamples(surface) {
  if (surface === 'app') {
    return [
      'sdkwork_birdcoder_app_sdk::auth::sessions::CREATE',
      'sdkwork_birdcoder_app_sdk::auth::sessions::current::RETRIEVE',
      'sdkwork_birdcoder_app_sdk::platform::workspaces::LIST',
      'sdkwork_birdcoder_app_sdk::collaboration::workspace_teams::LIST',
    ].join('\n');
  }

  if (surface === 'backend') {
    return [
      'sdkwork_birdcoder_backend_sdk::iam::audit_events::LIST',
      'sdkwork_birdcoder_backend_sdk::iam::policies::LIST',
      'sdkwork_birdcoder_backend_sdk::iam::users::LIST',
      'sdkwork_birdcoder_backend_sdk::iam::role_bindings::CREATE',
      'sdkwork_birdcoder_backend_sdk::iam::teams::LIST',
      'sdkwork_birdcoder_backend_sdk::iam::teams::members::LIST',
      'sdkwork_birdcoder_backend_sdk::platform::releases::LIST',
    ].join('\n');
  }

  throw new Error(`Unsupported SDK surface for Rust README examples: ${surface}.`);
}

function generateTypescriptSources(plan, document, operations) {
  const tagGroups = groupOperationsByTag(operations);
  const openApiSchemas = document.components?.schemas ?? {};

  const packageJson = `${JSON.stringify({
    name: plan.packageName,
    version: '0.1.0',
    private: true,
    type: 'module',
    exports: {
      '.': './src/index.ts',
    },
    scripts: {
      typecheck: 'tsc -p tsconfig.json --noEmit',
    },
    sdkwork: {
      apiPrefix: plan.apiPrefix,
      generatedBy: GENERATED_BY,
      inputSpec: plan.input,
      standardProfile: STANDARD_PROFILE,
      surface: plan.surface,
    },
  }, null, 2)}\n`;

  const tsconfig = `${JSON.stringify({
    extends: '../../../tsconfig.json',
    compilerOptions: {
      allowImportingTsExtensions: true,
      noEmit: true,
      rootDir: 'src',
    },
    include: ['src/**/*.ts'],
  }, null, 2)}\n`;

  const readme = `# ${plan.packageName}

Generated BirdCoder ${plan.surface} SDK.

- Standard profile: \`${STANDARD_PROFILE}\`
- API prefix: \`${plan.apiPrefix}\`
- Input OpenAPI: \`${plan.input}\`
- Generated by: \`${GENERATED_BY}\`

Do not edit generated output by hand. Update the OpenAPI source or generator and regenerate.

Example TypeScript calls:

\`\`\`ts
${renderTypescriptReadmeExamples(plan.surface)}
\`\`\`
`;

  return new Map([
    ['package.json', packageJson],
    ['tsconfig.json', tsconfig],
    ['README.md', readme],
    [path.join('src', 'index.ts'), renderTypescriptIndexSource(plan)],
    [path.join('src', 'sdk.ts'), renderTypescriptSdkSource(plan, tagGroups)],
    [path.join('src', 'api', 'index.ts'), renderTypescriptApiIndexSource(plan, tagGroups)],
    [path.join('src', 'http', 'index.ts'), `// Generated by ${GENERATED_BY} from ${normalizeRelativePath(plan.input)}. Do not edit by hand.\n\nexport * from './client.ts';\n`],
    [path.join('src', 'http', 'client.ts'), renderTypescriptHttpSource(plan)],
    [path.join('src', 'types', 'index.ts'), renderTypescriptTypesSource(plan, document, operations)],
    ...tagGroups.map(([tag, tagOperations]) => [
      path.join('src', 'api', `${tagApiFileName(tag)}.ts`),
      renderTypescriptApiSource(plan, tag, tagOperations, openApiSchemas),
    ]),
  ]);
}

function renderRustTree(node, indent = 0) {
  const pad = ' '.repeat(indent);
  const chunks = [];
  for (const [name, child] of [...node.children.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const rustName = camelToSnake(name);
    if (child.method) {
      const operation = child.method;
      chunks.push([
        `${pad}pub const ${upperSnake(name)}: crate::SdkOperation = crate::SdkOperation {`,
        `${pad}    data_scope: ${quoteRustString(operation.dataScope)},`,
        `${pad}    deployment: ${quoteRustString(operation.deployment)},`,
        `${pad}    domain: ${quoteRustString(operation.domain)},`,
        `${pad}    key: ${quoteRustString(operation.key)},`,
        `${pad}    method: ${quoteRustString(operation.method)},`,
        `${pad}    operation_id: ${quoteRustString(operation.operationId)},`,
        `${pad}    path: ${quoteRustString(operation.path)},`,
        `${pad}    path_param_names: &[${operation.pathParamNames.map(quoteRustString).join(', ')}],`,
        `${pad}    permission: ${operation.permission ? `Some(${quoteRustString(operation.permission)})` : 'None'},`,
        `${pad}    public: ${operation.public ? 'true' : 'false'},`,
        `${pad}    resource: ${quoteRustString(operation.resource)},`,
        `${pad}    summary: ${quoteRustString(operation.summary)},`,
        `${pad}    tag: ${quoteRustString(operation.tag)},`,
        `${pad}    tenant_scope: ${quoteRustString(operation.tenantScope)},`,
        `${pad}};`,
      ].join('\n'));
      continue;
    }

    chunks.push([
      `${pad}pub mod ${rustName} {`,
      renderRustTree(child, indent + 4),
      `${pad}}`,
    ].join('\n'));
  }
  return chunks.join('\n\n');
}

function collectRustOperationPaths(node, prefix = []) {
  const paths = [];
  for (const [name, child] of [...node.children.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const rustName = child.method ? upperSnake(name) : camelToSnake(name);
    if (child.method) {
      paths.push([...prefix, rustName].join('::'));
      continue;
    }
    paths.push(...collectRustOperationPaths(child, [...prefix, rustName]));
  }
  return paths;
}

function generateRustSources(plan, operations) {
  const tree = buildOperationTree(operations);
  const moduleSource = renderRustTree(tree);
  const operationPaths = collectRustOperationPaths(tree);
  const source = `// Generated by ${GENERATED_BY} from ${normalizeRelativePath(plan.input)}. Do not edit by hand.

pub const SDKWORK_STANDARD_PROFILE: &str = ${quoteRustString(STANDARD_PROFILE)};
pub const API_PREFIX: &str = ${quoteRustString(plan.apiPrefix)};
pub const PACKAGE_NAME: &str = ${quoteRustString(plan.packageName)};
pub const AUTHORIZATION_HEADER: &str = "Authorization";
pub const SDKWORK_ACCESS_TOKEN_HEADER: &str = "Access-Token";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SdkOperation {
    pub data_scope: &'static str,
    pub deployment: &'static str,
    pub domain: &'static str,
    pub key: &'static str,
    pub method: &'static str,
    pub operation_id: &'static str,
    pub path: &'static str,
    pub path_param_names: &'static [&'static str],
    pub permission: Option<&'static str>,
    pub public: bool,
    pub resource: &'static str,
    pub summary: &'static str,
    pub tag: &'static str,
    pub tenant_scope: &'static str,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct SdkAuthTokens {
    pub access_token: Option<String>,
    pub auth_token: Option<String>,
}

${moduleSource}

pub const OPERATIONS: &[SdkOperation] = &[
${operationPaths.map((operationPath) => `    ${operationPath},`).join('\n')}
];
`;

  const cargoToml = `[package]
name = "${plan.crateName}"
version = "0.1.0"
edition = "2021"
publish = false

[lib]
path = "src/lib.rs"

[package.metadata.sdkwork]
generated-by = "${GENERATED_BY}"
input-spec = "${normalizeRelativePath(plan.input)}"
standard-profile = "${STANDARD_PROFILE}"
api-prefix = "${plan.apiPrefix}"
surface = "${plan.surface}"
`;

  const cargoLock = `# This file is automatically @generated by Cargo.
# It is not intended for manual editing.
version = 4

[[package]]
name = "${plan.crateName}"
version = "0.1.0"
`;

  const readme = `# ${plan.crateName}

Generated BirdCoder ${plan.surface} Rust SDK contract crate.

- Standard profile: \`${STANDARD_PROFILE}\`
- API prefix: \`${plan.apiPrefix}\`
- Input OpenAPI: \`${plan.input}\`
- Generated by: \`${GENERATED_BY}\`

Do not edit generated output by hand. Update the OpenAPI source or generator and regenerate.

Example Rust operation descriptors:

\`\`\`rust
${renderRustReadmeExamples(plan.surface)}
\`\`\`
`;

  return new Map([
    ['Cargo.lock', cargoLock],
    ['Cargo.toml', cargoToml],
    ['README.md', readme],
    [path.join('src', 'lib.rs'), source],
  ]);
}

function generateSurface(plan, { check = false, rootDir = process.cwd() } = {}) {
  const inputPath = toAbsolutePath(rootDir, plan.input);
  const document = readJsonFile(inputPath);
  const operations = collectOperations(document, plan);
  const mismatches = [];
  const typescriptOutputDir = toAbsolutePath(rootDir, plan.typescriptOutput);
  const rustOutputDir = toAbsolutePath(rootDir, plan.rustOutput);
  const typescriptSources = generateTypescriptSources(plan, document, operations);
  const rustSources = generateRustSources(plan, operations);

  for (const [relativePath, content] of typescriptSources) {
    writeTextFile(path.join(typescriptOutputDir, relativePath), content, {
      check,
      mismatches,
    });
  }
  removeStaleGeneratedFiles(typescriptOutputDir, typescriptSources.keys(), {
    check,
    mismatches,
  });

  for (const [relativePath, content] of rustSources) {
    writeTextFile(path.join(rustOutputDir, relativePath), content, {
      check,
      mismatches,
    });
  }
  removeStaleGeneratedFiles(rustOutputDir, rustSources.keys(), {
    check,
    mismatches,
  });

  if (mismatches.length > 0) {
    throw new Error(mismatches.join(os.EOL));
  }

  return {
    operationCount: operations.length,
    packageName: plan.packageName,
    surface: plan.surface,
  };
}

export function generateBirdcoderSdkFamily(options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const plans = resolvePlans(rootDir, options);
  if (plans.length === 0) {
    throw new Error(`No SDK surface matched${options.surface ? `: ${options.surface}` : '.'}`);
  }

  return plans.map((plan) => generateSurface(plan, {
    check: options.check === true,
    rootDir,
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = generateBirdcoderSdkFamily(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
