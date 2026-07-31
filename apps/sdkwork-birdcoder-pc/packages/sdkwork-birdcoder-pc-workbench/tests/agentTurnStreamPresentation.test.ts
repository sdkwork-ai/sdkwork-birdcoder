import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createAgentTurnStreamPresentation,
} from '../src/workbench/agentTurnStreamPresentation.ts';

afterEach(() => {
  vi.useRealTimers();
});

function createFrameScheduler() {
  return {
    cancelAnimationFrame: (handle: unknown) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    },
    requestAnimationFrame: (callback: () => void) => setTimeout(callback, 16),
  };
}

describe('Agent turn stream presentation', () => {
  it('coalesces updates and reveals at most 24 characters per normal frame', () => {
    vi.useFakeTimers();
    const present = vi.fn();
    const stream = createAgentTurnStreamPresentation(present, createFrameScheduler());

    stream.update('first value that is replaced before the frame');
    stream.update('abcdefghijklmnopqrstuvwxyz0123456789');
    vi.advanceTimersByTime(15);
    expect(present).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(present).toHaveBeenNthCalledWith(1, 'abcdefghijklmnopqrstuvwx');
    vi.advanceTimersByTime(16);
    expect(present).toHaveBeenNthCalledWith(2, 'abcdefghijklmnopqrstuvwxyz0123456789');
  });

  it('drains a large pending response in no more than eight animation frames', async () => {
    vi.useFakeTimers();
    const present = vi.fn();
    const stream = createAgentTurnStreamPresentation(present, createFrameScheduler());
    const content = 'x'.repeat(240);

    stream.update(content);
    const drained = stream.drain();
    for (let frame = 0; frame < 8; frame += 1) {
      vi.advanceTimersByTime(16);
    }
    await drained;

    expect(present).toHaveBeenCalledTimes(8);
    expect(present).toHaveBeenLastCalledWith(content);
  });

  it('falls back to a bounded timer when animation frames are unavailable', () => {
    vi.useFakeTimers();
    const present = vi.fn();
    const stream = createAgentTurnStreamPresentation(present, {
      canUseAnimationFrame: () => false,
      fallbackIntervalMs: 33,
    });

    stream.update('hello');
    vi.advanceTimersByTime(32);
    expect(present).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(present).toHaveBeenCalledWith('hello');
  });

  it('settles drain through its watchdog when an animation frame is suspended', async () => {
    vi.useFakeTimers();
    const present = vi.fn();
    const cancelAnimationFrame = vi.fn();
    const stream = createAgentTurnStreamPresentation(present, {
      cancelAnimationFrame,
      fallbackIntervalMs: 10,
      maxDrainFrames: 3,
      requestAnimationFrame: () => 'suspended-frame',
      targetCharactersPerFrame: 1,
    });

    stream.update('durable completion');
    const drained = stream.drain();
    vi.advanceTimersByTime(29);
    expect(present).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    await drained;

    expect(cancelAnimationFrame).toHaveBeenCalledWith('suspended-frame');
    expect(present).toHaveBeenCalledOnce();
    expect(present).toHaveBeenCalledWith('durable completion');
  });

  it('flushes pending content on close and ignores later updates', () => {
    vi.useFakeTimers();
    const present = vi.fn();
    const stream = createAgentTurnStreamPresentation(present, createFrameScheduler());

    stream.update('pending');
    stream.close();
    stream.update('late');
    vi.runAllTimers();

    expect(present).toHaveBeenCalledOnce();
    expect(present).toHaveBeenCalledWith('pending');
  });

  it('isolates presentation callback failures', () => {
    vi.useFakeTimers();
    const stream = createAgentTurnStreamPresentation(() => {
      throw new Error('render failed');
    }, createFrameScheduler());

    stream.update('hello');
    expect(() => vi.runAllTimers()).not.toThrow();
  });
});
