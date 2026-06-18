import { appApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderProjectDocumentSummaryListEnvelope } from '../types';


export class ContentDocumentsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List project documents */
  async list(): Promise<BirdCoderProjectDocumentSummaryListEnvelope> {
    return this.client.get<BirdCoderProjectDocumentSummaryListEnvelope>(appApiPath(`/documents`));
  }
}

export class ContentApi {
  private client: HttpClient;
  public readonly documents: ContentDocumentsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.documents = new ContentDocumentsApi(client);
  }

}

export function createContentApi(client: HttpClient): ContentApi {
  return new ContentApi(client);
}

function appendQueryString(path: string, rawQueryString: string): string {
  const query = rawQueryString.replace(/^\?+/, '');
  if (!query) {
    return path;
  }
  return path.includes('?') ? `${path}&${query}` : `${path}?${query}`;
}
