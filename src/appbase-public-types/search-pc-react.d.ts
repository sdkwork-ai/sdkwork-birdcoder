export interface SdkworkSearchDocument {
  content?: string;
  id: string;
  metadata?: Record<string, unknown>;
  title?: string;
}

export declare function searchDocuments(
  documents: readonly SdkworkSearchDocument[],
  query: string,
): SdkworkSearchDocument[];
