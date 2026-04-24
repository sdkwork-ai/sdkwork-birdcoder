import { useCallback, useEffect, useState } from 'react';
import type { BirdCoderProjectDocumentSummary } from '@sdkwork/birdcoder-types';
import type { IDocumentService } from '@sdkwork/birdcoder-infrastructure-runtime';
import { useIDEServices } from '../context/ideServices.ts';

export async function loadDocuments(
  documentService: Pick<IDocumentService, 'getDocuments'>,
): Promise<BirdCoderProjectDocumentSummary[]> {
  return documentService.getDocuments();
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
