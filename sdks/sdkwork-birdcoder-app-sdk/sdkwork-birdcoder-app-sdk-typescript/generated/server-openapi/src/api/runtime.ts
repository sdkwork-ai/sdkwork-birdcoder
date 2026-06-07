import { appApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderCodeEngineModelConfigEnvelope, BirdCoderCodeEngineModelConfigSyncResultEnvelope, BirdCoderEngineCapabilityMatrixEnvelope, BirdCoderEngineDescriptorListEnvelope, BirdCoderModelCatalogEntryListEnvelope, BirdCoderNativeSessionDetailEnvelope, BirdCoderNativeSessionProviderSummaryListEnvelope, BirdCoderNativeSessionSummaryListEnvelope, BirdCoderSyncCodeEngineModelConfigRequest } from '../types';


export class RuntimeModelsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List model catalog */
  async list(): Promise<BirdCoderModelCatalogEntryListEnvelope> {
    return this.client.get<BirdCoderModelCatalogEntryListEnvelope>(appApiPath(`/models`));
  }
}

export class RuntimeModelConfigApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get code engine model configuration */
  async retrieve(): Promise<BirdCoderCodeEngineModelConfigEnvelope> {
    return this.client.get<BirdCoderCodeEngineModelConfigEnvelope>(appApiPath(`/model_config`));
  }

/** Sync code engine model configuration */
  async sync(body: BirdCoderSyncCodeEngineModelConfigRequest): Promise<BirdCoderCodeEngineModelConfigSyncResultEnvelope> {
    return this.client.put<BirdCoderCodeEngineModelConfigSyncResultEnvelope>(appApiPath(`/model_config`), body, undefined, undefined, 'application/json');
  }
}

export class RuntimeNativeSessionProvidersApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List registered native engine session providers */
  async list(): Promise<BirdCoderNativeSessionProviderSummaryListEnvelope> {
    return this.client.get<BirdCoderNativeSessionProviderSummaryListEnvelope>(appApiPath(`/native_session_providers`));
  }
}

export interface RuntimeNativeSessionsRetrieveParams {
  workspaceId?: string;
  projectId?: string;
  engineId?: 'codex' | 'claude-code' | 'gemini' | 'opencode';
}

export interface RuntimeNativeSessionsListParams {
  workspaceId?: string;
  projectId?: string;
  engineId?: 'codex' | 'claude-code' | 'gemini' | 'opencode';
  limit?: number;
  offset?: number;
}

