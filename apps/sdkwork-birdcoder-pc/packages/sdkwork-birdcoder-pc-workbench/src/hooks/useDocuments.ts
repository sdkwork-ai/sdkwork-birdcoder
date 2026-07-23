import { useCallback, useEffect, useState } from 'react';
import type { BirdCoderProjectDocumentSummary } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { DocumentListOptions, IDocumentService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import { useIDEServices } from '../context/ideServices.ts';

export async function loadDocuments(
  documentService: Pick<IDocumentService, 'getDocuments'>,
  options: DocumentListOptions,
): Promise<BirdCoderProjectDocumentSummary[]> {
  return documentService.getDocuments(options);
}

export function useDocuments(projectId: string | null | undefined) {
  const { documentService } = useIDEServices();
  const [documents, setDocuments] = useState<BirdCoderProjectDocumentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshDocuments = useCallback(async () => {
    const normalizedProjectId = projectId?.trim();
    if (!normalizedProjectId) {
      setDocuments([]);
      return [];
    }
    setIsLoading(true);
    try {
      const data = await loadDocuments(documentService, { projectId: normalizedProjectId });
      setDocuments(data);
      return data;
    } catch (error) {
      console.error('Failed to load documents', error);
      setDocuments([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [documentService, projectId]);

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  return {
    documents,
    isLoading,
    refreshDocuments,
  };
}

