import { useCallback, useEffect, useState } from 'react';
import type { BirdCoderAdminAuditEventSummary } from '@sdkwork/birdcoder-types';
import type { IAuditService } from '@sdkwork/birdcoder-infrastructure';
import { useIDEServices } from '../context/ideServices.ts';

export async function loadAuditEvents(
  auditService: Pick<IAuditService, 'getAuditEvents'>,
): Promise<BirdCoderAdminAuditEventSummary[]> {
  return auditService.getAuditEvents();
}

export function useAuditEvents() {
  const { auditService } = useIDEServices();
  const [auditEvents, setAuditEvents] = useState<BirdCoderAdminAuditEventSummary[]>([]);
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