export class RuntimeNativeSessionsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get discovered native engine session detail */
  async retrieve(id: string, params?: RuntimeNativeSessionsRetrieveParams): Promise<BirdCoderNativeSessionDetailEnvelope> {
    const query = buildQueryString([
      { name: 'workspaceId', value: params?.workspaceId, style: 'form', explode: true, allowReserved: false },
      { name: 'projectId', value: params?.projectId, style: 'form', explode: true, allowReserved: false },
      { name: 'engineId', value: params?.engineId, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<BirdCoderNativeSessionDetailEnvelope>(appendQueryString(appApiPath(`/native_sessions/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}`), query));
  }

/** List discovered native engine sessions */
  async list(params?: RuntimeNativeSessionsListParams): Promise<BirdCoderNativeSessionSummaryListEnvelope> {
    const query = buildQueryString([
      { name: 'workspaceId', value: params?.workspaceId, style: 'form', explode: true, allowReserved: false },
      { name: 'projectId', value: params?.projectId, style: 'form', explode: true, allowReserved: false },
      { name: 'engineId', value: params?.engineId, style: 'form', explode: true, allowReserved: false },
      { name: 'limit', value: params?.limit, style: 'form', explode: true, allowReserved: false },
      { name: 'offset', value: params?.offset, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<BirdCoderNativeSessionSummaryListEnvelope>(appendQueryString(appApiPath(`/native_sessions`), query));
  }
}

export class RuntimeEnginesCapabilitiesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get runtime capabilities for one engine */
  async retrieve(engineKey: string): Promise<BirdCoderEngineCapabilityMatrixEnvelope> {
    return this.client.get<BirdCoderEngineCapabilityMatrixEnvelope>(appApiPath(`/engines/${serializePathParameter(engineKey, { name: 'engineKey', style: 'simple', explode: false })}/capabilities`));
  }
}

export class RuntimeEnginesApi {
  private client: HttpClient;
  public readonly capabilities: RuntimeEnginesCapabilitiesApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.capabilities = new RuntimeEnginesCapabilitiesApi(client);
  }


/** List available engines */
  async list(): Promise<BirdCoderEngineDescriptorListEnvelope> {
    return this.client.get<BirdCoderEngineDescriptorListEnvelope>(appApiPath(`/engines`));
  }
}

export class RuntimeApi {
  private client: HttpClient;
  public readonly engines: RuntimeEnginesApi;
  public readonly nativeSessions: RuntimeNativeSessionsApi;
  public readonly nativeSessionProviders: RuntimeNativeSessionProvidersApi;
  public readonly modelConfig: RuntimeModelConfigApi;
  public readonly models: RuntimeModelsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.engines = new RuntimeEnginesApi(client);
    this.nativeSessions = new RuntimeNativeSessionsApi(client);
    this.nativeSessionProviders = new RuntimeNativeSessionProvidersApi(client);
    this.modelConfig = new RuntimeModelConfigApi(client);
    this.models = new RuntimeModelsApi(client);
  }

}

export function createRuntimeApi(client: HttpClient): RuntimeApi {
  return new RuntimeApi(client);
}

function appendQueryString(path: string, rawQueryString: string): string {
  const query = rawQueryString.replace(/^\?+/, '');
  if (!query) {
    return path;
  }
  return path.includes('?') ? `${path}&${query}` : `${path}?${query}`;
}

interface PathParameterSpec {
  name: string;
  style: string;
  explode: boolean;
}

function serializePathParameter(value: unknown, spec: PathParameterSpec): string {
  if (value === undefined || value === null) {
    return '';
  }

  const style = spec.style || 'simple';
  if (Array.isArray(value)) {
    return serializePathArray(spec.name, value, style, spec.explode);
  }
  if (typeof value === 'object') {
    return serializePathObject(spec.name, value as Record<string, unknown>, style, spec.explode);
  }
  return pathPrefix(spec.name, style, false) + encodePathValue(serializePathPrimitive(value));
}

function serializePathArray(name: string, values: unknown[], style: string, explode: boolean): string {
  const serialized = values
    .filter((item) => item !== undefined && item !== null)
    .map((item) => encodePathValue(serializePathPrimitive(item)));
  if (serialized.length === 0) {
    return pathPrefix(name, style, false);
  }
  if (style === 'matrix') {
    return explode
      ? serialized.map((item) => `;${name}=${item}`).join('')
      : `;${name}=${serialized.join(',')}`;
  }
  return pathPrefix(name, style, false) + serialized.join(explode ? '.' : ',');
}

function serializePathObject(name: string, value: Record<string, unknown>, style: string, explode: boolean): string {
  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null);
  if (entries.length === 0) {
    return pathPrefix(name, style, true);
  }
  if (style === 'matrix') {
    return explode
      ? entries.map(([key, entryValue]) => `;${encodePathValue(key)}=${encodePathValue(serializePathPrimitive(entryValue))}`).join('')
      : `;${name}=${entries.flatMap(([key, entryValue]) => [encodePathValue(key), encodePathValue(serializePathPrimitive(entryValue))]).join(',')}`;
  }
  const serialized = explode
    ? entries.map(([key, entryValue]) => `${encodePathValue(key)}=${encodePathValue(serializePathPrimitive(entryValue))}`).join(style === 'label' ? '.' : ',')
    : entries.flatMap(([key, entryValue]) => [encodePathValue(key), encodePathValue(serializePathPrimitive(entryValue))]).join(',');
  return pathPrefix(name, style, true) + serialized;
}

function pathPrefix(name: string, style: string, _objectValue: boolean): string {
  if (style === 'label') return '.';
  if (style === 'matrix') return `;${name}`;
  return '';
}

function encodePathValue(value: string): string {
  return encodeURIComponent(value);
}

function serializePathPrimitive(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
interface QueryParameterSpec {
  name: string;
  value: unknown;
  style: string;
  explode: boolean;
  allowReserved: boolean;
  contentType?: string;
}

function buildQueryString(parameters: QueryParameterSpec[]): string {
  const pairs: string[] = [];
  for (const parameter of parameters) {
    appendSerializedParameter(pairs, parameter);
  }
  return pairs.join('&');
}

function appendSerializedParameter(pairs: string[], parameter: QueryParameterSpec): void {
  if (parameter.value === undefined || parameter.value === null) {
    return;
  }

  if (parameter.contentType) {
    pairs.push(`${encodeQueryComponent(parameter.name)}=${encodeQueryValue(JSON.stringify(parameter.value), parameter.allowReserved)}`);
    return;
  }

  const style = parameter.style || 'form';
  if (style === 'deepObject') {
    appendDeepObjectParameter(pairs, parameter.name, parameter.value, parameter.allowReserved);
    return;
  }

  if (Array.isArray(parameter.value)) {
    appendArrayParameter(pairs, parameter.name, parameter.value, style, parameter.explode, parameter.allowReserved);
    return;
  }

  if (typeof parameter.value === 'object') {
    appendObjectParameter(pairs, parameter.name, parameter.value as Record<string, unknown>, style, parameter.explode, parameter.allowReserved);
    return;
  }

  pairs.push(`${encodeQueryComponent(parameter.name)}=${encodeQueryValue(serializePrimitive(parameter.value), parameter.allowReserved)}`);
}

function appendArrayParameter(
  pairs: string[],
  name: string,
  value: unknown[],
  style: string,
  explode: boolean,
  allowReserved: boolean,
): void {
  const values = value
    .filter((item) => item !== undefined && item !== null)
    .map((item) => serializePrimitive(item));
  if (values.length === 0) {
    return;
  }

  if (style === 'form' && explode) {
    for (const item of values) {
      pairs.push(`${encodeQueryComponent(name)}=${encodeQueryValue(item, allowReserved)}`);
    }
    return;
  }

  pairs.push(`${encodeQueryComponent(name)}=${encodeQueryValue(values.join(','), allowReserved)}`);
}

function appendObjectParameter(
  pairs: string[],
  name: string,
  value: Record<string, unknown>,
  style: string,
  explode: boolean,
  allowReserved: boolean,
): void {
  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null);
  if (entries.length === 0) {
    return;
  }

  if (style === 'form' && explode) {
    for (const [key, entryValue] of entries) {
      pairs.push(`${encodeQueryComponent(key)}=${encodeQueryValue(serializePrimitive(entryValue), allowReserved)}`);
    }
    return;
  }

  const serialized = entries.flatMap(([key, entryValue]) => [key, serializePrimitive(entryValue)]).join(',');
  pairs.push(`${encodeQueryComponent(name)}=${encodeQueryValue(serialized, allowReserved)}`);
}

function appendDeepObjectParameter(
  pairs: string[],
  name: string,
  value: unknown,
  allowReserved: boolean,
): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    pairs.push(`${encodeQueryComponent(name)}=${encodeQueryValue(serializePrimitive(value), allowReserved)}`);
    return;
  }

  for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
    if (entryValue === undefined || entryValue === null) {
      continue;
    }
    pairs.push(`${encodeQueryComponent(`${name}[${key}]`)}=${encodeQueryValue(serializePrimitive(entryValue), allowReserved)}`);
  }
}

function serializePrimitive(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function encodeQueryComponent(value: string): string {
  return encodeURIComponent(value);
}

function encodeQueryValue(value: string, allowReserved: boolean): string {
  const encoded = encodeURIComponent(value);
  if (!allowReserved) {
    return encoded;
  }
  return encoded.replace(/%3A/gi, ':')
    .replace(/%2F/gi, '/')
    .replace(/%3F/gi, '?')
    .replace(/%23/gi, '#')
    .replace(/%5B/gi, '[')
    .replace(/%5D/gi, ']')
    .replace(/%40/gi, '@')
    .replace(/%21/gi, '!')
    .replace(/%24/gi, '$')
    .replace(/%26/gi, '&')
    .replace(/%27/gi, "'")
    .replace(/%28/gi, '(')
    .replace(/%29/gi, ')')
    .replace(/%2A/gi, '*')
    .replace(/%2B/gi, '+')
    .replace(/%2C/gi, ',')
    .replace(/%3B/gi, ';')
    .replace(/%3D/gi, '=');
}
