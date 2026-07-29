import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ComposerProviderCapabilities,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import { useIDEServices } from '../context/ideServices.ts';
import { applyDisabledComposerCapabilities } from '../workbench/composerCapabilityPreferences.ts';

export type {
  ComposerProviderCapabilities,
  ComposerProviderCapabilityItem,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

const EMPTY_CAPABILITIES: ComposerProviderCapabilities = {
  plugins: [],
  skills: [],
  errors: [],
};

export interface UseComposerProviderCapabilitiesOptions {
  agentId: string;
  disabledCapabilityIds?: readonly string[];
  isActive: boolean;
  pageSize?: number;
}

export interface ComposerProviderCapabilitiesState {
  capabilities: ComposerProviderCapabilities;
  error: Error | null;
  isLoading: boolean;
  refresh: () => void;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function useComposerProviderCapabilities({
  agentId,
  disabledCapabilityIds = [],
  isActive,
  pageSize = 20,
}: UseComposerProviderCapabilitiesOptions): ComposerProviderCapabilitiesState {
  const { catalogService } = useIDEServices();
  const normalizedAgentId = agentId.trim();
  const [loadedCapabilities, setLoadedCapabilities] = useState(EMPTY_CAPABILITIES);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const refresh = useCallback(() => {
    setRefreshVersion((previousVersion) => previousVersion + 1);
  }, []);

  useEffect(() => {
    if (!isActive || !normalizedAgentId) {
      setLoadedCapabilities(EMPTY_CAPABILITIES);
      setError(null);
      setIsLoading(false);
      return;
    }

    let isCurrent = true;
    const controller = new AbortController();
    setError(null);
    setIsLoading(true);

    void catalogService
      .getComposerProviderCapabilities({
        agentId: normalizedAgentId,
        page: 1,
        pageSize,
        signal: controller.signal,
      })
      .then((nextCapabilities) => {
        if (isCurrent) {
          setLoadedCapabilities(nextCapabilities);
        }
      })
      .catch((loadError: unknown) => {
        if (isCurrent && !controller.signal.aborted) {
          setError(toError(loadError));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
      controller.abort(new Error('Composer provider capability request was superseded.'));
    };
  }, [catalogService, isActive, normalizedAgentId, pageSize, refreshVersion]);

  const disabledCapabilityKey = disabledCapabilityIds.join('\u0000');
  const capabilities = useMemo(
    () => applyDisabledComposerCapabilities(
      loadedCapabilities,
      disabledCapabilityKey ? disabledCapabilityKey.split('\u0000') : [],
    ),
    [disabledCapabilityKey, loadedCapabilities],
  );

  return {
    capabilities,
    error,
    isLoading,
    refresh,
  };
}
