import { appApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderApprovalDecisionResultEnvelope, BirdCoderCodingSessionArtifactListEnvelope, BirdCoderCodingSessionCheckpointListEnvelope, BirdCoderCodingSessionEventListEnvelope, BirdCoderCodingSessionSummaryEnvelope, BirdCoderCodingSessionSummaryListEnvelope, BirdCoderCodingSessionTurnEnvelope, BirdCoderCreateCodingSessionRequest, BirdCoderCreateCodingSessionTurnRequest, BirdCoderDeleteCodingSessionMessageResultEnvelope, BirdCoderDeletedResourceEnvelope, BirdCoderEditCodingSessionMessageRequest, BirdCoderEditCodingSessionMessageResultEnvelope, BirdCoderForkCodingSessionRequest, BirdCoderSubmitApprovalDecisionRequest, BirdCoderSubmitUserQuestionAnswerRequest, BirdCoderUpdateCodingSessionRequest, BirdCoderUserQuestionAnswerResultEnvelope } from '../types';


export class IntelligenceQuestionsAnswersApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Submit user-question answer */
  async create(questionId: string, body: BirdCoderSubmitUserQuestionAnswerRequest): Promise<BirdCoderUserQuestionAnswerResultEnvelope> {
    return this.client.post<BirdCoderUserQuestionAnswerResultEnvelope>(appApiPath(`/questions/${serializePathParameter(questionId, { name: 'questionId', style: 'simple', explode: false })}/answer`), body, undefined, undefined, 'application/json');
  }
}

export class IntelligenceQuestionsApi {
  private client: HttpClient;
  public readonly answers: IntelligenceQuestionsAnswersApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.answers = new IntelligenceQuestionsAnswersApi(client);
  }

}

export class IntelligenceApprovalsDecisionsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Submit approval decision */
  async create(approvalId: string, body: BirdCoderSubmitApprovalDecisionRequest): Promise<BirdCoderApprovalDecisionResultEnvelope> {
    return this.client.post<BirdCoderApprovalDecisionResultEnvelope>(appApiPath(`/approvals/${serializePathParameter(approvalId, { name: 'approvalId', style: 'simple', explode: false })}/decision`), body, undefined, undefined, 'application/json');
  }
}

export class IntelligenceApprovalsApi {
  private client: HttpClient;
  public readonly decisions: IntelligenceApprovalsDecisionsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.decisions = new IntelligenceApprovalsDecisionsApi(client);
  }

}

export class IntelligenceCodingSessionsTurnsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Create coding session turn */
  async create(id: string, body: BirdCoderCreateCodingSessionTurnRequest): Promise<BirdCoderCodingSessionTurnEnvelope> {
    return this.client.post<BirdCoderCodingSessionTurnEnvelope>(appApiPath(`/coding_sessions/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}/turns`), body, undefined, undefined, 'application/json');
  }
}

export class IntelligenceCodingSessionsMessagesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Delete coding session message */
  async delete(id: string, messageId: string): Promise<BirdCoderDeleteCodingSessionMessageResultEnvelope> {
    return this.client.delete<BirdCoderDeleteCodingSessionMessageResultEnvelope>(appApiPath(`/coding_sessions/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}/messages/${serializePathParameter(messageId, { name: 'messageId', style: 'simple', explode: false })}`));
  }

/** Edit coding session message */
  async update(id: string, messageId: string, body: BirdCoderEditCodingSessionMessageRequest): Promise<BirdCoderEditCodingSessionMessageResultEnvelope> {
    return this.client.patch<BirdCoderEditCodingSessionMessageResultEnvelope>(appApiPath(`/coding_sessions/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}/messages/${serializePathParameter(messageId, { name: 'messageId', style: 'simple', explode: false })}`), body, undefined, undefined, 'application/json');
  }
}

export class IntelligenceCodingSessionsCheckpointsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List coding session checkpoints */
  async list(id: string): Promise<BirdCoderCodingSessionCheckpointListEnvelope> {
    return this.client.get<BirdCoderCodingSessionCheckpointListEnvelope>(appApiPath(`/coding_sessions/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}/checkpoints`));
  }
}

export class IntelligenceCodingSessionsArtifactsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List coding session artifacts */
  async list(id: string): Promise<BirdCoderCodingSessionArtifactListEnvelope> {
    return this.client.get<BirdCoderCodingSessionArtifactListEnvelope>(appApiPath(`/coding_sessions/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}/artifacts`));
  }
}

export class IntelligenceCodingSessionsEventsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Replay or subscribe to coding session events */
  async list(id: string): Promise<BirdCoderCodingSessionEventListEnvelope> {
    return this.client.get<BirdCoderCodingSessionEventListEnvelope>(appApiPath(`/coding_sessions/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}/events`));
  }
}

export class IntelligenceCodingSessionsForksApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Fork coding session */
  async create(id: string, body?: BirdCoderForkCodingSessionRequest): Promise<BirdCoderCodingSessionSummaryEnvelope> {
    return this.client.post<BirdCoderCodingSessionSummaryEnvelope>(appApiPath(`/coding_sessions/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}/fork`), body, undefined, undefined, 'application/json');
  }
}

export interface IntelligenceCodingSessionsListParams {
  workspaceId?: string;
  projectId?: string;
  engineId?: 'codex' | 'claude-code' | 'gemini' | 'opencode';
  limit?: number;
  offset?: number;
}

export class IntelligenceCodingSessionsApi {
  private client: HttpClient;
  public readonly forks: IntelligenceCodingSessionsForksApi;
  public readonly events: IntelligenceCodingSessionsEventsApi;
  public readonly artifacts: IntelligenceCodingSessionsArtifactsApi;
  public readonly checkpoints: IntelligenceCodingSessionsCheckpointsApi;
  public readonly messages: IntelligenceCodingSessionsMessagesApi;
  public readonly turns: IntelligenceCodingSessionsTurnsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.forks = new IntelligenceCodingSessionsForksApi(client);
    this.events = new IntelligenceCodingSessionsEventsApi(client);
    this.artifacts = new IntelligenceCodingSessionsArtifactsApi(client);
    this.checkpoints = new IntelligenceCodingSessionsCheckpointsApi(client);
    this.messages = new IntelligenceCodingSessionsMessagesApi(client);
    this.turns = new IntelligenceCodingSessionsTurnsApi(client);
  }


/** Get coding session */
  async retrieve(id: string): Promise<BirdCoderCodingSessionSummaryEnvelope> {
    return this.client.get<BirdCoderCodingSessionSummaryEnvelope>(appApiPath(`/coding_sessions/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}`));
  }

/** Delete coding session */
  async delete(id: string): Promise<BirdCoderDeletedResourceEnvelope> {
    return this.client.delete<BirdCoderDeletedResourceEnvelope>(appApiPath(`/coding_sessions/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}`));
  }

/** Update coding session */
  async update(id: string, body: BirdCoderUpdateCodingSessionRequest): Promise<BirdCoderCodingSessionSummaryEnvelope> {
    return this.client.patch<BirdCoderCodingSessionSummaryEnvelope>(appApiPath(`/coding_sessions/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}`), body, undefined, undefined, 'application/json');
  }

/** List coding sessions */
  async list(params?: IntelligenceCodingSessionsListParams): Promise<BirdCoderCodingSessionSummaryListEnvelope> {
    const query = buildQueryString([
      { name: 'workspaceId', value: params?.workspaceId, style: 'form', explode: true, allowReserved: false },
      { name: 'projectId', value: params?.projectId, style: 'form', explode: true, allowReserved: false },
      { name: 'engineId', value: params?.engineId, style: 'form', explode: true, allowReserved: false },
      { name: 'limit', value: params?.limit, style: 'form', explode: true, allowReserved: false },
      { name: 'offset', value: params?.offset, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<BirdCoderCodingSessionSummaryListEnvelope>(appendQueryString(appApiPath(`/coding_sessions`), query));
  }

/** Create coding session */
  async create(body: BirdCoderCreateCodingSessionRequest): Promise<BirdCoderCodingSessionSummaryEnvelope> {
    return this.client.post<BirdCoderCodingSessionSummaryEnvelope>(appApiPath(`/coding_sessions`), body, undefined, undefined, 'application/json');
  }
}

export class IntelligenceApi {
  private client: HttpClient;
  public readonly codingSessions: IntelligenceCodingSessionsApi;
  public readonly approvals: IntelligenceApprovalsApi;
  public readonly questions: IntelligenceQuestionsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.codingSessions = new IntelligenceCodingSessionsApi(client);
    this.approvals = new IntelligenceApprovalsApi(client);
    this.questions = new IntelligenceQuestionsApi(client);
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
