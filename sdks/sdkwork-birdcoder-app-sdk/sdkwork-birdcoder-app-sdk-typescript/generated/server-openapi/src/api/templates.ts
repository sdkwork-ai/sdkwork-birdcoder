import { appApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderAppTemplateSummary, PageInfo } from '../types';


export class TemplatesAppTemplatesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List app templates */
  async list(): Promise<Record<string, unknown>> {
    return this.client.get<Record<string, unknown>>(appApiPath(`/app_templates`));
  }
}

export class TemplatesApi {
  private client: HttpClient;
  public readonly appTemplates: TemplatesAppTemplatesApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.appTemplates = new TemplatesAppTemplatesApi(client);
  }

}

export function createTemplatesApi(client: HttpClient): TemplatesApi {
  return new TemplatesApi(client);
}

function appendQueryString(path: string, rawQueryString: string): string {
  const query = rawQueryString.replace(/^\?+/, '');
  if (!query) {
    return path;
  }
  return path.includes('?') ? `${path}&${query}` : `${path}?${query}`;
}
