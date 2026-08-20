import { appApiPath } from './paths';
import type { ApiRequestOptions, HttpClient } from '../http/client';

import type { BirdCoderApiRouteCatalogEntry, BirdCoderApplicationDescriptor, BirdCoderCoreHealthSummary, BirdCoderCoreRuntimeSummary, PageInfo } from '../types';


export class SystemRuntimeApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get runtime metadata */
  async retrieve(requestOptions?: ApiRequestOptions): Promise<BirdCoderCoreRuntimeSummary> {
    return this.client.request<BirdCoderCoreRuntimeSummary>(appApiPath(`/system/runtime`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }
}

export class SystemRoutesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List unified API routes */
  async list(requestOptions?: ApiRequestOptions): Promise<{ items: BirdCoderApiRouteCatalogEntry[]; pageInfo: PageInfo; }> {
    return this.client.request<{ items: BirdCoderApiRouteCatalogEntry[]; pageInfo: PageInfo; }>(appApiPath(`/system/routes`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }
}

export class SystemHealthApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get BirdCoder application health */
  async retrieve(requestOptions?: ApiRequestOptions): Promise<BirdCoderCoreHealthSummary> {
    return this.client.request<BirdCoderCoreHealthSummary>(appApiPath(`/system/health`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }
}

export class SystemDescriptorApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get BirdCoder application descriptor */
  async retrieve(requestOptions?: ApiRequestOptions): Promise<BirdCoderApplicationDescriptor> {
    return this.client.request<BirdCoderApplicationDescriptor>(appApiPath(`/system/descriptor`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }
}

export class SystemApi {
  public readonly descriptor: SystemDescriptorApi;
  public readonly health: SystemHealthApi;
  public readonly routes: SystemRoutesApi;
  public readonly runtime: SystemRuntimeApi;

  constructor(client: HttpClient) {
    this.descriptor = new SystemDescriptorApi(client);
    this.health = new SystemHealthApi(client);
    this.routes = new SystemRoutesApi(client);
    this.runtime = new SystemRuntimeApi(client);
  }

}

export function createSystemApi(client: HttpClient): SystemApi {
  return new SystemApi(client);
}
