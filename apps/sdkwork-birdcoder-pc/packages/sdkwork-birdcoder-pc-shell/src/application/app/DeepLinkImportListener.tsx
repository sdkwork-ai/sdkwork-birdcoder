/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import {
  DeepLinkImportDialog,
  deepLinkChannelKindLabel,
  type DeepLinkImportRequest,
} from './DeepLinkImportDialog.tsx';

const DEEP_LINK_IMPORT_EVENT = 'deep-link-import';
const DEEP_LINK_ERROR_EVENT = 'deep-link-error';

interface DeepLinkImportSnapshot {
  code: string;
  name: string;
  kind: string;
  message: string;
}

interface DeepLinkErrorSnapshot {
  url: string;
  error: string;
}

/**
 * Desktop-only bridge for `birdcoder://` deep link imports.
 *
 * The Tauri host parses CC Switch compatible `v1/import` provider links (see
 * the host `deeplink` module) into a request and emits it — but writes
 * nothing itself. This component shows a confirmation dialog (the consent
 * surface for untrusted links) and only after the user confirms invokes the
 * import command, which re-validates and writes the channel plus API key
 * into the client-local model config store.
 *
 * Delivery: the host buffers requests that arrived before the webview
 * mounted (cold start) and also emits every arrival as an event. The
 * listeners are registered before the one-time mount drain, and requests are
 * deduplicated by their per-arrival `id`, so every arrival surfaces exactly
 * once regardless of the registration race. Non-Tauri runtimes (browser
 * dev, H5) skip the subscription entirely.
 */
export function DeepLinkImportListener() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [queue, setQueue] = useState<DeepLinkImportRequest[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const enqueueRequests = useCallback((incoming: DeepLinkImportRequest[]) => {
    if (incoming.length === 0) {
      return;
    }
    setQueue((current) => {
      const known = new Set(current.map((request) => request.id));
      return [...current, ...incoming.filter((request) => !known.has(request.id))];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let disposeImportListener: (() => void) | undefined;
    let disposeErrorListener: (() => void) | undefined;

    void (async () => {
      const { isTauri, invoke } = await import('@tauri-apps/api/core');
      if (!isTauri() || cancelled) {
        return;
      }
      const { listen } = await import('@tauri-apps/api/event');
      // Listen first, drain second: any request that races the one-time
      // mount drain is still delivered by its event (deduplicated by id),
      // and nothing can be left stranded in the host buffer.
      disposeImportListener = await listen<DeepLinkImportRequest>(
        DEEP_LINK_IMPORT_EVENT,
        ({ payload }) => {
          if (!cancelled) {
            enqueueRequests([payload]);
          }
        },
      );
      disposeErrorListener = await listen<DeepLinkErrorSnapshot>(
        DEEP_LINK_ERROR_EVENT,
        ({ payload }) => {
          if (!cancelled) {
            addToast(t('app.deepLinkParseFailed', { error: payload.error }), 'error');
          }
        },
      );
      if (cancelled) {
        disposeImportListener();
        disposeErrorListener();
        return;
      }
      try {
        const pending = await invoke<DeepLinkImportRequest[]>(
          'deeplink_drain_pending_import_requests',
        );
        if (!cancelled) {
          enqueueRequests(pending);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to drain pending deep link import requests.', error);
        }
      }
    })().catch((error) => {
      if (!cancelled) {
        console.error('Failed to initialize the BirdCoder deep link import listener.', error);
      }
    });

    return () => {
      cancelled = true;
      disposeImportListener?.();
      disposeErrorListener?.();
    };
  }, [addToast, t, enqueueRequests]);

  const currentRequest = queue[0] ?? null;

  const handleConfirm = useCallback(async () => {
    if (!currentRequest || isImporting) {
      return;
    }
    setIsImporting(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // The host resolves vendors/models itself through the gateway catalog
      // (`modelsBaseUrl`) and re-validates the payload before importing.
      const snapshot = await invoke<DeepLinkImportSnapshot>('deeplink_import_from_request', {
        request: currentRequest,
      });
      addToast(
        t('app.deepLinkImportSucceeded', {
          kind: t(deepLinkChannelKindLabel(snapshot.kind)),
          name: snapshot.name,
        }),
        'success',
      );
    } catch (error) {
      addToast(t('app.deepLinkImportFailed', { message: String(error) }), 'error');
    } finally {
      setQueue((current) => current.slice(1));
      setIsImporting(false);
    }
  }, [currentRequest, isImporting, addToast, t]);

  const handleCancel = useCallback(() => {
    if (!isImporting) {
      setQueue((current) => current.slice(1));
    }
  }, [isImporting]);

  return currentRequest ? (
    <DeepLinkImportDialog
      request={currentRequest}
      isImporting={isImporting}
      onCancel={handleCancel}
      onConfirm={() => void handleConfirm()}
    />
  ) : null;
}
