// @vitest-environment jsdom

import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storageMock = vi.hoisted(() => ({
  getStoredJson: vi.fn(),
  serializeStoredValue: vi.fn((value: unknown) => JSON.stringify(value)),
  trySetStoredRawValue: vi.fn(),
}));

vi.mock(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/storage/localStore.ts',
  () => ({
    buildLocalStoreKey: (scope: string, key: string) => `${scope}:${key}`,
    deserializeStoredValue: (rawValue: string | null, fallback: unknown) => {
      if (!rawValue) {
        return fallback;
      }
      return JSON.parse(rawValue);
    },
    getStoredJson: storageMock.getStoredJson,
    serializeStoredValue: storageMock.serializeStoredValue,
    trySetStoredRawValue: storageMock.trySetStoredRawValue,
  }),
);

const { usePersistedState } = await import(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/hooks/usePersistedState.ts'
);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function StateHarness({ mutateOnMount, storageKey = 'setting' }: { mutateOnMount?: string; storageKey?: string }) {
  const [value, setValue, isHydrated] = usePersistedState('test', storageKey, 'initial');

  useEffect(() => {
    if (mutateOnMount !== undefined) {
      setValue(mutateOnMount);
    }
  }, [mutateOnMount, setValue]);

  return createElement(
    'button',
    {
      'data-hydrated': String(isHydrated),
      'data-testid': 'state',
      onClick: () => setValue('clicked'),
      type: 'button',
    },
    value,
  );
}

describe('usePersistedState runtime guarantees', () => {
  let roots: Root[] = [];
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    storageMock.getStoredJson.mockReset();
    storageMock.serializeStoredValue.mockImplementation((value: unknown) => JSON.stringify(value));
    storageMock.trySetStoredRawValue.mockReset();
    storageMock.trySetStoredRawValue.mockResolvedValue(true);
  });

  afterEach(async () => {
    await act(async () => {
      for (const root of roots) {
        root.unmount();
      }
      for (let index = 0; index < 10; index += 1) {
        await Promise.resolve();
      }
    });
    roots = [];
    document.body.replaceChildren();
    consoleWarnSpy.mockRestore();
    vi.useRealTimers();
  });

  it('keeps a local mutation made during a delayed hydration read and persists it', async () => {
    let resolveHydration!: (value: string) => void;
    storageMock.getStoredJson.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveHydration = resolve;
      }),
    );

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);
    await act(async () => {
      root.render(createElement(StateHarness, { mutateOnMount: 'local' }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    const stateButton = () => container.querySelector<HTMLButtonElement>('[data-testid="state"]')!;
    expect(stateButton().textContent).toBe('local');
    expect(stateButton().getAttribute('data-hydrated')).toBe('true');

    await act(async () => {
      resolveHydration('remote');
      for (let index = 0; index < 5; index += 1) {
        await Promise.resolve();
      }
    });

    expect(stateButton().textContent).toBe('local');
    expect(storageMock.trySetStoredRawValue).toHaveBeenCalledWith(
      'test',
      'setting',
      JSON.stringify('local'),
    );
  });

  it('retries a rejected write without losing the dirty state', async () => {
    vi.useFakeTimers();
    storageMock.getStoredJson.mockResolvedValue('initial');
    storageMock.trySetStoredRawValue
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);
    await act(async () => {
      root.render(createElement(StateHarness));
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="state"]')!.click();
      await Promise.resolve();
    });

    expect(storageMock.trySetStoredRawValue).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
      for (let index = 0; index < 5; index += 1) {
        await Promise.resolve();
      }
    });

    expect(storageMock.trySetStoredRawValue).toHaveBeenCalledTimes(2);
    expect(storageMock.trySetStoredRawValue).toHaveBeenLastCalledWith(
      'test',
      'setting',
      JSON.stringify('clicked'),
    );
  });

  it('resets hydration when the storage identity changes', async () => {
    let resolveSecondHydration!: (value: string) => void;
    storageMock.getStoredJson.mockImplementation((_scope: string, key: string) => {
      if (key === 'first') {
        return Promise.resolve('first-value');
      }
      return new Promise<string>((resolve) => {
        resolveSecondHydration = resolve;
      });
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);
    await act(async () => {
      root.render(createElement(StateHarness, { storageKey: 'first' }));
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="state"]')?.textContent).toBe('first-value');

    await act(async () => {
      root.render(createElement(StateHarness, { storageKey: 'second' }));
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="state"]')?.getAttribute('data-hydrated')).toBe('false');

    await act(async () => {
      resolveSecondHydration('second-value');
      for (let index = 0; index < 5; index += 1) {
        await Promise.resolve();
      }
    });
    expect(container.querySelector('[data-testid="state"]')?.textContent).toBe('second-value');
    expect(container.querySelector('[data-testid="state"]')?.getAttribute('data-hydrated')).toBe('true');
  });
});
