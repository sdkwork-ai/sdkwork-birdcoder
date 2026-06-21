import { useCallback, useEffect, useState } from 'react';
import type { BirdCoderIamAuditEventSummary } from '@sdkwork/birdcoder-pc-types';
import type { IAuditService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

export async function loadAuditEvents(
  auditService: Pick<IAuditService, 'getAuditEvents'>,
): Promise<BirdCoderIamAuditEventSummary[]> {
  return auditService.getAuditEvents();
}

export function useAuditEvents(
  auditService: IAuditService,
) {
  const [auditEvents, setAuditEvents] = useState<BirdCoderIamAuditEventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshAuditEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await loadAuditEvents(auditService);
      setAuditEvents(data);
      return data;
    } catch (error) {
      console.error('Failed to load audit events', error);
      setAuditEvents([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [auditService]);

  useEffect(() => {
    void refreshAuditEvents();
  }, [refreshAuditEvents]);

  return {
    auditEvents,
    isLoading,
    refreshAuditEvents,
  };
}
