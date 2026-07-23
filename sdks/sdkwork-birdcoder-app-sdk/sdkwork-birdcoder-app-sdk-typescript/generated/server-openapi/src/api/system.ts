import { appApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderApiRouteCatalogEntry, BirdCoderApplicationDescriptor, BirdCoderCoreHealthSummary, BirdCoderCoreRuntimeSummary, PageInfo } from '../types';


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
  async list(): Promise<{ items: BirdCoderApiRouteCatalogEntry[]; pageInfo: PageInfo; }> {
    return this.client.get<{ items: BirdCoderApiRouteCatalogEntry[]; pageInfo: PageInfo; }>(appApiPath(`/system/routes`));
  }
}

export class SystemHealthApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get BirdCoder application health */
  async retrieve(): Promise<BirdCoderCoreHealthSummary> {
    return this.client.get<BirdCoderCoreHealthSummary>(appApiPath(`/system/health`));
  }
}

export class SystemDescriptorApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get BirdCoder application descriptor */
  async retrieve(): Promise<BirdCoderApplicationDescriptor> {
    return this.client.get<BirdCoderApplicationDescriptor>(appApiPath(`/system/descriptor`));
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
