import { appApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderApprovalDecisionResult, BirdCoderCodingSessionArtifact, BirdCoderCodingSessionCheckpoint, BirdCoderCodingSessionEvent, BirdCoderCodingSessionSummary, BirdCoderCodingSessionTurn, BirdCoderCreateCodingSessionRequest, BirdCoderCreateCodingSessionTurnRequest, BirdCoderEditCodingSessionMessageRequest, BirdCoderEditCodingSessionMessageResult, BirdCoderForkCodingSessionRequest, BirdCoderSubmitApprovalDecisionRequest, BirdCoderSubmitUserQuestionAnswerRequest, BirdCoderUpdateCodingSessionRequest, BirdCoderUserQuestionAnswerResult, PageInfo } from '../types';


export class IntelligenceCodingSessionsMessagesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Edit coding session message */
  async update(sessionId: string, messageId: string, body: BirdCoderEditCodingSessionMessageRequest): Promise<BirdCoderEditCodingSessionMessageResult> {
    return this.client.patch<BirdCoderEditCodingSessionMessageResult>(appApiPath(`/intelligence/coding_sessions/${serializePathParameter(sessionId, { name: 'sessionId', style: 'simple', explode: false })}/messages/${serializePathParameter(messageId, { name: 'messageId', style: 'simple', explode: false })}`), body, undefined, undefined, 'application/json');
  }

/** Delete coding session message */
  async delete(sessionId: string, messageId: string): Promise<void> {
    return this.client.delete<void>(appApiPath(`/intelligence/coding_sessions/${serializePathParameter(sessionId, { name: 'sessionId', style: 'simple', explode: false })}/messages/${serializePathParameter(messageId, { name: 'messageId', style: 'simple', explode: false })}`));
  }
}

export class IntelligenceCodingSessionsTurnsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Create coding session turn */
  async create(sessionId: string, body: BirdCoderCreateCodingSessionTurnRequest): Promise<BirdCoderCodingSessionTurn> {
    return this.client.post<BirdCoderCodingSessionTurn>(appApiPath(`/intelligence/coding_sessions/${serializePathParameter(sessionId, { name: 'sessionId', style: 'simple', explode: false })}/turns`), body, undefined, undefined, 'application/json');
  }
}

export class IntelligenceCodingSessionsArtifactsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List coding session artifacts */
  async list(sessionId: string): Promise<Record<string, unknown>> {
    return this.client.get<Record<string, unknown>>(appApiPath(`/intelligence/coding_sessions/${serializePathParameter(sessionId, { name: 'sessionId', style: 'simple', explode: false })}/artifacts`));
  }
}

export class IntelligenceCodingSessionsQuestionsAnswersApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Submit user-question answer */
  async create(sessionId: string, questionId: string, body: BirdCoderSubmitUserQuestionAnswerRequest): Promise<BirdCoderUserQuestionAnswerResult> {
    return this.client.post<BirdCoderUserQuestionAnswerResult>(appApiPath(`/intelligence/coding_sessions/${serializePathParameter(sessionId, { name: 'sessionId', style: 'simple', explode: false })}/questions/${serializePathParameter(questionId, { name: 'questionId', style: 'simple', explode: false })}/answer`), body, undefined, undefined, 'application/json');
  }
}

export class IntelligenceCodingSessionsQuestionsApi {
  private client: HttpClient;
  public readonly answers: IntelligenceCodingSessionsQuestionsAnswersApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.answers = new IntelligenceCodingSessionsQuestionsAnswersApi(client);
  }

}

export class IntelligenceCodingSessionsCheckpointsApprovalApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Submit approval decision */
  async create(sessionId: string, checkpointId: string, body: BirdCoderSubmitApprovalDecisionRequest): Promise<BirdCoderApprovalDecisionResult> {
    return this.client.post<BirdCoderApprovalDecisionResult>(appApiPath(`/intelligence/coding_sessions/${serializePathParameter(sessionId, { name: 'sessionId', style: 'simple', explode: false })}/checkpoints/${serializePathParameter(checkpointId, { name: 'checkpointId', style: 'simple', explode: false })}/approval`), body, undefined, undefined, 'application/json');
  }
}

export class IntelligenceCodingSessionsCheckpointsApi {
  private client: HttpClient;
  public readonly approval: IntelligenceCodingSessionsCheckpointsApprovalApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.approval = new IntelligenceCodingSessionsCheckpointsApprovalApi(client);
  }


/** List coding session checkpoints */
  async list(sessionId: string): Promise<Record<string, unknown>> {
    return this.client.get<Record<string, unknown>>(appApiPath(`/intelligence/coding_sessions/${serializePathParameter(sessionId, { name: 'sessionId', style: 'simple', explode: false })}/checkpoints`));
  }
}

export class IntelligenceCodingSessionsEventsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Replay or subscribe to coding session events */
  async list(sessionId: string): Promise<Record<string, unknown>> {
    return this.client.get<Record<string, unknown>>(appApiPath(`/intelligence/coding_sessions/${serializePathParameter(sessionId, { name: 'sessionId', style: 'simple', explode: false })}/events`));
  }
}

export class IntelligenceCodingSessionsForksApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Fork coding session */
  async create(sessionId: string, body?: BirdCoderForkCodingSessionRequest): Promise<BirdCoderCodingSessionSummary> {
    return this.client.post<BirdCoderCodingSessionSummary>(appApiPath(`/intelligence/coding_sessions/${serializePathParameter(sessionId, { name: 'sessionId', style: 'simple', explode: false })}/fork`), body, undefined, undefined, 'application/json');
  }
}

export interface IntelligenceCodingSessionsListParams {
  workspaceId?: string;
  projectId?: string;
  engineId?: 'codex' | 'claude-code' | 'gemini' | 'opencode';
  page?: number;
  pageSize?: number;
}

export class IntelligenceCodingSessionsApi {
  private client: HttpClient;
  public readonly forks: IntelligenceCodingSessionsForksApi;
  public readonly events: IntelligenceCodingSessionsEventsApi;
  public readonly checkpoints: IntelligenceCodingSessionsCheckpointsApi;
  public readonly questions: IntelligenceCodingSessionsQuestionsApi;
  public readonly artifacts: IntelligenceCodingSessionsArtifactsApi;
  public readonly turns: IntelligenceCodingSessionsTurnsApi;
  public readonly messages: IntelligenceCodingSessionsMessagesApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.forks = new IntelligenceCodingSessionsForksApi(client);
    this.events = new IntelligenceCodingSessionsEventsApi(client);
    this.checkpoints = new IntelligenceCodingSessionsCheckpointsApi(client);
    this.questions = new IntelligenceCodingSessionsQuestionsApi(client);
    this.artifacts = new IntelligenceCodingSessionsArtifactsApi(client);
    this.turns = new IntelligenceCodingSessionsTurnsApi(client);
    this.messages = new IntelligenceCodingSessionsMessagesApi(client);
  }


/** Get coding session */
  async retrieve(sessionId: string): Promise<BirdCoderCodingSessionSummary> {
    return this.client.get<BirdCoderCodingSessionSummary>(appApiPath(`/intelligence/coding_sessions/${serializePathParameter(sessionId, { name: 'sessionId', style: 'simple', explode: false })}`));
  }

/** Delete coding session */
  async delete(sessionId: string): Promise<void> {
    return this.client.delete<void>(appApiPath(`/intelligence/coding_sessions/${serializePathParameter(sessionId, { name: 'sessionId', style: 'simple', explode: false })}`));
  }

/** Update coding session */
  async update(sessionId: string, body: BirdCoderUpdateCodingSessionRequest): Promise<BirdCoderCodingSessionSummary> {
    return this.client.patch<BirdCoderCodingSessionSummary>(appApiPath(`/intelligence/coding_sessions/${serializePathParameter(sessionId, { name: 'sessionId', style: 'simple', explode: false })}`), body, undefined, undefined, 'application/json');
  }

/** List coding sessions */
  async list(params?: IntelligenceCodingSessionsListParams): Promise<Record<string, unknown>> {
    const query = buildQueryString([
      { name: 'workspaceId', value: params?.workspaceId, style: 'form', explode: true, allowReserved: false },
      { name: 'projectId', value: params?.projectId, style: 'form', explode: true, allowReserved: false },
      { name: 'engineId', value: params?.engineId, style: 'form', explode: true, allowReserved: false },
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<Record<string, unknown>>(appendQueryString(appApiPath(`/intelligence/coding_sessions`), query));
  }

/** Create coding session */
  async create(body: BirdCoderCreateCodingSessionRequest): Promise<BirdCoderCodingSessionSummary> {
    return this.client.post<BirdCoderCodingSessionSummary>(appApiPath(`/intelligence/coding_sessions`), body, undefined, undefined, 'application/json');
  }
}

export class IntelligenceApi {
  private client: HttpClient;
  public readonly codingSessions: IntelligenceCodingSessionsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.codingSessions = new IntelligenceCodingSessionsApi(client);
  }

}

export function createIntelligenceApi(client: HttpClient): IntelligenceApi {
  return new IntelligenceApi(client);
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
