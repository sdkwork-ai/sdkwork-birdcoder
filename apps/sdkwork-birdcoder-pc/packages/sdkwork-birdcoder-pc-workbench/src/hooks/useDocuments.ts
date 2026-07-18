import { useCallback, useEffect, useState } from 'react';
import type { BirdCoderProjectDocumentSummary } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { DocumentListOptions, IDocumentService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import { useIDEServices } from '../context/ideServices.ts';

const DEFAULT_DOCUMENT_PAGE_SIZE = 200;

export async function loadDocuments(
  documentService: Pick<IDocumentService, 'getDocuments'>,
  options: DocumentListOptions = {},
): Promise<BirdCoderProjectDocumentSummary[]> {
  return documentService.getDocuments({
    limit: options.limit ?? DEFAULT_DOCUMENT_PAGE_SIZE,
    ...options,
  });
}

export function useDocuments() {
  const { documentService } = useIDEServices();
  const [documents, setDocuments] = useState<BirdCoderProjectDocumentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await loadDocuments(documentService);
      setDocuments(data);
      return data;
    } catch (error) {
      console.error('Failed to load documents', error);
      setDocuments([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [documentService]);

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  return {
    documents,
    isLoading,
    refreshDocuments,
  };
}

