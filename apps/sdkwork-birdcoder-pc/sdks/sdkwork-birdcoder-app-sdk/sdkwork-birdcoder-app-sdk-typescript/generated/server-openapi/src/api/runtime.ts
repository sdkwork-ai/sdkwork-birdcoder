import { appApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderCodeEngineModelConfig, BirdCoderCodeEngineModelConfigSyncResult, BirdCoderEngineCapabilityMatrix, BirdCoderEngineDescriptor, BirdCoderModelCatalogEntry, BirdCoderNativeSessionProviderSummary, BirdCoderSyncCodeEngineModelConfigRequest, PageInfo } from '../types';


export class RuntimeModelsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List model catalog */
  async list(): Promise<Record<string, unknown>> {
    return this.client.get<Record<string, unknown>>(appApiPath(`/models`));
  }
}

export class RuntimeModelConfigApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get code engine model configuration */
  async retrieve(): Promise<BirdCoderCodeEngineModelConfig> {
    return this.client.get<BirdCoderCodeEngineModelConfig>(appApiPath(`/model_config`));
  }

/** Sync code engine model configuration */
  async update(body: BirdCoderSyncCodeEngineModelConfigRequest): Promise<BirdCoderCodeEngineModelConfigSyncResult> {
    return this.client.put<BirdCoderCodeEngineModelConfigSyncResult>(appApiPath(`/model_config`), body, undefined, undefined, 'application/json');
  }
}

export class RuntimeNativeSessionProvidersApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List registered native engine session providers */
  async list(): Promise<Record<string, unknown>> {
    return this.client.get<Record<string, unknown>>(appApiPath(`/native_session_providers`));
  }
}

export class RuntimeEnginesCapabilitiesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get runtime capabilities for one engine */
  async retrieve(engineKey: string): Promise<BirdCoderEngineCapabilityMatrix> {
    return this.client.get<BirdCoderEngineCapabilityMatrix>(appApiPath(`/engines/${serializePathParameter(engineKey, { name: 'engineKey', style: 'simple', explode: false })}/capabilities`));
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
  async list(): Promise<Record<string, unknown>> {
    return this.client.get<Record<string, unknown>>(appApiPath(`/engines`));
  }
}

export class RuntimeApi {
  private client: HttpClient;
  public readonly engines: RuntimeEnginesApi;
  public readonly nativeSessionProviders: RuntimeNativeSessionProvidersApi;
  public readonly modelConfig: RuntimeModelConfigApi;
  public readonly models: RuntimeModelsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.engines = new RuntimeEnginesApi(client);
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
