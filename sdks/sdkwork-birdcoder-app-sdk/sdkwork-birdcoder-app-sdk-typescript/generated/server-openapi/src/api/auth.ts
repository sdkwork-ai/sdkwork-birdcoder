import { appApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderBooleanSuccessEnvelope, BirdCoderIamCreateSessionRequest, BirdCoderIamOAuthAuthorizationEnvelope, BirdCoderIamOAuthSessionCreateRequest, BirdCoderIamPasswordResetCreateRequest, BirdCoderIamPasswordResetRequestCreateRequest, BirdCoderIamRefreshSessionRequest, BirdCoderIamRegistrationCreateRequest, BirdCoderIamSessionEnvelope, BirdCoderIamUpdateCurrentSessionRequest } from '../types';


export class AuthSessionsCurrentApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get current SDKWork IAM session */
  async retrieve(): Promise<BirdCoderIamSessionEnvelope> {
    return this.client.get<BirdCoderIamSessionEnvelope>(appApiPath(`/auth/sessions/current`));
  }

/** Update current SDKWork IAM session */
  async update(body?: BirdCoderIamUpdateCurrentSessionRequest): Promise<BirdCoderIamSessionEnvelope> {
    return this.client.patch<BirdCoderIamSessionEnvelope>(appApiPath(`/auth/sessions/current`), body, undefined, undefined, 'application/json');
  }

/** Delete current SDKWork IAM session */
  async delete(): Promise<BirdCoderBooleanSuccessEnvelope> {
    return this.client.delete<BirdCoderBooleanSuccessEnvelope>(appApiPath(`/auth/sessions/current`));
  }
}

export class AuthSessionsApi {
  private client: HttpClient;
  public readonly current: AuthSessionsCurrentApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.current = new AuthSessionsCurrentApi(client);
  }


/** Create SDKWork IAM session */
  async create(body: BirdCoderIamCreateSessionRequest): Promise<BirdCoderIamSessionEnvelope> {
    return this.client.post<BirdCoderIamSessionEnvelope>(appApiPath(`/auth/sessions`), body, undefined, undefined, 'application/json');
  }

/** Refresh SDKWork IAM session */
  async refresh(body: BirdCoderIamRefreshSessionRequest): Promise<BirdCoderIamSessionEnvelope> {
    return this.client.post<BirdCoderIamSessionEnvelope>(appApiPath(`/auth/sessions/refresh`), body, undefined, undefined, 'application/json');
  }
}

export class AuthRegistrationsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Register SDKWork IAM user */
  async create(body: BirdCoderIamRegistrationCreateRequest): Promise<BirdCoderIamSessionEnvelope> {
    return this.client.post<BirdCoderIamSessionEnvelope>(appApiPath(`/auth/registrations`), body, undefined, undefined, 'application/json');
  }
}

export class AuthPasswordResetsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Reset SDKWork IAM password */
  async create(body: BirdCoderIamPasswordResetCreateRequest): Promise<BirdCoderBooleanSuccessEnvelope> {
    return this.client.post<BirdCoderBooleanSuccessEnvelope>(appApiPath(`/auth/password_resets`), body, undefined, undefined, 'application/json');
  }
}

export class AuthPasswordResetRequestsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Create SDKWork IAM password reset request */
  async create(body: BirdCoderIamPasswordResetRequestCreateRequest): Promise<BirdCoderBooleanSuccessEnvelope> {
    return this.client.post<BirdCoderBooleanSuccessEnvelope>(appApiPath(`/auth/password_reset_requests`), body, undefined, undefined, 'application/json');
  }
}

export class AuthOauthSessionsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Create SDKWork IAM session with OAuth authorization code */
  async create(body: BirdCoderIamOAuthSessionCreateRequest): Promise<BirdCoderIamSessionEnvelope> {
    return this.client.post<BirdCoderIamSessionEnvelope>(appApiPath(`/auth/oauth_sessions`), body, undefined, undefined, 'application/json');
  }
}

export interface AuthOauthAuthorizationUrlsRetrieveParams {
  provider: string;
  redirectUri: string;
  scope?: string;
  state?: string;
}

export class AuthOauthAuthorizationUrlsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Resolve OAuth authorization URL for SDKWork IAM sign-in */
  async retrieve(params: AuthOauthAuthorizationUrlsRetrieveParams): Promise<BirdCoderIamOAuthAuthorizationEnvelope> {
    const query = buildQueryString([
      { name: 'provider', value: params.provider, style: 'form', explode: true, allowReserved: false },
      { name: 'redirectUri', value: params.redirectUri, style: 'form', explode: true, allowReserved: false },
      { name: 'scope', value: params.scope, style: 'form', explode: true, allowReserved: false },
      { name: 'state', value: params.state, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<BirdCoderIamOAuthAuthorizationEnvelope>(appendQueryString(appApiPath(`/auth/oauth_authorization_urls`), query));
  }
}

export class AuthApi {
  private client: HttpClient;
  public readonly oauthAuthorizationUrls: AuthOauthAuthorizationUrlsApi;
  public readonly oauthSessions: AuthOauthSessionsApi;
  public readonly passwordResetRequests: AuthPasswordResetRequestsApi;
  public readonly passwordResets: AuthPasswordResetsApi;
  public readonly registrations: AuthRegistrationsApi;
  public readonly sessions: AuthSessionsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.oauthAuthorizationUrls = new AuthOauthAuthorizationUrlsApi(client);
    this.oauthSessions = new AuthOauthSessionsApi(client);
    this.passwordResetRequests = new AuthPasswordResetRequestsApi(client);
    this.passwordResets = new AuthPasswordResetsApi(client);
    this.registrations = new AuthRegistrationsApi(client);
    this.sessions = new AuthSessionsApi(client);
  }

}

export function createAuthApi(client: HttpClient): AuthApi {
  return new AuthApi(client);
}

function appendQueryString(path: string, rawQueryString: string): string {
  const query = rawQueryString.replace(/^\?+/, '');
  if (!query) {
    return path;
  }
  return path.includes('?') ? `${path}&${query}` : `${path}?${query}`;
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
