import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createAgentTurnStreamPresentation,
} from '../src/workbench/agentTurnStreamPresentation.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('Agent turn stream presentation', () => {
  it('coalesces rapid deltas into the latest presentation frame', () => {
    vi.useFakeTimers();
    const present = vi.fn();
    const stream = createAgentTurnStreamPresentation(present, 33);

    stream.update('h');
    stream.update('hello');
    vi.advanceTimersByTime(32);
    expect(present).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(present).toHaveBeenCalledOnce();
    expect(present).toHaveBeenLastCalledWith('hello');

    stream.update('hello world');
    vi.advanceTimersByTime(33);
    expect(present).toHaveBeenLastCalledWith('hello world');
  });

  it('cancels pending work and ignores updates after close', () => {
    vi.useFakeTimers();
    const present = vi.fn();
    const stream = createAgentTurnStreamPresentation(present, 33);

    stream.update('pending');
    stream.close();
    stream.update('late');
    vi.runAllTimers();

    expect(present).not.toHaveBeenCalled();
  });

  it('isolates presentation callback failures', () => {
    vi.useFakeTimers();
    const stream = createAgentTurnStreamPresentation(() => {
      throw new Error('render failed');
    }, 0);

    stream.update('hello');
    expect(() => vi.runAllTimers()).not.toThrow();
  });
});
