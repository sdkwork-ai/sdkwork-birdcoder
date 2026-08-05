// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import { DeepLinkImportListener } from './DeepLinkImportListener.tsx';
import type { DeepLinkImportRequest } from './DeepLinkImportDialog.tsx';

const mockIsTauri = vi.fn();
const mockInvoke = vi.fn();
const mockListen = vi.fn();
const mockT = vi.fn((key: string) => key);
const eventHandlers: Record<string, (event: { payload: unknown }) => void> = {};

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => mockIsTauri(),
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

function sampleRequest(id: string, overrides: Partial<DeepLinkImportRequest> = {}): DeepLinkImportRequest {
  return {
    id,
    version: 'v1',
    resource: 'provider',
    kind: 'relay',
    app: 'claude',
    name: 'Test Relay',
    endpoint: 'https://api.example.com',
    apiKey: 'sk-test-123',
    model: '',
    ...overrides,
  };
}

function emitEvent(eventName: string, payload: unknown) {
  eventHandlers[eventName]?.({ payload });
}

async function renderListener() {
  const result = render(
    <ToastProvider>
      <DeepLinkImportListener />
    </ToastProvider>,
  );
  // Let the dynamic tauri imports and the drain settle.
  await waitFor(() => expect(mockListen).toHaveBeenCalled());
  return result;
}

describe('DeepLinkImportListener', () => {
  beforeEach(() => {
    mockIsTauri.mockReset().mockReturnValue(true);
    mockInvoke.mockReset().mockResolvedValue([]);
    mockListen.mockReset().mockImplementation((event: string, handler: (event: { payload: unknown }) => void) => {
      eventHandlers[event] = handler;
      return Promise.resolve(() => {
        delete eventHandlers[event];
      });
    });
    mockT.mockReset().mockImplementation((key: string) => key);
    Object.keys(eventHandlers).forEach((eventName) => delete eventHandlers[eventName]);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('skips the subscription entirely outside Tauri', async () => {
    mockIsTauri.mockReturnValue(false);
    renderListener();
    await waitFor(() => expect(mockIsTauri).toHaveBeenCalled());
    expect(mockListen).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('registers event listeners before draining the cold-start buffer', async () => {
    await renderListener();
    // Drain must be the first and only invoke; the listeners must already
    // be registered so a request racing the drain is still delivered.
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('deeplink_drain_pending_import_requests');
    expect(eventHandlers['deep-link-import']).toBeTypeOf('function');
    expect(eventHandlers['deep-link-error']).toBeTypeOf('function');
  });

  it('shows the confirmation dialog for drained cold-start requests', async () => {
    mockInvoke.mockResolvedValueOnce([sampleRequest('r1', { kind: 'official' })]);
    await renderListener();
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(screen.getByText('Test Relay')).toBeTruthy();
    expect(screen.getByText('https://api.example.com')).toBeTruthy();
    // API key is masked in the dialog.
    expect(screen.queryByText('sk-test-123')).toBeNull();
    // Official kind badge label key is rendered.
    expect(screen.getByText('app.deepLinkChannelKindOfficial')).toBeTruthy();
  });

  it('deduplicates an arrival delivered by both the drain and the event', async () => {
    mockInvoke.mockResolvedValueOnce([sampleRequest('r1')]);
    await renderListener();
    await screen.findByRole('dialog');
    // The same arrival races in via its event after the drain returned it.
    emitEvent('deep-link-import', sampleRequest('r1'));
    mockInvoke.mockResolvedValueOnce({
      code: 'relay-test-relay-1',
      name: 'Test Relay',
      kind: 'relay',
      message: '',
    });
    fireEvent.click(screen.getByRole('button', { name: 'app.deepLinkImportConfirm' }));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'deeplink_import_from_request',
        expect.objectContaining({ request: expect.objectContaining({ id: 'r1' }) }),
      );
    });
    // After confirming the single queued request the dialog must be gone; a
    // duplicated queue entry would have surfaced the dialog again.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('confirms the import and shows a success toast', async () => {
    mockInvoke.mockResolvedValueOnce([sampleRequest('r1')]);
    await renderListener();
    await screen.findByRole('dialog');
    mockInvoke.mockResolvedValueOnce({
      code: 'relay-test-relay-1',
      name: 'Test Relay',
      kind: 'relay',
      message: '',
    });
    fireEvent.click(screen.getByRole('button', { name: 'app.deepLinkImportConfirm' }));
    await waitFor(() => expect(screen.getByText('app.deepLinkImportSucceeded')).toBeTruthy());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('cancels without importing and advances the queue', async () => {
    mockInvoke.mockResolvedValueOnce([sampleRequest('r1')]);
    await renderListener();
    await screen.findByRole('dialog');
    // The dialog has two cancel controls with the same label: the header
    // close button (aria-label) and the footer cancel button; click the
    // footer one.
    const cancelButtons = screen.getAllByRole('button', { name: 'app.deepLinkImportCancel' });
    fireEvent.click(cancelButtons[cancelButtons.length - 1]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).not.toHaveBeenCalledWith(
      'deeplink_import_from_request',
      expect.anything(),
    );
  });

  it('shows an error toast when import fails and closes the dialog', async () => {
    mockInvoke.mockResolvedValueOnce([sampleRequest('r1')]);
    await renderListener();
    await screen.findByRole('dialog');
    mockInvoke.mockRejectedValueOnce('boom');
    fireEvent.click(screen.getByRole('button', { name: 'app.deepLinkImportConfirm' }));
    await waitFor(() => expect(screen.getByText('app.deepLinkImportFailed')).toBeTruthy());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('surfaces deep-link-error events as an error toast', async () => {
    await renderListener();
    emitEvent('deep-link-error', { url: 'birdcoder://v1/import?resource=mcp', error: 'unsupported' });
    await waitFor(() => expect(screen.getByText('app.deepLinkParseFailed')).toBeTruthy());
  });
});
