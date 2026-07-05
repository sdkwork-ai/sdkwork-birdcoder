import { appApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderApiRouteCatalogEntry, BirdCoderChatConversationSummary, BirdCoderChatMessageSummary, BirdCoderCodingServerDescriptor, BirdCoderCoreHealthSummary, BirdCoderCoreRuntimeSummary, BirdCoderCreateChatConversationRequest, BirdCoderCreateChatMessageRequest, BirdCoderDeleteChatConversationResult, BirdCoderIamRuntimeSettingsSummary, BirdCoderIamVerificationPolicySummary, BirdCoderOperationDescriptor, PageInfo } from '../types';


export class SystemChatConversationsMessagesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List chat messages */
  async list(conversationId: string): Promise<Record<string, unknown>> {
    return this.client.get<Record<string, unknown>>(appApiPath(`/chat/conversations/${serializePathParameter(conversationId, { name: 'conversationId', style: 'simple', explode: false })}/messages`));
  }

/** Create chat message */
  async create(conversationId: string, body: BirdCoderCreateChatMessageRequest): Promise<BirdCoderChatMessageSummary> {
    return this.client.post<BirdCoderChatMessageSummary>(appApiPath(`/chat/conversations/${serializePathParameter(conversationId, { name: 'conversationId', style: 'simple', explode: false })}/messages`), body, undefined, undefined, 'application/json');
  }
}

export class SystemChatConversationsApi {
  private client: HttpClient;
  public readonly messages: SystemChatConversationsMessagesApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.messages = new SystemChatConversationsMessagesApi(client);
  }


/** List chat conversations */
  async list(): Promise<Record<string, unknown>> {
    return this.client.get<Record<string, unknown>>(appApiPath(`/chat/conversations`));
  }

/** Create chat conversation */
  async create(body: BirdCoderCreateChatConversationRequest): Promise<BirdCoderChatConversationSummary> {
    return this.client.post<BirdCoderChatConversationSummary>(appApiPath(`/chat/conversations`), body, undefined, undefined, 'application/json');
  }

/** Get chat conversation */
  async retrieve(conversationId: string): Promise<BirdCoderChatConversationSummary> {
    return this.client.get<BirdCoderChatConversationSummary>(appApiPath(`/chat/conversations/${serializePathParameter(conversationId, { name: 'conversationId', style: 'simple', explode: false })}`));
  }

/** Delete chat conversation */
  async delete(conversationId: string): Promise<BirdCoderDeleteChatConversationResult> {
    return this.client.delete<BirdCoderDeleteChatConversationResult>(appApiPath(`/chat/conversations/${serializePathParameter(conversationId, { name: 'conversationId', style: 'simple', explode: false })}`));
  }
}

export class SystemChatApi {
  private client: HttpClient;
  public readonly conversations: SystemChatConversationsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.conversations = new SystemChatConversationsApi(client);
  }

}

export class SystemIamVerificationPolicyApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get SDKWork IAM verification policy */
  async retrieve(): Promise<BirdCoderIamVerificationPolicySummary> {
    return this.client.get<BirdCoderIamVerificationPolicySummary>(appApiPath(`/system/iam/verification_policy`));
  }
}

export class SystemIamRuntimeApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get SDKWork IAM runtime metadata */
  async retrieve(): Promise<BirdCoderIamRuntimeSettingsSummary> {
    return this.client.get<BirdCoderIamRuntimeSettingsSummary>(appApiPath(`/system/iam/runtime`));
  }
}

export class SystemIamApi {
  private client: HttpClient;
  public readonly runtime: SystemIamRuntimeApi;
  public readonly verificationPolicy: SystemIamVerificationPolicyApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.runtime = new SystemIamRuntimeApi(client);
    this.verificationPolicy = new SystemIamVerificationPolicyApi(client);
  }

}

export class SystemRuntimeApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get runtime metadata */
  async retrieve(): Promise<BirdCoderCoreRuntimeSummary> {
    return this.client.get<BirdCoderCoreRuntimeSummary>(appApiPath(`/system/runtime`));
  }
}

export class SystemRoutesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List unified API routes */
  async list(): Promise<Record<string, unknown>> {
    return this.client.get<Record<string, unknown>>(appApiPath(`/system/routes`));
  }
}

export class SystemOperationsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get operation status */
  async retrieve(operationId: string): Promise<BirdCoderOperationDescriptor> {
    return this.client.get<BirdCoderOperationDescriptor>(appApiPath(`/operations/${serializePathParameter(operationId, { name: 'operationId', style: 'simple', explode: false })}`));
  }
}

export class SystemHealthApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get coding-server health */
  async retrieve(): Promise<BirdCoderCoreHealthSummary> {
    return this.client.get<BirdCoderCoreHealthSummary>(appApiPath(`/system/health`));
  }
}

export class SystemDescriptorApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get coding-server descriptor */
  async retrieve(): Promise<BirdCoderCodingServerDescriptor> {
    return this.client.get<BirdCoderCodingServerDescriptor>(appApiPath(`/system/descriptor`));
  }
}

export class SystemApi {
  private client: HttpClient;
  public readonly descriptor: SystemDescriptorApi;
  public readonly health: SystemHealthApi;
  public readonly operations: SystemOperationsApi;
  public readonly routes: SystemRoutesApi;
  public readonly runtime: SystemRuntimeApi;
  public readonly iam: SystemIamApi;
  public readonly chat: SystemChatApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.descriptor = new SystemDescriptorApi(client);
    this.health = new SystemHealthApi(client);
    this.operations = new SystemOperationsApi(client);
    this.routes = new SystemRoutesApi(client);
    this.runtime = new SystemRuntimeApi(client);
    this.iam = new SystemIamApi(client);
    this.chat = new SystemChatApi(client);
  }

}

export function createSystemApi(client: HttpClient): SystemApi {
  return new SystemApi(client);
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
