import { appApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderBooleanSuccessEnvelope, BirdCoderIamQrAuthSessionCreateRequest, BirdCoderIamQrAuthSessionEnvelope, BirdCoderIamQrAuthSessionPasswordRequest, BirdCoderIamQrAuthSessionScanRequest, BirdCoderIamSessionEnvelope } from '../types';


export class OpenPlatformQrAuthSessionsPasswordsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Complete SDKWork IAM QR auth session with password */
  async create(sessionKey: string, body: BirdCoderIamQrAuthSessionPasswordRequest): Promise<BirdCoderIamSessionEnvelope> {
    return this.client.post<BirdCoderIamSessionEnvelope>(appApiPath(`/open_platform/qr_auth/sessions/${serializePathParameter(sessionKey, { name: 'sessionKey', style: 'simple', explode: false })}/passwords`), body, undefined, undefined, 'application/json');
  }
}

export class OpenPlatformQrAuthSessionsScansApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Create SDKWork IAM QR auth scan */
  async create(sessionKey: string, body?: BirdCoderIamQrAuthSessionScanRequest): Promise<BirdCoderBooleanSuccessEnvelope> {
    return this.client.post<BirdCoderBooleanSuccessEnvelope>(appApiPath(`/open_platform/qr_auth/sessions/${serializePathParameter(sessionKey, { name: 'sessionKey', style: 'simple', explode: false })}/scans`), body, undefined, undefined, 'application/json');
  }
}

export class OpenPlatformQrAuthSessionsApi {
  private client: HttpClient;
  public readonly scans: OpenPlatformQrAuthSessionsScansApi;
  public readonly passwords: OpenPlatformQrAuthSessionsPasswordsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.scans = new OpenPlatformQrAuthSessionsScansApi(client);
    this.passwords = new OpenPlatformQrAuthSessionsPasswordsApi(client);
  }


/** Create SDKWork IAM QR auth session */
  async create(body: BirdCoderIamQrAuthSessionCreateRequest): Promise<BirdCoderIamQrAuthSessionEnvelope> {
    return this.client.post<BirdCoderIamQrAuthSessionEnvelope>(appApiPath(`/open_platform/qr_auth/sessions`), body, undefined, undefined, 'application/json');
  }

/** Get SDKWork IAM QR auth session */
  async retrieve(sessionKey: string): Promise<BirdCoderIamQrAuthSessionEnvelope> {
    return this.client.get<BirdCoderIamQrAuthSessionEnvelope>(appApiPath(`/open_platform/qr_auth/sessions/${serializePathParameter(sessionKey, { name: 'sessionKey', style: 'simple', explode: false })}`));
  }
}

export class OpenPlatformQrAuthApi {
  private client: HttpClient;
  public readonly sessions: OpenPlatformQrAuthSessionsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.sessions = new OpenPlatformQrAuthSessionsApi(client);
  }

}

export class OpenPlatformApi {
  private client: HttpClient;
  public readonly qrAuth: OpenPlatformQrAuthApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.qrAuth = new OpenPlatformQrAuthApi(client);
  }

}

export function createOpenPlatformApi(client: HttpClient): OpenPlatformApi {
  return new OpenPlatformApi(client);
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
