import { appApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderCommerceInvoiceSummary, BirdCoderCommerceMembershipCurrentSummary, BirdCoderCommerceMembershipPackageGroupSummary, BirdCoderCommerceOrderSummary, BirdCoderCommercePaymentSummary, BirdCoderConfirmCommercePaymentRequest, BirdCoderCreateCommerceOrderRequest, BirdCoderCreateCommercePaymentRequest, PageInfo } from '../types';


export interface CommercePaymentsListParams {
  limit?: number;
  offset?: number;
}

export class CommercePaymentsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List SDKWork commerce payments */
  async list(params?: CommercePaymentsListParams): Promise<Record<string, unknown>> {
    const query = buildQueryString([
      { name: 'limit', value: params?.limit, style: 'form', explode: true, allowReserved: false },
      { name: 'offset', value: params?.offset, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<Record<string, unknown>>(appendQueryString(appApiPath(`/commerce/payments`), query));
  }

/** Create SDKWork commerce payment */
  async create(body: BirdCoderCreateCommercePaymentRequest): Promise<BirdCoderCommercePaymentSummary> {
    return this.client.post<BirdCoderCommercePaymentSummary>(appApiPath(`/commerce/payments`), body, undefined, undefined, 'application/json');
  }

/** Get SDKWork commerce payment */
  async retrieve(paymentId: string): Promise<BirdCoderCommercePaymentSummary> {
    return this.client.get<BirdCoderCommercePaymentSummary>(appApiPath(`/commerce/payments/${serializePathParameter(paymentId, { name: 'paymentId', style: 'simple', explode: false })}`));
  }

/** Confirm SDKWork commerce payment after gateway callback */
  async confirm(paymentId: string, body: BirdCoderConfirmCommercePaymentRequest): Promise<BirdCoderCommercePaymentSummary> {
    return this.client.post<BirdCoderCommercePaymentSummary>(appApiPath(`/commerce/payments/${serializePathParameter(paymentId, { name: 'paymentId', style: 'simple', explode: false })}/confirm`), body, undefined, undefined, 'application/json');
  }
}

export interface CommerceInvoicesListParams {
  limit?: number;
  offset?: number;
}

export class CommerceInvoicesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List SDKWork commerce invoices */
  async list(params?: CommerceInvoicesListParams): Promise<Record<string, unknown>> {
    const query = buildQueryString([
      { name: 'limit', value: params?.limit, style: 'form', explode: true, allowReserved: false },
      { name: 'offset', value: params?.offset, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<Record<string, unknown>>(appendQueryString(appApiPath(`/commerce/invoices`), query));
  }

/** Get SDKWork commerce invoice */
  async retrieve(invoiceId: string): Promise<BirdCoderCommerceInvoiceSummary> {
    return this.client.get<BirdCoderCommerceInvoiceSummary>(appApiPath(`/commerce/invoices/${serializePathParameter(invoiceId, { name: 'invoiceId', style: 'simple', explode: false })}`));
  }
}

export interface CommerceOrdersListParams {
  limit?: number;
  offset?: number;
}

export class CommerceOrdersApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List SDKWork commerce orders */
  async list(params?: CommerceOrdersListParams): Promise<Record<string, unknown>> {
    const query = buildQueryString([
      { name: 'limit', value: params?.limit, style: 'form', explode: true, allowReserved: false },
      { name: 'offset', value: params?.offset, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<Record<string, unknown>>(appendQueryString(appApiPath(`/commerce/orders`), query));
  }

/** Create SDKWork commerce order */
  async create(body: BirdCoderCreateCommerceOrderRequest): Promise<BirdCoderCommerceOrderSummary> {
    return this.client.post<BirdCoderCommerceOrderSummary>(appApiPath(`/commerce/orders`), body, undefined, undefined, 'application/json');
  }

/** Get SDKWork commerce order */
  async retrieve(orderId: string): Promise<BirdCoderCommerceOrderSummary> {
    return this.client.get<BirdCoderCommerceOrderSummary>(appApiPath(`/commerce/orders/${serializePathParameter(orderId, { name: 'orderId', style: 'simple', explode: false })}`));
  }
}

export class CommerceMembershipsPackageGroupsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List SDKWork commerce membership package groups */
  async list(): Promise<Record<string, unknown>> {
    return this.client.get<Record<string, unknown>>(appApiPath(`/memberships/package_groups`));
  }
}

export class CommerceMembershipsCurrentApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get current SDKWork commerce membership */
  async retrieve(): Promise<BirdCoderCommerceMembershipCurrentSummary> {
    return this.client.get<BirdCoderCommerceMembershipCurrentSummary>(appApiPath(`/memberships/current`));
  }
}

export class CommerceMembershipsApi {
  private client: HttpClient;
  public readonly current: CommerceMembershipsCurrentApi;
  public readonly packageGroups: CommerceMembershipsPackageGroupsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.current = new CommerceMembershipsCurrentApi(client);
    this.packageGroups = new CommerceMembershipsPackageGroupsApi(client);
  }

}

export class CommerceApi {
  private client: HttpClient;
  public readonly memberships: CommerceMembershipsApi;
  public readonly orders: CommerceOrdersApi;
  public readonly invoices: CommerceInvoicesApi;
  public readonly payments: CommercePaymentsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.memberships = new CommerceMembershipsApi(client);
    this.orders = new CommerceOrdersApi(client);
    this.invoices = new CommerceInvoicesApi(client);
    this.payments = new CommercePaymentsApi(client);
  }

}

export function createCommerceApi(client: HttpClient): CommerceApi {
  return new CommerceApi(client);
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
