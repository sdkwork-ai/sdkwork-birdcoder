import { useCallback, useEffect, useState } from 'react';
import type { ProjectDocumentSummary } from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  DocumentListOptions,
  IDocumentService,
  ProjectDocumentPage,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import { useIDEServices } from '../context/ideServices.ts';

export async function loadDocuments(
  documentService: Pick<IDocumentService, 'getDocuments'>,
  options: DocumentListOptions,
): Promise<ProjectDocumentPage> {
  return documentService.getDocuments(options);
}

export function useDocuments(projectId: string | null | undefined) {
  const { documentService } = useIDEServices();
  const [documents, setDocuments] = useState<ProjectDocumentSummary[]>([]);
  const [pageInfo, setPageInfo] = useState<ProjectDocumentPage['pageInfo'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshDocuments = useCallback(async () => {
    const normalizedProjectId = projectId?.trim();
    if (!normalizedProjectId) {
      setDocuments([]);
      setPageInfo(null);
      return [];
    }
    setIsLoading(true);
    try {
      const page = await loadDocuments(documentService, { projectId: normalizedProjectId });
      setDocuments(page.items);
      setPageInfo(page.pageInfo);
      return page.items;
    } catch (error) {
      console.error('Failed to load documents', error);
      setDocuments([]);
      setPageInfo(null);
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
    pageInfo,
    refreshDocuments,
  };
}

