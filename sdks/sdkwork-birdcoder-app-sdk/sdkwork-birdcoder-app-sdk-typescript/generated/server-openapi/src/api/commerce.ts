import { appApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderCommerceMembershipCurrentSummary, BirdCoderCommerceMembershipPackageGroupSummary, PageInfo } from '../types';


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

  constructor(client: HttpClient) {
    this.client = client;
    this.memberships = new CommerceMembershipsApi(client);
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
