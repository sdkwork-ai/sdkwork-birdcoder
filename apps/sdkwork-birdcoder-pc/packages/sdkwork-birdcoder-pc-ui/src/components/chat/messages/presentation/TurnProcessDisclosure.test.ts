import { describe, expect, it } from 'vitest';
import { formatTurnDuration } from './TurnProcessDisclosure.tsx';

describe('formatTurnDuration (Codex desktop worked-for time label)', () => {
  it('formats sub-second durations as zero', () => {
    expect(formatTurnDuration(0)).toBe('0s');
    expect(formatTurnDuration(500)).toBe('0s');
  });

  it('formats seconds below one minute', () => {
    expect(formatTurnDuration(45_000)).toBe('45s');
    expect(formatTurnDuration(1_000)).toBe('1s');
  });

  it('formats minutes and seconds below one hour', () => {
    expect(formatTurnDuration(83_000)).toBe('1m 23s');
    expect(formatTurnDuration(60_000)).toBe('1m');
    expect(formatTurnDuration(1_440_000)).toBe('24m');
  });

  it('trims zero units above one hour', () => {
    expect(formatTurnDuration(3_600_000)).toBe('1h');
    expect(formatTurnDuration(4_980_000)).toBe('1h 23m');
    expect(formatTurnDuration(4_983_000)).toBe('1h 23m 3s');
  });

  it('formats days and trims zero sub-units', () => {
    expect(formatTurnDuration(172_800_000)).toBe('2d');
    expect(formatTurnDuration(183_780_000)).toBe('2d 3h 3m');
    expect(formatTurnDuration(172_860_000)).toBe('2d 1m');
    expect(formatTurnDuration(172_803_000)).toBe('2d 3s');
  });
});
