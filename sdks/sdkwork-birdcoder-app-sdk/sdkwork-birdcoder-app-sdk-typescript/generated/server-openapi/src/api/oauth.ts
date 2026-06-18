import { appApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderBooleanSuccessEnvelope, BirdCoderIamDeviceAuthorizationCreateRequest, BirdCoderIamDeviceAuthorizationEnvelope, BirdCoderIamDeviceAuthorizationPasswordCompletionRequest, BirdCoderIamDeviceAuthorizationScanRequest, BirdCoderIamOAuthAuthorizationCreateRequest, BirdCoderIamOAuthAuthorizationEnvelope, BirdCoderIamOAuthSessionCreateRequest, BirdCoderIamSessionEnvelope } from '../types';


export class OauthDeviceAuthorizationsPasswordCompletionsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Complete SDKWork IAM OAuth device authorization with password */
  async create(deviceAuthorizationId: string, body: BirdCoderIamDeviceAuthorizationPasswordCompletionRequest): Promise<BirdCoderIamSessionEnvelope> {
    return this.client.post<BirdCoderIamSessionEnvelope>(appApiPath(`/oauth/device_authorizations/${serializePathParameter(deviceAuthorizationId, { name: 'deviceAuthorizationId', style: 'simple', explode: false })}/password_completions`), body, undefined, undefined, 'application/json');
  }
}

export class OauthDeviceAuthorizationsScansApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Create SDKWork IAM OAuth device authorization scan */
  async create(deviceAuthorizationId: string, body?: BirdCoderIamDeviceAuthorizationScanRequest): Promise<BirdCoderBooleanSuccessEnvelope> {
    return this.client.post<BirdCoderBooleanSuccessEnvelope>(appApiPath(`/oauth/device_authorizations/${serializePathParameter(deviceAuthorizationId, { name: 'deviceAuthorizationId', style: 'simple', explode: false })}/scans`), body, undefined, undefined, 'application/json');
  }
}

export class OauthDeviceAuthorizationsApi {
  private client: HttpClient;
  public readonly scans: OauthDeviceAuthorizationsScansApi;
  public readonly passwordCompletions: OauthDeviceAuthorizationsPasswordCompletionsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.scans = new OauthDeviceAuthorizationsScansApi(client);
    this.passwordCompletions = new OauthDeviceAuthorizationsPasswordCompletionsApi(client);
  }


/** Create SDKWork IAM OAuth device authorization */
  async create(body: BirdCoderIamDeviceAuthorizationCreateRequest): Promise<BirdCoderIamDeviceAuthorizationEnvelope> {
    return this.client.post<BirdCoderIamDeviceAuthorizationEnvelope>(appApiPath(`/oauth/device_authorizations`), body, undefined, undefined, 'application/json');
  }

/** Get SDKWork IAM OAuth device authorization */
  async retrieve(deviceAuthorizationId: string): Promise<BirdCoderIamDeviceAuthorizationEnvelope> {
    return this.client.get<BirdCoderIamDeviceAuthorizationEnvelope>(appApiPath(`/oauth/device_authorizations/${serializePathParameter(deviceAuthorizationId, { name: 'deviceAuthorizationId', style: 'simple', explode: false })}`));
  }
}

export class OauthSessionsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Create SDKWork IAM session with OAuth authorization code */
  async create(body: BirdCoderIamOAuthSessionCreateRequest): Promise<BirdCoderIamSessionEnvelope> {
    return this.client.post<BirdCoderIamSessionEnvelope>(appApiPath(`/oauth/sessions`), body, undefined, undefined, 'application/json');
  }
}

export class OauthAuthorizationUrlsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Resolve OAuth authorization URL for SDKWork IAM sign-in */
  async create(body: BirdCoderIamOAuthAuthorizationCreateRequest): Promise<BirdCoderIamOAuthAuthorizationEnvelope> {
    return this.client.post<BirdCoderIamOAuthAuthorizationEnvelope>(appApiPath(`/oauth/authorization_urls`), body, undefined, undefined, 'application/json');
  }
}

export class OauthApi {
  private client: HttpClient;
  public readonly authorizationUrls: OauthAuthorizationUrlsApi;
  public readonly sessions: OauthSessionsApi;
  public readonly deviceAuthorizations: OauthDeviceAuthorizationsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.authorizationUrls = new OauthAuthorizationUrlsApi(client);
    this.sessions = new OauthSessionsApi(client);
    this.deviceAuthorizations = new OauthDeviceAuthorizationsApi(client);
  }

}

export function createOauthApi(client: HttpClient): OauthApi {
  return new OauthApi(client);
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
