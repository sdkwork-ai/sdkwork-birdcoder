import { backendApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderDeploymentRecordSummaryListEnvelope, BirdCoderDeploymentTargetSummaryListEnvelope, BirdCoderReleaseSummaryListEnvelope } from '../types';


export class PlatformReleasesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List releases */
  async list(): Promise<BirdCoderReleaseSummaryListEnvelope> {
    return this.client.get<BirdCoderReleaseSummaryListEnvelope>(backendApiPath(`/releases`));
  }
}

export class PlatformProjectsDeploymentTargetsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List deployment targets */
  async list(projectId: string): Promise<BirdCoderDeploymentTargetSummaryListEnvelope> {
    return this.client.get<BirdCoderDeploymentTargetSummaryListEnvelope>(backendApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/deployment_targets`));
  }
}

export class PlatformProjectsApi {
  private client: HttpClient;
  public readonly deploymentTargets: PlatformProjectsDeploymentTargetsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.deploymentTargets = new PlatformProjectsDeploymentTargetsApi(client);
  }

}

export class PlatformDeploymentGovernanceApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List governed deployments */
  async list(): Promise<BirdCoderDeploymentRecordSummaryListEnvelope> {
    return this.client.get<BirdCoderDeploymentRecordSummaryListEnvelope>(backendApiPath(`/deployments`));
  }
}

export class PlatformApi {
  private client: HttpClient;
  public readonly deploymentGovernance: PlatformDeploymentGovernanceApi;
  public readonly projects: PlatformProjectsApi;
  public readonly releases: PlatformReleasesApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.deploymentGovernance = new PlatformDeploymentGovernanceApi(client);
    this.projects = new PlatformProjectsApi(client);
    this.releases = new PlatformReleasesApi(client);
  }

}

export function createPlatformApi(client: HttpClient): PlatformApi {
  return new PlatformApi(client);
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
